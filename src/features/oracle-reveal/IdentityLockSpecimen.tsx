import styles from './IdentityLockSpecimen.module.css';

export type SpecimenIngestionPhase =
  'idle' | 'materializing' | 'loading' | 'locking' | 'confirming' | 'ready';

export type OracleTrialState =
  'empty' | 'registration-preview' | 'baseline-ready' | 'pending' | 'followup-ready';

export interface OracleSpecimenIdentity {
  brand: string;
  productName: string;
  strength: string | null;
  volume: string | null;
  assignedJob: 'Reduce visible redness';
}

export interface IdentityLockSpecimenProps {
  identity: OracleSpecimenIdentity | null;
  specimenState: OracleTrialState | 'verdict';
  phase: SpecimenIngestionPhase;
}

type IdentityLockState = 'loading' | 'locking' | 'locked';

const fallbackIdentity: OracleSpecimenIdentity = {
  brand: 'UNASSIGNED',
  productName: 'FACE VALUE SPECIMEN',
  strength: null,
  volume: null,
  assignedJob: 'Reduce visible redness',
};

const words = (value: string): string[] =>
  value
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+(?:[.-][A-Z0-9]+)?/g) ?? [];

const compactWords = (tokens: string[], maximumCharacters: number): string => {
  if (tokens.length === 0) return '';
  const accepted: string[] = [];
  for (const token of tokens) {
    const candidate = [...accepted, token].join(' ');
    if (candidate.length > maximumCharacters) break;
    accepted.push(token);
  }
  if (accepted.length > 0) return accepted.join(' ');
  return tokens[0].slice(0, maximumCharacters);
};

const compactBrand = (brand: string): string => {
  const tokens = words(brand);
  const complete = tokens.join(' ');
  if (complete.length <= 8) return complete;
  if (tokens.length > 1) {
    return `${tokens[0].slice(0, 4)} ${tokens[1].slice(0, 3)}`.trim();
  }
  return complete.slice(0, 8);
};

const numericStrength = (identity: OracleSpecimenIdentity): string => {
  const explicit = identity.strength?.match(/\d+(?:[.,]\d+)?/);
  const embedded = identity.productName.match(/\d+(?:[.,]\d+)?\s*%/);
  return (explicit?.[0] ?? embedded?.[0] ?? '').replace(',', '.').replace(/\s*%$/, '');
};

const compactProduct = (identity: OracleSpecimenIdentity): string => {
  let product = identity.productName.trim().toUpperCase();
  const brand = identity.brand.trim().toUpperCase();
  if (brand && product.startsWith(`${brand} `)) {
    product = product.slice(brand.length + 1);
  }
  product = product.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');

  const productWords = words(product).filter(
    (token, index) => index > 0 || !['A', 'AN', 'THE'].includes(token),
  );
  const topicalIndex = productWords.indexOf('TOPICAL');
  const acidIndex = productWords.indexOf('ACID');
  const evidenceWords =
    topicalIndex > 0
      ? productWords.slice(0, topicalIndex)
      : acidIndex >= 0 && acidIndex < 3
        ? productWords.slice(0, acidIndex + 1)
        : productWords.slice(0, 2);

  return compactWords(evidenceWords, 13) || 'UNNAMED';
};

const compactVolume = (volume: string | null): string => {
  if (!volume?.trim()) return '';
  const normalized = volume.trim().toUpperCase().replace(/\s+/g, ' ');
  const measured = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ML|FL OZ|OZ|G)\b/);
  if (measured) return `${measured[1].replace(',', '.')} ${measured[2]}`;
  return compactWords(words(normalized), 8);
};

const identityLockStateFor = (
  specimenState: OracleTrialState | 'verdict',
  phase: SpecimenIngestionPhase,
): IdentityLockState => {
  if (specimenState !== 'baseline-ready') {
    return ['pending', 'followup-ready', 'verdict'].includes(specimenState) ? 'locked' : 'loading';
  }
  if (phase === 'locking') return 'locking';
  return phase === 'confirming' || phase === 'ready' ? 'locked' : 'loading';
};

