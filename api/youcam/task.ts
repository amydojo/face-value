import {
  YOUCAM_API_VERSION,
  YOUCAM_HD_REDNESS_CONCERN,
  YOUCAM_SD_REDNESS_CONCERN,
  assertValidProtocol,
  type AnalysisProtocol,
  type YouCamRednessConcern,
} from '../../src/adapters/analysis/youcam/contracts';
import {
  YouCamServerError,
  checkYouCamTask,
  createYouCamTask,
  errorResponse,
  jsonResponse,
  readJsonRequest,
  requireSpikeAccess,
} from '../_youcam';

function readConcern(value: unknown): YouCamRednessConcern {
  if (value === YOUCAM_HD_REDNESS_CONCERN || value === YOUCAM_SD_REDNESS_CONCERN) {
    return value;
  }
  throw new YouCamServerError({
    message: 'Only the frozen redness concerns are available in Phase A.',
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
      message: 'The analysis protocol does not match the frozen Phase A contract.',
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
      message: 'The analysis protocol does not match the frozen Phase A contract.',
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
  const body = await readJsonRequest(request);
  const fileId = requireIdentifier(body.fileId, 'file id');
  const protocol = readProtocol(body.protocol);
  const created = await createYouCamTask({
    fileId,
    concern: protocol.concern,
    fromCameraKit: body.fromCameraKit === true,
  });

  return jsonResponse(created, 202);
}

async function checkTask(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const taskId = requireIdentifier(url.searchParams.get('taskId'), 'task id');
  const concern = readConcern(url.searchParams.get('concern'));
  const checked = await checkYouCamTask({ taskId, concern });
  return jsonResponse(checked);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const accessFailure = requireSpikeAccess(request);
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
