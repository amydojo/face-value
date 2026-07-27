import { timingSafeEqual } from 'node:crypto';
import {
  YOUCAM_API_VERSION,
  type YouCamRednessConcern,
} from '../src/adapters/analysis/youcam/contracts.js';

const YOUCAM_BASE_URL = 'https://yce-api-01.makeupar.com';
const DEFAULT_POLLING_INTERVAL_MS = 1_500;
const MIN_POLLING_INTERVAL_MS = 500;
const MAX_POLLING_INTERVAL_MS = 5_000;

interface JsonObject {
  [key: string]: unknown;
}

export interface YouCamUploadSlot {
  fileId: string;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
  };
}

export interface YouCamCreatedTask {
  taskId: string;
  pollingIntervalMs: number;
}

export type YouCamCheckedTask =
  | {
      status: 'running';
      pollingIntervalMs: number;
    }
  | {
      status: 'success';
      taskId: string;
      concern: YouCamRednessConcern;
      rawScore: number;
    };

export class YouCamServerError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor({
    message,
    status = 502,
    code = 'youcam_unavailable',
    retryable = true,
  }: {
    message: string;
    status?: number;
    code?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'YouCamServerError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new YouCamServerError({
      message: `YouCam returned an invalid ${label}`,
      code: 'invalid_provider_response',
      retryable: false,
    });
  }
  return value;
}

function unwrapData(payload: unknown): JsonObject {
  const root = readObject(payload, 'response');
  return isObject(root.data) ? root.data : root;
}

function clampPollingInterval(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_POLLING_INTERVAL_MS;

  const milliseconds = numeric < 100 ? numeric * 1_000 : numeric;
  return Math.min(MAX_POLLING_INTERVAL_MS, Math.max(MIN_POLLING_INTERVAL_MS, Math.round(milliseconds)));
}

function equalSecret(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(receivedBytes, expectedBytes);
}

export function requireSpikeAccess(request: Request): Response | null {
  const expected = process.env.YOUCAM_SPIKE_TOKEN;
  if (!expected) {
    return jsonResponse(
      {
        error: {
          code: 'spike_not_configured',
          message: 'The YouCam spike access token is not configured.',
          retryable: false,
        },
      },
      503,
    );
  }

  const received = request.headers.get('x-face-value-spike-token') ?? '';
  if (!received || !equalSecret(received, expected)) {
    return jsonResponse(
      {
        error: {
          code: 'unauthorized',
          message: 'A valid Face Value spike access token is required.',
          retryable: false,
        },
      },
      401,
    );
  }

  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export async function readJsonRequest(request: Request): Promise<JsonObject> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new YouCamServerError({
      message: 'Expected an application/json request body.',
      status: 415,
      code: 'unsupported_media_type',
      retryable: false,
    });
  }

  try {
    return readObject(await request.json(), 'request body');
  } catch (error) {
    if (error instanceof YouCamServerError) throw error;
    throw new YouCamServerError({
      message: 'The request body is not valid JSON.',
      status: 400,
      code: 'invalid_json',
      retryable: false,
    });
  }
}

function providerKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) {
    throw new YouCamServerError({
      message: 'The YouCam API key is not configured.',
      status: 503,
      code: 'provider_not_configured',
      retryable: false,
    });
  }
  return key;
}

function providerError(payload: unknown, fallbackStatus: number): YouCamServerError {
  const root = isObject(payload) ? payload : {};
  const data = isObject(root.data) ? root.data : {};
  const code = String(root.error_code ?? data.error_code ?? 'youcam_request_failed');
  const message = String(root.error ?? data.error ?? 'YouCam could not complete the request.');
  const implementationDefect = code === 'InvalidParameters' || code === 'unknown_dst_action';
  const retryable = !implementationDefect && fallbackStatus !== 401 && fallbackStatus !== 403;

  return new YouCamServerError({
    message,
    status: fallbackStatus >= 400 && fallbackStatus < 600 ? fallbackStatus : 502,
    code,
    retryable,
  });
}

async function providerJson(
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${YOUCAM_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${providerKey()}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new YouCamServerError({
      message: 'YouCam returned a non-JSON response.',
      status: 502,
      code: 'invalid_provider_response',
      retryable: true,
    });
  }

  if (!response.ok) throw providerError(payload, response.status);
  return payload;
}

function readHeaderMap(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === 'string' || typeof headerValue === 'number') {
      headers[key] = String(headerValue);
    }
  }
  return headers;
}

