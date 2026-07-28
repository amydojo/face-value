const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;

const descendantVideos = (root: ParentNode): HTMLVideoElement[] =>
  Array.from(root.querySelectorAll('video'));

const videosInNode = (node: Node): HTMLVideoElement[] => {
  if (node.nodeType !== 1) return [];
  const element = node as Element;
  return [
    ...(element.tagName === 'VIDEO'
      ? [element as HTMLVideoElement]
      : []),
    ...descendantVideos(element),
  ];
};

export interface SafariVideoBridge {
  hasVideo(): boolean;
  hasLiveVideo(): boolean;
  stopOwnedTracks(): void;
  disconnect(): void;
}

export function createSafariVideoBridge(
  mountElement: HTMLElement,
): SafariVideoBridge {
  const hostWindow =
    mountElement.ownerDocument.defaultView ?? window;
  const videos = new Set<HTMLVideoElement>();
  const metadataListeners = new Map<
    HTMLVideoElement,
    () => void
  >();

  const attemptPlay = (video: HTMLVideoElement) => {
    try {
      void video.play()?.catch(() => {
        // Muted inline playback may still be deferred until Safari is ready.
      });
    } catch {
      // Safari can reject play while metadata is still settling.
    }
  };

  const hardenVideo = (video: HTMLVideoElement) => {
    if (videos.has(video)) return;
    videos.add(video);
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    const onLoadedMetadata = () => attemptPlay(video);
    metadataListeners.set(video, onLoadedMetadata);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    if (video.readyState >= HAVE_METADATA) attemptPlay(video);
  };

  descendantVideos(mountElement).forEach(hardenVideo);

  const observer = new hostWindow.MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        videosInNode(node).forEach(hardenVideo);
      }
    }
  });
  observer.observe(mountElement, { childList: true, subtree: true });

  const stopOwnedTracks = () => {
    for (const video of videos) {
      const source = video.srcObject;
      if (
        source &&
        typeof (source as MediaStream).getTracks === 'function'
      ) {
        for (const track of (source as MediaStream).getTracks()) {
          track.stop();
        }
      }
      try {
        video.srcObject = null;
      } catch {
        // A detached provider video may already have released its source.
      }
    }
  };

  const refreshVideos = () => {
    descendantVideos(mountElement).forEach(hardenVideo);
  };

  return {
    hasVideo: () => {
      refreshVideos();
      return videos.size > 0;
    },
    hasLiveVideo: () => {
      refreshVideos();
      return Array.from(videos).some(
        (video) =>
          video.isConnected &&
          video.readyState >= HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0,
      );
    },
    stopOwnedTracks,
    disconnect: () => {
      observer.disconnect();
      for (const [video, listener] of metadataListeners) {
        video.removeEventListener('loadedmetadata', listener);
      }
      metadataListeners.clear();
      videos.clear();
    },
  };
}
