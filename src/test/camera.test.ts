import { expect, it, vi } from 'vitest';
import { captureFrame, hasCameraSupport, normalizeCameraError, ObjectUrlRegistry, releaseStream, requestCamera } from '../adapters/camera/browserCamera';

it('detects camera support and normalizes stable errors', () => {
  expect(hasCameraSupport(undefined)).toBe(false);
  expect(hasCameraSupport({ getUserMedia: vi.fn() })).toBe(true);
  expect(normalizeCameraError({ name: 'NotAllowedError' })).toBe('denied');
  expect(normalizeCameraError({ name: 'NotFoundError' })).toBe('no_camera');
  expect(normalizeCameraError({ name: 'OverconstrainedError' })).toBe('overconstrained');
  expect(normalizeCameraError({ name: 'OddBrowserError' })).toBe('unknown');
});

it('retries without preferred constraints after overconstrained failure', async () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockRejectedValueOnce({ name:'OverconstrainedError' }).mockResolvedValueOnce(stream);
  await expect(requestCamera({ getUserMedia })).resolves.toEqual({ ok:true, stream });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
});

it('stops all stream tracks', () => {
  const stop = vi.fn();
  releaseStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
  expect(stop).toHaveBeenCalledTimes(2);
});

it('captures an unmirrored frame and rejects null toBlob', async () => {
  const drawImage = vi.fn();
  const blob = new Blob(['x'], { type:'image/jpeg' });
  const canvas = { width:0, height:0, getContext: () => ({ drawImage }), toBlob: (cb: BlobCallback) => cb(blob) } as unknown as HTMLCanvasElement;
  const video = { videoWidth:640, videoHeight:480 } as HTMLVideoElement;
  await expect(captureFrame(video, () => canvas)).resolves.toBe(blob);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
  const nullCanvas = { width:0, height:0, getContext: () => ({ drawImage }), toBlob: (cb: BlobCallback) => cb(null) } as unknown as HTMLCanvasElement;
  await expect(captureFrame(video, () => nullCanvas)).rejects.toThrow('toBlob returned null');
});

it('revokes temporary object URLs', () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const registry = new ObjectUrlRegistry();
  const url = registry.create(new Blob());
  registry.revoke(url);
  expect(create).toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith('blob:one');
});
