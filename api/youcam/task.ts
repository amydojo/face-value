import {
  YOUCAM_API_VERSION,
  YOUCAM_HD_REDNESS_CONCERN,
  YOUCAM_SD_REDNESS_CONCERN,
  assertValidProtocol,
  type AnalysisProtocol,
  type YouCamRednessConcern,
} from '../../src/adapters/analysis/youcam/contracts.js';
import {
  YouCamServerError,
  checkYouCamTask,
  createYouCamTask,
  errorResponse,
  jsonResponse,
  readJsonRequest,
} from '../_youcam.js';
import { requireYouCamAccess } from '../_youcam_session.js';

type TaskOperation = 'create' | 'check';
type TaskRejectedStage =
  | 'request_body'
  | 'file_id'
  | 'protocol'
  | 'task_id'
  | 'concern'
  | 'provider_task_create'
  | 'provider_task_check';

interface TaskDiagnosticContext {
  operation: TaskOperation;
  stage: TaskRejectedStage;
  invalidFields: string[];
}

const SAFE_DIAGNOSTIC_CODE = /^[A-Za-z0-9_.-]{1,80}$/;

function boundedDiagnosticCode(value: unknown): string {
  const code = typeof value === 'string' ? value : '';
  return SAFE_DIAGNOSTIC_CODE.test(code) ? code : 'unavailable';
}

function pushInvalidField(fields: string[], field: string): void {
  if (!fields.includes(field)) fields.push(field);
}

function invalidProtocolFields(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['protocol'];
  }

  const source = value as Record<string, unknown>;
  const fields: string[] = [];
  if (source.provider !== 'youcam') fields.push('protocol.provider');
  if (source.apiVersion !== YOUCAM_API_VERSION) fields.push('protocol.apiVersion');
  if (source.mode !== 'hd' && source.mode !== 'sd') fields.push('protocol.mode');
  if (
    source.concern !== YOUCAM_HD_REDNESS_CONCERN &&
    source.concern !== YOUCAM_SD_REDNESS_CONCERN
  ) {
    fields.push('protocol.concern');
  }
  if (
    (source.mode === 'hd' && source.concern !== YOUCAM_HD_REDNESS_CONCERN) ||
    (source.mode === 'sd' && source.concern !== YOUCAM_SD_REDNESS_CONCERN)
  ) {
    pushInvalidField(fields, 'protocol.concern');
  }
  if (source.region !== null) fields.push('protocol.region');
  if (source.scoreType !== 'raw_score') fields.push('protocol.scoreType');
  if (
    typeof source.captureProtocolVersion !== 'string' ||
    source.captureProtocolVersion.length === 0
  ) {
    fields.push('protocol.captureProtocolVersion');
  }
  return fields;
}

function invalidFieldsForCode(
  errorCode: string,
  context: TaskDiagnosticContext,
): string[] {
  if (context.invalidFields.length > 0) return context.invalidFields;

  switch (errorCode) {
    case 'unsupported_media_type':
      return ['content-type'];
    case 'invalid_json':
      return ['body'];
    case 'invalid_file_id':
      return ['fileId'];
    case 'invalid_task_id':
      return ['taskId'];
    case 'unsupported_concern':
      return [context.operation === 'create' ? 'protocol.concern' : 'concern'];
    case 'invalid_protocol':
      return ['protocol'];
    default:
      return [];
  }
}

function logTaskDiagnostic(error: unknown, context: TaskDiagnosticContext): void {
  const serverError = error instanceof YouCamServerError ? error : null;
  const providerRejected =
    context.stage === 'provider_task_create' || context.stage === 'provider_task_check';
  const errorCode = boundedDiagnosticCode(serverError?.code ?? 'internal_error');
  const responseStatus = serverError?.status ?? 500;

  console.error('[youcam-task-diagnostic]', {
    diagnosticCode: 'youcam_task_rejected',
    operation: context.operation,
    rejectedStage: context.stage,
    responseStatus,
    localErrorCode: providerRejected ? 'provider_rejected' : errorCode,
    providerHttpStatus: providerRejected ? responseStatus : null,
    providerErrorCode: providerRejected ? errorCode : null,
    invalidFields: providerRejected ? [] : invalidFieldsForCode(errorCode, context),
  });
}