export function IdentityLockSpecimen({
  identity,
  specimenState,
  phase,
}: IdentityLockSpecimenProps) {
  const visibleIdentity = identity ?? fallbackIdentity;
  const identityLockState = identityLockStateFor(specimenState, phase);
  const ingestionActive = specimenState === 'baseline-ready' && !['idle', 'ready'].includes(phase);
  const scanActive = specimenState === 'baseline-ready' && phase === 'locking';
  const displayBrand = compactBrand(visibleIdentity.brand) || 'UNNAMED';
  const displayProduct = compactProduct(visibleIdentity);
  const displayStrength = numericStrength(visibleIdentity);
  const displayVolume = compactVolume(visibleIdentity.volume);

  return (
    <div
      className={styles.oracleSpecimen}
      data-oracle-specimen
      data-specimen-state={specimenState}
      data-ingestion-phase={phase}
      data-ingestion-active={ingestionActive}
      data-identity-lock-state={identityLockState}
      data-label-scan-active={scanActive}
      data-specimen-aspect-ratio="104/136"
      data-specimen-brand={visibleIdentity.brand}
      data-specimen-product={visibleIdentity.productName}
      data-specimen-strength={visibleIdentity.strength ?? ''}
      data-specimen-volume={visibleIdentity.volume ?? ''}
      data-display-brand={displayBrand}
      data-display-product={displayProduct}
      data-display-strength={displayStrength}
      aria-hidden="true"
    >
      <i className={styles.contactShadow} data-specimen-layer="contact-shadow" />
      <i className={styles.amberGroundBounce} data-specimen-layer="amber-ground-bounce" />
      <span className={styles.shoulderForm} data-specimen-layer="shoulder-form" />
      <span className={styles.bottleBody} data-specimen-layer="bottle-body" />
      <span className={styles.internalProductFill} data-specimen-layer="internal-product-fill" />
      <span className={styles.baseThickness} data-specimen-layer="base-thickness" />
      <i className={styles.centerSheen} data-specimen-layer="center-sheen" />
      <i className={styles.warmChamberBounce} data-specimen-layer="warm-chamber-bounce" />
      <i className={styles.productMeniscus} data-specimen-layer="product-meniscus" />
      <i className={styles.baseReflection} data-specimen-layer="base-reflection" />
      <i className={styles.leftRim} data-specimen-layer="left-rim" />
      <i className={styles.rightRim} data-specimen-layer="right-rim" />
      <i className={styles.shoulderHighlight} data-specimen-layer="shoulder-highlight" />
      <span className={styles.collar} data-specimen-layer="collar" />
      <i className={styles.capContactSeam} data-specimen-layer="cap-contact-seam" />
      <span className={styles.cap} data-specimen-layer="cap" />
      <i className={styles.capTopPlane} data-specimen-layer="cap-top-plane" />
      <span className={styles.evidenceLockStrip} data-specimen-layer="evidence-lock-strip" />
      <i className={styles.labelCornerLiftShadow} data-specimen-layer="label-corner-lift-shadow" />
      <div className={styles.thermalEvidenceLabel} data-specimen-layer="thermal-evidence-label">
        <i className={styles.paperTone} />
        <i className={styles.unresolvedVeil} />
        <i className={styles.leftPaperCatchlight} />
        <i className={styles.wrappedPaperEdge} />
        <i className={styles.lowerAdhesiveLift} />
        <i className={styles.wrapShade} />
        <i className={styles.adhesivePressureLine} />
        <i className={styles.registrationNotch} />
        <i className={styles.lockReflection} />
        <i
          className={styles.labelScanBeam}
          data-label-scan-beam
          data-label-scan-state={scanActive ? 'active' : 'inactive'}
        />
        <span className={styles.labelMetadata} data-label-group="metadata">
          <small>FV / S01</small>
          <small data-label-brand>{displayBrand}</small>
        </span>
        <b className={styles.labelProduct} data-label-group="product-identity" data-label-product>
          {displayProduct}
        </b>
        <strong
          className={styles.labelStrength}
          data-label-group="strength"
          data-label-has-strength={Boolean(displayStrength)}
        >
          {displayStrength || '—'}
        </strong>
        <span className={styles.labelSupport} data-label-group="supporting-metadata">
          CLINICAL TOPICAL
        </span>
        <span className={styles.labelFooter} data-label-group="footer">
          {displayVolume ? `${displayVolume} · ` : ''}BASELINE
        </span>
        <em className={styles.labelLock} data-label-group="lock-confirmation">
          LOCK
        </em>
      </div>
    </div>
  );
}