export async function createYouCamUploadSlot(input: {
  fileName: string;
  contentType: 'image/jpeg' | 'image/png';
  fileSize: number;
}): Promise<YouCamUploadSlot> {
  const payload = await providerJson(`/s2s/v${YOUCAM_API_VERSION}/file/skin-analysis`, {
    method: 'POST',
    body: JSON.stringify({
      files: [
        {
          content_type: input.contentType,
          file_name: input.fileName,
          file_size: input.fileSize,
        },
      ],
    }),
  });

  const data = unwrapData(payload);
  const files = Array.isArray(data.files) ? data.files : [];
  const file = readObject(files[0], 'file upload slot');
  const requests = Array.isArray(file.requests) ? file.requests : [];
  const uploadRequest = readObject(requests[0], 'signed upload request');
  const fileId = typeof file.file_id === 'string' ? file.file_id : '';
  const url = typeof uploadRequest.url === 'string' ? uploadRequest.url : '';
  const method = typeof uploadRequest.method === 'string' ? uploadRequest.method.toUpperCase() : 'PUT';

  if (!fileId || !url || method !== 'PUT') {
    throw new YouCamServerError({
      message: 'YouCam did not return a usable signed upload slot.',
      code: 'invalid_upload_slot',
      retryable: true,
    });
  }

  return {
    fileId,
    upload: {
      method: 'PUT',
      url,
      headers: readHeaderMap(uploadRequest.headers),
    },
  };
}

export async function createYouCamTask(input: {
  fileId: string;
  concern: YouCamRednessConcern;
  fromCameraKit: boolean;
}): Promise<YouCamCreatedTask> {
  const payload = await providerJson(`/s2s/v${YOUCAM_API_VERSION}/task/skin-analysis`, {
    method: 'POST',
    body: JSON.stringify({
      src_file_id: input.fileId,
      dst_actions: [input.concern],
      miniserver_args: {
        enable_mask_overlay: false,
      },
      format: 'json',
      pf_camera_kit: input.fromCameraKit,
    }),
  });

  const data = unwrapData(payload);
  const taskId = typeof data.task_id === 'string' ? data.task_id : '';
  if (!taskId) {
    throw new YouCamServerError({
      message: 'YouCam did not return a task identifier.',
      code: 'invalid_task_response',
      retryable: true,
    });
  }

  return {
    taskId,
    pollingIntervalMs: clampPollingInterval(data.polling_interval),
  };
}

function readRawScore(data: JsonObject, concern: YouCamRednessConcern): number {
  const results = readObject(data.results, 'task results');
  const output = Array.isArray(results.output) ? results.output : [];
  const concernResult = output.find(
    (entry) => isObject(entry) && entry.type === concern,
  );
  const record = readObject(concernResult, `${concern} result`);
  const rawScore = record.raw_score;

  if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) {
    throw new YouCamServerError({
      message: `YouCam did not return a finite raw_score for ${concern}.`,
      code: 'missing_raw_score',
      retryable: false,
    });
  }

  return rawScore;
}

export async function checkYouCamTask(input: {
  taskId: string;
  concern: YouCamRednessConcern;
}): Promise<YouCamCheckedTask> {
  const taskId = encodeURIComponent(input.taskId);
  const payload = await providerJson(
    `/s2s/v${YOUCAM_API_VERSION}/task/skin-analysis/${taskId}`,
    { method: 'GET' },
  );

  const data = unwrapData(payload);
  const taskStatus = typeof data.task_status === 'string' ? data.task_status.toLowerCase() : '';

  if (taskStatus === 'running' || taskStatus === 'queued' || taskStatus === 'pending') {
    return {
      status: 'running',
      pollingIntervalMs: clampPollingInterval(data.polling_interval),
    };
  }

  if (taskStatus === 'error' || taskStatus === 'failed') {
    throw providerError(payload, 422);
  }

  if (taskStatus !== 'success') {
    throw new YouCamServerError({
      message: 'YouCam returned an unknown task status.',
      code: 'unknown_task_status',
      retryable: true,
    });
  }

  return {
    status: 'success',
    taskId: input.taskId,
    concern: input.concern,
    rawScore: readRawScore(data, input.concern),
  };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof YouCamServerError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
      error.status,
    );
  }

  return jsonResponse(
    {
      error: {
        code: 'internal_error',
        message: 'The YouCam request could not be completed.',
        retryable: true,
      },
    },
    500,
  );
}
