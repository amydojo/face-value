import {
  YOUCAM_MAX_FILE_BYTES,
  assertValidProtocol,
  isSupportedImageType,
  normalizeImageContentType,
  sanitizeImageFileName,
  type AnalyzeCaptureInput,
  type CreateTaskResponse,
  type SkinAnalysisProvider,
  type SkinAnalysisSignal,
  type TaskStatusResponse,
  type UploadSlotResponse,
} from './contracts';

const DEFAULT_MAX_POLL_ATTEMPTS = 24;
const DEFAULT_POLLING_INTERVAL_MS = 1_500;
const FORBIDDEN_BROWSER_UPLOAD_HEADERS = new Set([
  'authorization',
  'content-length',
  'cookie',
  'host',
  'origin',
  'referer',
]);

interface ProviderOptions {
  accessToken?: string;
  fetcher?: typeof fetch;
  maxPollAttempts?: number;
  fromCameraKit?: boolean;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
}

export class YouCamProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor({
    message,
    code,
    retryable,
    status,
  }: {
    message: string;
    code: string;
    retryable: boolean;
    status: number;
  }) {
    super(message);
    this.name = 'YouCamProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function embeddedProviderCode(message: string | undefined): string | null {
  const normalized = message?.trim() ?? '';
  return /^error_[a-z0-9_]+$/i.test(normalized) ? normalized : null;
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new YouCamProviderError({
      message: 'Face Value received an unreadable analysis response.',
      code: 'invalid_response',
      retryable: true,
      status: response.status || 502,
    });
  }

  if (!response.ok) {
    const body = payload as ApiErrorBody;
    const message = body.error?.message ?? 'The skin analysis request failed.';
    const reportedCode = body.error?.code ?? 'analysis_request_failed';
    const recoveredCode = embeddedProviderCode(message);
    throw new YouCamProviderError({
      message,
      code: reportedCode === 'youcam_request_failed' && recoveredCode
        ? recoveredCode
        : reportedCode,
      retryable: body.error?.retryable ?? response.status >= 500,
      status: response.status,
    });
  }

  return payload as T;
}

function uploadHeaders(headers: Record<string, string>): Headers {
  const safeHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (FORBIDDEN_BROWSER_UPLOAD_HEADERS.has(name.toLowerCase())) continue;
    safeHeaders.set(name, value);
  }
  return safeHeaders;
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Analysis cancelled', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Analysis cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

export class YouCamSkinAnalysisProvider implements SkinAnalysisProvider {
  private readonly accessToken: string | null;
  private readonly fetcher: typeof fetch;
  private readonly maxPollAttempts: number;
  private readonly fromCameraKit: boolean;

  constructor({
    accessToken,
    fetcher,
    maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
    fromCameraKit = false,
  }: ProviderOptions = {}) {
    this.accessToken = accessToken?.trim() || null;
    this.fetcher = fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.maxPollAttempts = Math.max(1, Math.floor(maxPollAttempts));
    this.fromCameraKit = fromCameraKit;
  }

  private apiHeaders(includeContentType = true): HeadersInit {
    return {
      ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
      ...(this.accessToken
        ? { 'x-face-value-spike-token': this.accessToken }
        : {}),
    };
  }

  private async requestUploadSlot(input: AnalyzeCaptureInput): Promise<UploadSlotResponse> {
    const contentType = normalizeImageContentType(input.image.type);
    const response = await this.fetcher('/api/youcam/upload-slot', {
      method: 'POST',
      headers: this.apiHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        contentType,
        fileName: sanitizeImageFileName(input.fileName, contentType),
        fileSize: input.image.size,
      }),
      signal: input.signal,
    });

    return readJson<UploadSlotResponse>(response);
  }

  private async uploadImage(
    image: Blob,
    slot: UploadSlotResponse,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await this.fetcher(slot.upload.url, {
      method: slot.upload.method,
      headers: uploadHeaders(slot.upload.headers),
      body: image,
      signal,
    });

    if (!response.ok) {
      throw new YouCamProviderError({
        message: 'The private capture could not be transferred for analysis.',
        code: 'signed_upload_failed',
        retryable: true,
        status: response.status,
      });
    }
  }

  private async createTask(
    fileId: string,
    input: AnalyzeCaptureInput,
  ): Promise<CreateTaskResponse> {
    const response = await this.fetcher('/api/youcam/task', {
      method: 'POST',
      headers: this.apiHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        fileId,
        protocol: input.protocol,
        fromCameraKit: input.fromCameraKit ?? this.fromCameraKit,
      }),
      signal: input.signal,
    });

    return readJson<CreateTaskResponse>(response);
  }

  private async checkTask(
    taskId: string,
    input: AnalyzeCaptureInput,
  ): Promise<TaskStatusResponse> {
    const params = new URLSearchParams({
      taskId,
      concern: input.protocol.concern,
    });
    const response = await this.fetcher(`/api/youcam/task?${params.toString()}`, {
      method: 'GET',
      headers: this.apiHeaders(false),
      credentials: 'include',
      signal: input.signal,
    });

    return readJson<TaskStatusResponse>(response);
  }

  async analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal> {
    assertValidProtocol(input.protocol);

    if (!isSupportedImageType(input.image.type)) {
      throw new YouCamProviderError({
        message: 'Choose a JPEG or PNG image.',
        code: 'unsupported_image_type',
        retryable: false,
        status: 400,
      });
    }

    if (input.image.size <= 0 || input.image.size > YOUCAM_MAX_FILE_BYTES) {
      throw new YouCamProviderError({
        message: 'Choose an image no larger than 10 MB.',
        code: 'invalid_file_size',
        retryable: false,
        status: 400,
      });
    }

    const slot = await this.requestUploadSlot(input);
    await this.uploadImage(input.image, slot, input.signal);
    const created = await this.createTask(slot.fileId, input);
    let pollingIntervalMs = created.pollingIntervalMs || DEFAULT_POLLING_INTERVAL_MS;

    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      const checked = await this.checkTask(created.taskId, input);
      if (checked.status === 'success') {
        return {
          provider: 'youcam',
          apiVersion: input.protocol.apiVersion,
          mode: input.protocol.mode,
          concern: input.protocol.concern,
          region: null,
          rawScore: checked.rawScore,
          capturedAt: input.capturedAt,
          captureQuality: 'accepted',
          ephemeralTaskReference: checked.taskId,
        };
      }

      pollingIntervalMs = checked.pollingIntervalMs || pollingIntervalMs;
      if (attempt < this.maxPollAttempts - 1) {
        await delay(pollingIntervalMs, input.signal);
      }
    }

    throw new YouCamProviderError({
      message: 'The analysis did not finish within the bounded polling window.',
      code: 'analysis_timeout',
      retryable: true,
      status: 504,
    });
  }
}
