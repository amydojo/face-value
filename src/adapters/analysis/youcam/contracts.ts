export const YOUCAM_API_VERSION = '2.1' as const;
export const YOUCAM_HD_REDNESS_CONCERN = 'hd_redness' as const;
export const YOUCAM_SD_REDNESS_CONCERN = 'redness' as const;
export const YOUCAM_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type YouCamMode = 'hd' | 'sd';
export type YouCamRednessConcern =
  | typeof YOUCAM_HD_REDNESS_CONCERN
  | typeof YOUCAM_SD_REDNESS_CONCERN;

export interface AnalysisProtocol {
  provider: 'youcam';
  apiVersion: typeof YOUCAM_API_VERSION;
  mode: YouCamMode;
  concern: YouCamRednessConcern;
  region: null;
  scoreType: 'raw_score';
  captureProtocolVersion: string;
}

export interface AnalyzeCaptureInput {
  image: Blob;
  fileName?: string;
  protocol: AnalysisProtocol;
  capturedAt: string;
  role?: 'baseline' | 'followup';
  fromCameraKit?: boolean;
  signal?: AbortSignal;
}

export interface SkinAnalysisSignal {
  provider: 'youcam';
  apiVersion: typeof YOUCAM_API_VERSION;
  mode: YouCamMode;
  concern: YouCamRednessConcern;
  region: null;
  rawScore: number;
  capturedAt: string;
  captureQuality: 'accepted';
  ephemeralTaskReference: string;
}

export interface SkinAnalysisProvider {
  analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal>;
}

export interface UploadSlotResponse {
  fileId: string;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
  };
}

export interface CreateTaskResponse {
  taskId: string;
  pollingIntervalMs: number;
}

export type TaskStatusResponse =
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

export const HD_REDNESS_PROTOCOL: AnalysisProtocol = {
  provider: 'youcam',
  apiVersion: YOUCAM_API_VERSION,
  mode: 'hd',
  concern: YOUCAM_HD_REDNESS_CONCERN,
  region: null,
  scoreType: 'raw_score',
  captureProtocolVersion: 'face-value-youcam-1',
};

export const SD_REDNESS_PROTOCOL: AnalysisProtocol = {
  ...HD_REDNESS_PROTOCOL,
  mode: 'sd',
  concern: YOUCAM_SD_REDNESS_CONCERN,
};

export function assertValidProtocol(protocol: AnalysisProtocol): void {
  const matchesMode =
    (protocol.mode === 'hd' && protocol.concern === YOUCAM_HD_REDNESS_CONCERN) ||
    (protocol.mode === 'sd' && protocol.concern === YOUCAM_SD_REDNESS_CONCERN);

  if (
    protocol.provider !== 'youcam' ||
    protocol.apiVersion !== YOUCAM_API_VERSION ||
    protocol.region !== null ||
    protocol.scoreType !== 'raw_score' ||
    !protocol.captureProtocolVersion ||
    !matchesMode
  ) {
    throw new Error('Invalid YouCam analysis protocol');
  }
}

export function protocolsMatch(
  baseline: AnalysisProtocol,
  followUp: AnalysisProtocol,
): boolean {
  return (
    baseline.provider === followUp.provider &&
    baseline.apiVersion === followUp.apiVersion &&
    baseline.mode === followUp.mode &&
    baseline.concern === followUp.concern &&
    baseline.region === followUp.region &&
    baseline.scoreType === followUp.scoreType &&
    baseline.captureProtocolVersion === followUp.captureProtocolVersion
  );
}

export function isSupportedImageType(type: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png'].includes(type.toLowerCase());
}

export function normalizeImageContentType(type: string): 'image/jpeg' | 'image/png' {
  const normalized = type.toLowerCase();
  if (normalized === 'image/png') return 'image/png';
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'image/jpeg';
  throw new Error('YouCam accepts JPEG or PNG images only');
}

export function sanitizeImageFileName(
  name: string | undefined,
  contentType: 'image/jpeg' | 'image/png',
): string {
  const extension = contentType === 'image/png' ? '.png' : '.jpg';
  const base = (name ?? `face-value-capture${extension}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  if (!base) return `face-value-capture${extension}`;
  if (/\.(jpe?g|png)$/i.test(base)) return base;
  return `${base}${extension}`;
}
