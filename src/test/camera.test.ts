import { expect, it, vi } from 'vitest';
import {
  CAMERA_CONSTRAINTS,
  ObjectUrlRegistry,
  attachStream,
  captureFrame,
  hasCameraSupport,
  metadataForCapture,
  normalizeCameraError,
  releaseStream,
  requestCamera,
  waitForVideoFrame,
} from '../adapters/camera/browserCamera';

it('detects camera support and normalizes stable errors', () => {
  expect(hasCameraSupport(undefined)).toBe(false);
  expect(hasCameraSupport({ getUserMedia: vi.fn() })).toBe(true);
  expect(normalizeCameraError({ name: 'NotAllowedError' })).toBe('denied');
  expect(normalizeCameraError({ name: 'NotFoundError' })).toBe('no_camera');
  expect(normalizeCameraError({ name: 'OverconstrainedError' })).toBe(
    'overconstrained',
  );
  expect(normalizeCameraError({ name: 'OddBrowserError' })).toBe('unknown');
});

it('requests the user-facing camera with non-fatal ideal constraints', async () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  await expect(requestCamera({ getUserMedia })).resolves.toEqual({ ok: true, stream });
  expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
  expect(CAMERA_CONSTRAINTS).toMatchObject({
    video: {
      facingMode: { ideal: 'user' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
});

it('retries without preferred constraints after an overconstrained failure', async () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  const getUserMedia = vi
    .fn()
    .mockRejectedValueOnce({ name: 'OverconstrainedError' })
    .mockResolvedValueOnce(stream);

  await expect(requestCamera({ getUserMedia })).resolves.toEqual({ ok: true, stream });
  expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
});

it('attaches a stream safely and waits for a ready frame', async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  const video = {
    srcObject: null,
    muted: false,
    playsInline: false,
    play,
    videoWidth: 640,
    videoHeight: 480,
  } as unknown as HTMLVideoElement;

  attachStream(video, stream);
  await expect(waitForVideoFrame(video)).resolves.toBeUndefined();
  expect(video.srcObject).toBe(stream);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(play).toHaveBeenCalledOnce();
});

it('stops all stream tracks', () => {
  const stop = vi.fn();
  releaseStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
  expect(stop).toHaveBeenCalledTimes(2);
});

it('captures an unmirrored JPEG frame and rejects null toBlob', async () => {
  const drawImage = vi.fn();
  const blob = new Blob(['x'], { type: 'image/jpeg' });
  const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
    expect(type).toBe('image/jpeg');
    expect(quality).toBe(0.92);
    callback(blob);
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob,
  } as unknown as HTMLCanvasElement;
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

  await expect(captureFrame(video, () => canvas)).resolves.toBe(blob);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);

  const nullCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: (callback: BlobCallback) => callback(null),
  } as unknown as HTMLCanvasElement;
  await expect(captureFrame(video, () => nullCanvas)).rejects.toThrow(
    'toBlob returned null',
  );
});

it('revokes individual and remaining temporary object URLs', () => {
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValueOnce('blob:one')
    .mockReturnValueOnce('blob:two');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const registry = new ObjectUrlRegistry();

  const first = registry.create(new Blob());
  registry.create(new Blob());
  registry.revoke(first);
  registry.revokeAll();

  expect(create).toHaveBeenCalledTimes(2);
  expect(revoke).toHaveBeenCalledWith('blob:one');
  expect(revoke).toHaveBeenCalledWith('blob:two');
});

it('documents the unmirrored analysis orientation in capture metadata', () => {
  expect(metadataForCapture('baseline', 'camera', 'image/jpeg', '2026-01-01')).toEqual(
    expect.objectContaining({
      kind: 'baseline',
      source: 'camera',
      mimeType: 'image/jpeg',
      orientationRule: 'analysis-unmirrored',
    }),
  );
});
