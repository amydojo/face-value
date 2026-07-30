const HAVE_CURRENT_DATA = 2;

export type CameraKitRenderSurfaceType = 'video' | 'canvas' | 'iframe' | 'none';

export interface CameraKitRenderSurface {
  type: CameraKitRenderSurfaceType;
  width: number;
  height: number;
}

const isVisiblySized = (element: Element): boolean => {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return (
    style?.display !== 'none' &&
    style?.visibility !== 'hidden' &&
    (style?.opacity === undefined || style.opacity === '' || Number(style.opacity) > 0)
  );
};

const liveVideo = (video: HTMLVideoElement): boolean =>
  isVisiblySized(video) &&
  video.readyState >= HAVE_CURRENT_DATA &&
  video.videoWidth > 0 &&
  video.videoHeight > 0;

const surfaceFor = (mountElement: HTMLElement): CameraKitRenderSurface => {
  const videos = Array.from(mountElement.querySelectorAll('video'));
  const visibleVideo = videos.find(liveVideo);
  if (visibleVideo) {
    const rect = visibleVideo.getBoundingClientRect();
    return { type: 'video', width: rect.width, height: rect.height };
  }

  const canvas = Array.from(mountElement.querySelectorAll('canvas')).find(
    (candidate) =>
      isVisiblySized(candidate) && candidate.width > 0 && candidate.height > 0,
  );
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return { type: 'canvas', width: rect.width, height: rect.height };
  }

  const iframe = Array.from(mountElement.querySelectorAll('iframe')).find(isVisiblySized);
  if (iframe) {
    const rect = iframe.getBoundingClientRect();
    return { type: 'iframe', width: rect.width, height: rect.height };
  }

  return { type: 'none', width: 0, height: 0 };
};

export interface SafariVideoBridge {
  hasVideo(): boolean;
  hasLiveVideo(): boolean;
  hasLiveRenderSurface(sdkReportsFrame: boolean): boolean;
  getRenderSurface(): CameraKitRenderSurface;
  disconnect(): void;
}

/**
 * Camera Kit 2.5's documented module renders through an iframe/canvas on
 * Safari. A descendant video is only one possible implementation detail, so
 * readiness requires both the SDK's documented isLoaded() frame signal and a
 * connected, visible, non-zero render surface.
 */
export function createSafariVideoBridge(
  mountElement: HTMLElement,
): SafariVideoBridge {
  return {
    hasVideo: () => mountElement.querySelector('video') !== null,
    hasLiveVideo: () =>
      Array.from(mountElement.querySelectorAll('video')).some(liveVideo),
    hasLiveRenderSurface: (sdkReportsFrame) =>
      sdkReportsFrame && surfaceFor(mountElement).type !== 'none',
    getRenderSurface: () => surfaceFor(mountElement),
    disconnect: () => {
      // The SDK owns its renderer and camera tracks. sdk.close() is the single
      // teardown authority; Face Value does not mutate vendor-owned nodes.
    },
  };
}
