import {
  YOUCAM_MAX_FILE_BYTES,
  normalizeImageContentType,
  sanitizeImageFileName,
} from '../../src/adapters/analysis/youcam/contracts.js';
import {
  YouCamServerError,
  createYouCamUploadSlot,
  errorResponse,
  jsonResponse,
  readJsonRequest,
} from '../_youcam.js';
import { requireYouCamAccess } from '../_youcam_session.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          error: {
            code: 'method_not_allowed',
            message: 'Use POST to request a YouCam upload slot.',
            retryable: false,
          },
        },
        405,
      );
    }

    const accessFailure = requireYouCamAccess(request);
    if (accessFailure) return accessFailure;

    try {
      const body = await readJsonRequest(request);
      const contentType = normalizeImageContentType(String(body.contentType ?? ''));
      const fileSize = Number(body.fileSize);

      if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > YOUCAM_MAX_FILE_BYTES) {
        throw new YouCamServerError({
          message: 'The image must be larger than 0 bytes and no larger than 10 MB.',
          status: 400,
          code: 'invalid_file_size',
          retryable: false,
        });
      }

      const fileName = sanitizeImageFileName(
        typeof body.fileName === 'string' ? body.fileName : undefined,
        contentType,
      );
      const uploadSlot = await createYouCamUploadSlot({
        fileName,
        contentType,
        fileSize,
      });

      return jsonResponse(uploadSlot);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