function readConcern(value: unknown): YouCamRednessConcern {
  if (value === YOUCAM_HD_REDNESS_CONCERN || value === YOUCAM_SD_REDNESS_CONCERN) {
    return value;
  }
  throw new YouCamServerError({
    message: 'Only the frozen redness concerns are available in the current demo.',
    status: 400,
    code: 'unsupported_concern',
    retryable: false,
  });
}

function readProtocol(value: unknown): AnalysisProtocol {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new YouCamServerError({
      message: 'A valid analysis protocol is required.',
      status: 400,
      code: 'invalid_protocol',
      retryable: false,
    });
  }

  const source = value as Record<string, unknown>;
  if (
    source.provider !== 'youcam' ||
    source.apiVersion !== YOUCAM_API_VERSION ||
    (source.mode !== 'hd' && source.mode !== 'sd') ||
    source.region !== null ||
    source.scoreType !== 'raw_score' ||
    typeof source.captureProtocolVersion !== 'string'
  ) {
    throw new YouCamServerError({
      message: 'The analysis protocol does not match the frozen contract.',
      status: 400,
      code: 'invalid_protocol',
      retryable: false,
    });
  }

  const protocol: AnalysisProtocol = {
    provider: 'youcam',
    apiVersion: YOUCAM_API_VERSION,
    mode: source.mode,
    concern: readConcern(source.concern),
    region: null,
    scoreType: 'raw_score',
    captureProtocolVersion: source.captureProtocolVersion,
  };

  try {
    assertValidProtocol(protocol);
  } catch {
    throw new YouCamServerError({
      message: 'The analysis protocol does not match the frozen contract.',
      status: 400,
      code: 'invalid_protocol',
      retryable: false,
    });
  }

  return protocol;
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 1_024) {
    throw new YouCamServerError({
      message: `A valid ${label} is required.`,
      status: 400,
      code: `invalid_${label.replaceAll(' ', '_')}`,
      retryable: false,
    });
  }
  return value;
}

async function createTask(request: Request): Promise<Response> {
  const context: TaskDiagnosticContext = {
    operation: 'create',
    stage: 'request_body',
    invalidFields: [],
  };

  try {
    const body = await readJsonRequest(request);

    context.stage = 'file_id';
    context.invalidFields =
      typeof body.fileId === 'string' &&
      body.fileId.length >= 8 &&
      body.fileId.length <= 1_024
        ? []
        : ['fileId'];
    const fileId = requireIdentifier(body.fileId, 'file id');

    context.stage = 'protocol';
    context.invalidFields = invalidProtocolFields(body.protocol);
    const protocol = readProtocol(body.protocol);

    context.stage = 'provider_task_create';
    context.invalidFields = [];
    const created = await createYouCamTask({
      fileId,
      concern: protocol.concern,
      fromCameraKit: body.fromCameraKit === true,
    });

    return jsonResponse(created, 202);
  } catch (error) {
    logTaskDiagnostic(error, context);
    throw error;
  }
}

async function checkTask(request: Request): Promise<Response> {
  const context: TaskDiagnosticContext = {
    operation: 'check',
    stage: 'task_id',
    invalidFields: [],
  };

  try {
    const url = new URL(request.url);
    const taskIdValue = url.searchParams.get('taskId');
    context.invalidFields =
      typeof taskIdValue === 'string' &&
      taskIdValue.length >= 8 &&
      taskIdValue.length <= 1_024
        ? []
        : ['taskId'];
    const taskId = requireIdentifier(taskIdValue, 'task id');

    context.stage = 'concern';
    const concernValue = url.searchParams.get('concern');
    context.invalidFields =
      concernValue === YOUCAM_HD_REDNESS_CONCERN || concernValue === YOUCAM_SD_REDNESS_CONCERN
        ? []
        : ['concern'];
    const concern = readConcern(concernValue);

    context.stage = 'provider_task_check';
    context.invalidFields = [];
    const checked = await checkYouCamTask({ taskId, concern });
    return jsonResponse(checked);
  } catch (error) {
    logTaskDiagnostic(error, context);
    throw error;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const accessFailure = requireYouCamAccess(request);
    if (accessFailure) return accessFailure;

    try {
      if (request.method === 'POST') return await createTask(request);
      if (request.method === 'GET') return await checkTask(request);

      return jsonResponse(
        {
          error: {
            code: 'method_not_allowed',
            message: 'Use POST to create a task or GET to check its status.',
            retryable: false,
          },
        },
        405,
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
};
