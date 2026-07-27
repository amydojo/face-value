import { describe, expect, it, vi } from 'vitest';
import {
  YouCamProviderError,
  YouCamSkinAnalysisProvider,
} from '../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import {
  HD_REDNESS_PROTOCOL,
  SD_REDNESS_PROTOCOL,
  assertValidProtocol,
  protocolsMatch,
  type AnalysisProtocol,
} from '../adapters/analysis/youcam/contracts';

describe('YouCamSkinAnalysisProvider', () => {
  it('uploads directly, requests only HD redness, and returns raw score evidence', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === '/api/youcam/upload-slot') {
        return Response.json({
          fileId: 'file-id-12345678',
          upload: {
            method: 'PUT',
            url: 'https://uploads.example.test/signed',
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': '4',
            },
          },
        });
      }

      if (url === 'https://uploads.example.test/signed') {
        return new Response(null, { status: 200 });
      }

      if (url === '/api/youcam/task' && init?.method === 'POST') {
        return Response.json(
          { taskId: 'task-id-12345678', pollingIntervalMs: 1_500 },
          { status: 202 },
        );
      }

      if (url.startsWith('/api/youcam/task?')) {
        return Response.json({
          status: 'success',
          taskId: 'task-id-12345678',
          concern: 'hd_redness',
          rawScore: 72.011962890625,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const provider = new YouCamSkinAnalysisProvider({
      accessToken: 'phase-a-access',
      fetcher,
    });
    const result = await provider.analyzeCapture({
      image: new Blob(['face'], { type: 'image/jpeg' }),
      fileName: 'baseline.jpg',
      protocol: HD_REDNESS_PROTOCOL,
      capturedAt: '2026-07-27T00:00:00.000Z',
    });

    expect(result).toEqual({
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      rawScore: 72.011962890625,
      capturedAt: '2026-07-27T00:00:00.000Z',
      captureQuality: 'accepted',
      providerTaskId: 'task-id-12345678',
    });

    const taskRequest = calls.find(
      ({ url, init }) => url === '/api/youcam/task' && init?.method === 'POST',
    );
    expect(JSON.parse(String(taskRequest?.init?.body))).toMatchObject({
      fileId: 'file-id-12345678',
      protocol: {
        mode: 'hd',
        concern: 'hd_redness',
        scoreType: 'raw_score',
      },
      fromCameraKit: false,
    });

    const signedUpload = calls.find(({ url }) => url.includes('uploads.example.test'));
    const signedHeaders = new Headers(signedUpload?.init?.headers);
    expect(signedHeaders.get('content-type')).toBe('image/jpeg');
    expect(signedHeaders.has('content-length')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('ui_score');
    expect(JSON.stringify(result)).not.toContain('data:image');
    expect(JSON.stringify(result)).not.toContain('signed');
  });

  it('fails after a bounded polling attempt without fabricating evidence', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/youcam/upload-slot') {
        return Response.json({
          fileId: 'file-id-12345678',
          upload: {
            method: 'PUT',
            url: 'https://uploads.example.test/signed',
            headers: { 'Content-Type': 'image/png' },
          },
        });
      }
      if (url.includes('uploads.example.test')) return new Response(null, { status: 200 });
      if (url === '/api/youcam/task' && init?.method === 'POST') {
        return Response.json(
          { taskId: 'task-id-12345678', pollingIntervalMs: 1_500 },
          { status: 202 },
        );
      }
      return Response.json({ status: 'running', pollingIntervalMs: 1_500 });
    }) as unknown as typeof fetch;

    const provider = new YouCamSkinAnalysisProvider({
      accessToken: 'phase-a-access',
      fetcher,
      maxPollAttempts: 1,
    });

    await expect(
      provider.analyzeCapture({
        image: new Blob(['face'], { type: 'image/png' }),
        protocol: HD_REDNESS_PROTOCOL,
        capturedAt: '2026-07-27T00:00:00.000Z',
      }),
    ).rejects.toMatchObject<Partial<YouCamProviderError>>({
      code: 'analysis_timeout',
      retryable: true,
    });
  });
});

describe('YouCam protocol contract', () => {
  it('freezes provider semantics and rejects HD concern drift', () => {
    expect(protocolsMatch(HD_REDNESS_PROTOCOL, HD_REDNESS_PROTOCOL)).toBe(true);
    expect(protocolsMatch(HD_REDNESS_PROTOCOL, SD_REDNESS_PROTOCOL)).toBe(false);

    const invalid: AnalysisProtocol = {
      ...HD_REDNESS_PROTOCOL,
      mode: 'sd',
    };
    expect(() => assertValidProtocol(invalid)).toThrow('Invalid YouCam analysis protocol');
  });
});
