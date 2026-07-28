import {
  YouCamServerError,
  errorResponse,
  jsonResponse,
  readJsonRequest,
} from '../_youcam.js';
import { createYouCamDemoSession } from '../_youcam_session.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          error: {
            code: 'method_not_allowed',
            message: 'Use POST to open the protected YouCam demo session.',
            retryable: false,
          },
        },
        405,
      );
    }

    try {
      const body = await readJsonRequest(request);
      if (typeof body.token !== 'string' || !body.token.trim()) {
        throw new YouCamServerError({
          message: 'A protected demo token is required.',
          status: 400,
          code: 'invalid_demo_token',
          retryable: false,
        });
      }
      return createYouCamDemoSession(body.token.trim());
    } catch (error) {
      return errorResponse(error);
    }
  },
};
