import styles from './FaceValueActuator.module.css';

const actuatorAssetRoot = '/face-value-actuator';
const housingArtwork = `${actuatorAssetRoot}/housing.svg`;
const bezelArtwork = `${actuatorAssetRoot}/bezel.svg`;
const recessArtwork = `${actuatorAssetRoot}/recess.svg`;
const capturedCapArtwork = `${actuatorAssetRoot}/cap-captured.svg`;
const readyCapArtwork = `${actuatorAssetRoot}/cap-ready.svg`;
const restCapArtwork = `${actuatorAssetRoot}/cap-rest.svg`;
const scanningCapArtwork = `${actuatorAssetRoot}/cap-scanning.svg`;
const capturedGlossArtwork = `${actuatorAssetRoot}/gloss-captured.svg`;
const readyGlossArtwork = `${actuatorAssetRoot}/gloss-ready.svg`;
const restGlossArtwork = `${actuatorAssetRoot}/gloss-rest.svg`;
const scanningGlossArtwork = `${actuatorAssetRoot}/gloss-scanning.svg`;
const readyRingArtwork = `${actuatorAssetRoot}/ring-ready.svg`;
const scanningRingArtwork = `${actuatorAssetRoot}/ring-scanning.svg`;

export type FaceValueActuatorState = 'rest' | 'ready' | 'scanning' | 'captured';

export type FaceValueActuatorProps = {
  state?: FaceValueActuatorState;
  className?: string;
  decorative?: boolean;
};

const capArtworkByState = {
  rest: restCapArtwork,
  ready: readyCapArtwork,
  scanning: scanningCapArtwork,
  captured: capturedCapArtwork,
} satisfies Record<FaceValueActuatorState, string>;

const glossArtworkByState = {
  rest: restGlossArtwork,
  ready: readyGlossArtwork,
  scanning: scanningGlossArtwork,
  captured: capturedGlossArtwork,
} satisfies Record<FaceValueActuatorState, string>;

const capArtworkClassByState = {
  rest: styles.capArtworkRest,
  ready: styles.capArtworkReady,
  scanning: styles.capArtworkScanning,
  captured: styles.capArtworkCaptured,
} satisfies Record<FaceValueActuatorState, string>;

function artwork(src: string) {
  return (
    <span
      className={styles.artwork}
      style={{ backgroundImage: `url("${src}")` }}
      aria-hidden="true"
    />
  );
}

export function FaceValueActuator({
  state = 'rest',
  className,
  decorative = true,
}: FaceValueActuatorProps) {
  const rootClassName = className ? `${styles.actuator} ${className}` : styles.actuator;
  const captured = state === 'captured';

  return (
    <span
      className={rootClassName}
      data-face-value-actuator
      data-actuator-state={state}
      data-actuator-active={state === 'scanning' || undefined}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `Face Value actuator: ${state}`}
    >
      <span className={`${styles.layer} ${styles.housing}`} data-actuator-layer="housing">
        {artwork(housingArtwork)}
      </span>
      <span className={`${styles.layer} ${styles.bezel}`} data-actuator-layer="bezel">
        {artwork(bezelArtwork)}
      </span>
      <span className={`${styles.layer} ${styles.recess}`} data-actuator-layer="recess">
        {artwork(recessArtwork)}
      </span>
      <span
        className={`${styles.layer} ${styles.cap} ${captured ? styles.capCaptured : ''}`}
        data-actuator-cap
        data-actuator-cap-depth={captured ? 'captured' : 'standard'}
      >
        <span className={`${styles.capArtwork} ${capArtworkClassByState[state]}`}>
          {artwork(capArtworkByState[state])}
        </span>
      </span>
      <span
        className={`${styles.layer} ${styles.capGloss} ${captured ? styles.capCaptured : ''}`}
        data-actuator-layer="cap-gloss"
      >
        {artwork(glossArtworkByState[state])}
      </span>
      {state === 'ready' && (
        <span
          className={`${styles.layer} ${styles.readyRing}`}
          data-actuator-ring="ready"
          aria-hidden="true"
        >
          <span className={`${styles.ringArtwork} ${styles.readyRingArtwork}`}>
            {artwork(readyRingArtwork)}
          </span>
        </span>
      )}
      {state === 'scanning' && (
        <span
          className={`${styles.layer} ${styles.scanningRing}`}
          data-actuator-ring="scanning"
          aria-hidden="true"
        >
          <span className={`${styles.ringArtwork} ${styles.scanningRingArtwork}`}>
            {artwork(scanningRingArtwork)}
          </span>
        </span>
      )}
    </span>
  );
}
