import { serveProtectedDemo } from '../demo.js';

export const serveProtectedRednessCalibration = serveProtectedDemo;

export default {
  async fetch(request: Request): Promise<Response> {
    return serveProtectedRednessCalibration(request);
  },
};
