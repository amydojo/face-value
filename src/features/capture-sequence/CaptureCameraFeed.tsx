import type { RefObject } from 'react';
import styles from './CaptureSequence.module.css';

export function CaptureCameraFeed({
  mountRef,
  capturedImage,
  fixture,
  previewLive,
}: {
  mountRef: RefObject<HTMLDivElement | null>;
  capturedImage: string | null;
  fixture: boolean;
  previewLive: boolean;
}) {
  return (
    <div
      className={styles.cameraFeed}
      data-capture-camera-feed
      data-fixture={fixture}
      data-preview-live={previewLive}
      data-frame-frozen={capturedImage ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div ref={mountRef} className={styles.cameraKitMount} data-camera-kit-mount />
      <div className={styles.syntheticFeed} data-capture-synthetic-feed />
      {capturedImage && (
        <img
          className={styles.capturedFrame}
          src={capturedImage}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      <div className={styles.cameraVignette} />
    </div>
  );
}
