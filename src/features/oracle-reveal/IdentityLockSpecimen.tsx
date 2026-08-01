import type { CSSProperties } from 'react';
import type { OracleSpecimenIdentity } from '../../adapters/product/specimenFromRegisteredProduct';
import type {
  SpecimenRegistrationPhase,
  SpecimenRegistrationSnapshot,
} from '../../domain/specimenRegistration';
import styles from './IdentityLockSpecimen.module.css';

export type OracleTrialState =
  'empty' | 'registration-preview' | 'baseline-ready' | 'pending' | 'followup-ready';

export type { OracleSpecimenIdentity } from '../../adapters/product/specimenFromRegisteredProduct';

export interface IdentityLockSpecimenProps {
  identity: OracleSpecimenIdentity | null;
  specimenState: OracleTrialState | 'verdict';
  registration: SpecimenRegistrationSnapshot;
}

type IdentityLockState = 'loading' | 'locking' | 'locked';
type ActiveIdentity = { label: string; aliases: string[] };
type SpecimenRegistrationStyle = CSSProperties & {
  '--fv-label-blur': string;
  '--fv-label-opacity': string;
  '--fv-paper-catchlight-opacity': string;
  '--fv-scan-edge-opacity': string;
  '--fv-scan-translate': string;
  '--fv-scan-wash-opacity': string;
};

const resultReadyPresentationCss = `
[data-cassette-variant='reveal']
  [data-oracle-specimen][data-specimen-state='verdict'] {
  top: 18.5%;
  right: auto;
  left: 55%;
  isolation: isolate;
  transform: translateX(-50%);
}

[data-cassette-variant='reveal']
  [data-oracle-specimen][data-specimen-state='verdict']::before {
  position: absolute;
  top: 90.8%;
  left: -31%;
  z-index: 0;
  width: 162%;
  height: 10.5%;
  border-top: 1px solid rgba(231, 180, 116, 0.12);
  border-radius: 50%;
  background:
    radial-gradient(
      ellipse at 50% 0%,
      rgba(224, 139, 50, 0.1),
      rgba(224, 139, 50, 0.025) 38%,
      transparent 72%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(8, 7, 6, 0.32));
  box-shadow:
    0 -1px 4px rgba(222, 137, 49, 0.06),
    0 5px 10px rgba(0, 0, 0, 0.42);
  content: '';
  pointer-events: none;
}

[data-cassette-variant='reveal'][data-oracle-state='sealed']
  [data-oracle-specimen][data-specimen-state='verdict']::after {
  position: absolute;
  top: 4%;
  left: -50%;
  z-index: 0;
  width: 200%;
  height: 100%;
  border-radius: 50%;
  opacity: 0.2;
  background: radial-gradient(
    ellipse at 50% 58%,
    rgba(230, 126, 26, 0.26) 0%,
    rgba(207, 96, 18, 0.12) 33%,
    rgba(178, 76, 14, 0.035) 52%,
    transparent 74%
  );
  filter: blur(11px) brightness(0.86);
  animation: oracleSealedHoldingGlow 3.6s ease-in-out infinite;
  content: '';
  pointer-events: none;
}

[data-cassette-variant='reveal'] [data-firmware-state] {
  padding-right: 48%;
  background:
    linear-gradient(
      90deg,
      rgba(7, 7, 6, 0.9) 0%,
      rgba(7, 7, 6, 0.84) 42%,
      rgba(7, 7, 6, 0.44) 52%,
      rgba(7, 7, 6, 0.12) 100%
    ),
    radial-gradient(circle at 34% 48%, rgba(130, 88, 43, 0.1), transparent 46%);
}

@keyframes oracleSealedHoldingGlow {
  0%,
  100% {
    opacity: 0.2;
    filter: blur(11px) brightness(0.86);
  }

  50% {
    opacity: 0.42;
    filter: blur(9px) brightness(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-cassette-variant='reveal'][data-oracle-state='sealed']
    [data-oracle-specimen][data-specimen-state='verdict']::after {
    opacity: 0.27;
    filter: blur(10px) brightness(0.96);
    animation: none !important;
  }
}
`;

const fallbackIdentity: OracleSpecimenIdentity = {
  productId: null,
  accession: null,
  brand: 'UNASSIGNED',
  productName: 'FACE VALUE SPECIMEN',
  strength: null,
  volume: null,
  assignedJob: 'Reduce visible redness',
};

const activeIdentities: ActiveIdentity[] = [
  { label: 'GRANACTIVE RETINOID', aliases: ['HYDROXYPINACOLONE RETINOATE', 'GRANACTIVE RETINOID'] },
  { label: 'ETHYL VITAMIN C', aliases: ['3 O ETHYL ASCORBIC ACID', 'ETHYLATED ASCORBIC ACID'] },
  { label: 'SNAIL MUCIN', aliases: ['SNAIL SECRETION FILTRATE', 'SNAIL MUCIN'] },
  { label: 'GROWTH FACTOR', aliases: ['GROWTH FACTOR', 'EGF'] },
  { label: 'HYALURONIC ACID', aliases: ['SODIUM HYALURONATE', 'HYALURONIC ACID'] },
  { label: 'VITAMIN C', aliases: ['L ASCORBIC ACID', 'ASCORBIC ACID', 'VITAMIN C'] },
  { label: 'ARGIRELINE', aliases: ['ACETYL HEXAPEPTIDE 8', 'ARGIRELINE'] },
  { label: 'HEARTLEAF', aliases: ['HOUTTUYNIA CORDATA', 'HEARTLEAF'] },
  { label: 'MADECASSOSIDE', aliases: ['MADE CASSOSIDE', 'MADECASSOSIDE'] },
  { label: 'PANTHENOL', aliases: ['PRO VITAMIN B5', 'PANTHENOL', 'B5'] },
  { label: 'BETA-GLUCAN', aliases: ['BETA GLUCAN'] },
  { label: 'ALPHA ARBUTIN', aliases: ['ALPHA ARBUTIN', 'ARBUTIN'] },
  { label: 'LICORICE', aliases: ['LICORICE ROOT', 'GLABRIDIN'] },
  { label: 'COQ10', aliases: ['COENZYME Q10', 'UBIQUINONE'] },
  { label: 'VITAMIN E', aliases: ['TOCOPHEROL', 'VITAMIN E'] },
  { label: 'GREEN TEA', aliases: ['GREEN TEA', 'EGCG'] },
  { label: 'COPPER PEPTIDES', aliases: ['COPPER PEPTIDE', 'GHK CU'] },
  { label: 'PALMITOYL PEPTIDE', aliases: ['PALMITOYL TRIPEPTIDE'] },
  { label: 'OATMEAL', aliases: ['COLLOIDAL OATMEAL', 'OATMEAL', 'OAT'] },
  { label: 'CICA', aliases: ['CENTELLA ASIATICA', 'CICA'] },
  { label: 'CHAMOMILE', aliases: ['CHAMOMILE', 'BISABOLOL'] },
  { label: 'MUGWORT', aliases: ['ARTEMISIA', 'MUGWORT'] },
  { label: 'ALOE', aliases: ['ALOE VERA', 'ALOE'] },
  { label: 'RICE', aliases: ['RICE EXTRACT', 'RICE'] },
  { label: 'PDRN', aliases: ['POLYNUCLEOTIDE', 'PDRN'] },
  { label: 'EXOSOMES', aliases: ['EXOSOMES', 'EXOSOME'] },
  { label: 'RETINAL', aliases: ['RETINALDEHYDE', 'RETINAL'] },
  { label: 'AZELAIC', aliases: ['AZELAIC ACID', 'AZELAIC'] },
  { label: 'TRANEXAMIC', aliases: ['TRANEXAMIC ACID', 'TRANEXAMIC'] },
  { label: 'GLYCOLIC ACID', aliases: ['GLYCOLIC ACID'] },
  { label: 'LACTIC ACID', aliases: ['LACTIC ACID'] },
  { label: 'MANDELIC ACID', aliases: ['MANDELIC ACID'] },
  { label: 'SALICYLIC ACID', aliases: ['SALICYLIC ACID'] },
  { label: 'PHA', aliases: ['POLYHYDROXY ACID', 'PHA'] },
  { label: 'GLUCONOLACTONE', aliases: ['GLUCONOLACTONE'] },
  { label: 'LACTOBIONIC ACID', aliases: ['LACTOBIONIC ACID'] },
  { label: 'KOJIC ACID', aliases: ['KOJIC ACID'] },
  { label: 'FERULIC ACID', aliases: ['FERULIC ACID'] },
  { label: 'RETINOL', aliases: ['RETINOL'] },
  { label: 'RETINOID', aliases: ['RETINOID'] },
  { label: 'ADAPALENE', aliases: ['ADAPALENE'] },
  { label: 'TRETINOIN', aliases: ['TRETINOIN'] },
  { label: 'NIACINAMIDE', aliases: ['NIACINAMIDE'] },
  { label: 'CERAMIDES', aliases: ['CERAMIDES', 'CERAMIDE'] },
  { label: 'SQUALANE', aliases: ['SQUALANE'] },
  { label: 'GLYCERIN', aliases: ['GLYCEROL', 'GLYCERIN'] },
  { label: 'UREA', aliases: ['UREA'] },
  { label: 'ECTOIN', aliases: ['ECTOIN'] },
  { label: 'ALLANTOIN', aliases: ['ALLANTOIN'] },
  { label: 'CHOLESTEROL', aliases: ['CHOLESTEROL'] },
  { label: 'FATTY ACIDS', aliases: ['FATTY ACIDS'] },
  { label: 'ASCORBYL GLUCOSIDE', aliases: ['ASCORBYL GLUCOSIDE'] },
  { label: 'THD ASCORBATE', aliases: ['TETRAHEXYLDECYL ASCORBATE'] },
  { label: 'RESVERATROL', aliases: ['RESVERATROL'] },
  { label: 'BENZOYL PEROXIDE', aliases: ['BENZOYL PEROXIDE'] },
  { label: 'SULFUR', aliases: ['SULFUR'] },
  { label: 'ZINC PCA', aliases: ['ZINC PCA'] },
  { label: 'ZINC', aliases: ['ZINC'] },
  { label: 'TEA TREE', aliases: ['TEA TREE'] },
  { label: 'CLINDAMYCIN', aliases: ['CLINDAMYCIN'] },
  { label: 'DAPSONE', aliases: ['DAPSONE'] },
  { label: 'PEPTIDES', aliases: ['PEPTIDES', 'PEPTIDE'] },
  { label: 'MATRIXYL', aliases: ['MATRIXYL'] },
  { label: 'PROPOLIS', aliases: ['PROPOLIS'] },
  { label: 'HONEY', aliases: ['HONEY'] },
  { label: 'SOY', aliases: ['SOY'] },
  { label: 'SEA BUCKTHORN', aliases: ['SEA BUCKTHORN'] },
  { label: 'ZINC OXIDE', aliases: ['ZINC OXIDE'] },
  { label: 'TITANIUM DIOXIDE', aliases: ['TITANIUM DIOXIDE'] },
  { label: 'AVOBENZONE', aliases: ['AVOBENZONE'] },
  { label: 'TINOSORB S', aliases: ['TINOSORB S'] },
  { label: 'TINOSORB M', aliases: ['TINOSORB M'] },
  { label: 'UVINUL A PLUS', aliases: ['UVINUL A PLUS'] },
  { label: 'UVINUL T150', aliases: ['UVINUL T150'] },
  { label: 'MEXORYL SX', aliases: ['MEXORYL SX'] },
  { label: 'MEXORYL XL', aliases: ['MEXORYL XL'] },
  { label: 'HYDROQUINONE', aliases: ['HYDROQUINONE'] },
  { label: 'MINOXIDIL', aliases: ['MINOXIDIL'] },
  { label: 'CAFFEINE', aliases: ['CAFFEINE'] },
  { label: 'BAKUCHIOL', aliases: ['BAKUCHIOL'] },
  { label: 'DIMETHICONE', aliases: ['DIMETHICONE'] },
  { label: 'PETROLATUM', aliases: ['PETROLATUM'] },
  { label: 'AHA', aliases: ['AHA'] },
  { label: 'BHA', aliases: ['BHA'] },
].sort(
  (left, right) =>
    Math.max(...right.aliases.map((alias) => alias.length)) -
    Math.max(...left.aliases.map((alias) => alias.length)),
);

const genericFormulationWords = new Set([
  'SERUM',
  'CREAM',
  'LOTION',
  'GEL',
  'TONER',
  'ESSENCE',
  'AMPOULE',
  'CONCENTRATE',
  'EMULSION',
  'CLEANSER',
  'WASH',
  'MASK',
  'BALM',
  'MOISTURIZER',
  'TREATMENT',
  'SOLUTION',
  'SUSPENSION',
  'FORMULA',
  'COMPLEX',
  'BOOSTER',
  'SUPPORT',
  'BARRIER',
  'REPAIR',
  'BRIGHTENING',
  'CALMING',
  'SOOTHING',
  'HYDRATING',
  'EXFOLIATING',
  'RENEWAL',
  'DAILY',
  'NIGHT',
  'ADVANCED',
  'CLINICAL',
]);

const words = (value: string): string[] =>
  value
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+(?:[.-][A-Z0-9]+)?/g) ?? [];

const normalizeForMatching = (value: string): string =>
  value
    .toUpperCase()
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compactBrand = (brand: string): string => {
  const tokens = words(brand);
  const complete = tokens.join(' ');
  if (complete.length <= 8) return complete;
  if (tokens.length > 1) return `${tokens[0].slice(0, 4)} ${tokens[1].slice(0, 3)}`.trim();
  return complete.slice(0, 8);
};

const percentageStrength = (identity: OracleSpecimenIdentity): string => {
  for (const source of [identity.strength, identity.productName]) {
    const percentage = source?.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (percentage) return `${percentage[1].replace(',', '.')}%`;
  }
  return '';
};

const recognizedActives = (value: string): string[] => {
  const normalized = ` ${normalizeForMatching(value)} `;
  const matches: Array<{ label: string; index: number; specificity: number }> = [];

  for (const identity of activeIdentities) {
    const aliasMatches = identity.aliases
      .map((alias) => normalizeForMatching(alias))
      .map((alias) => ({ alias, index: normalized.indexOf(` ${alias} `) }))
      .filter((match) => match.index >= 0);
    if (aliasMatches.length === 0) continue;
    const best = aliasMatches.sort((left, right) => right.alias.length - left.alias.length)[0];
    matches.push({ label: identity.label, index: best.index, specificity: best.alias.length });
  }

  if (
    matches.some(({ label }) => label === 'AHA') &&
    matches.some(({ label }) => label === 'BHA')
  ) {
    return ['AHA', 'BHA'];
  }

  return matches
    .sort((left, right) => right.specificity - left.specificity || left.index - right.index)
    .filter((match, index, all) => all.findIndex(({ label }) => label === match.label) === index)
    .slice(0, 2)
    .map(({ label }) => label);
};

const safeFallbackProduct = (identity: OracleSpecimenIdentity): string => {
  let product = normalizeForMatching(identity.productName);
  if (product === 'UNNAMED PRODUCT') return 'UNNAMED';

  const brand = normalizeForMatching(identity.brand);
  if (brand && product.startsWith(`${brand} `)) product = product.slice(brand.length + 1);

  const productWords = words(product).filter(
    (token, index) =>
      (index > 0 || !['A', 'AN', 'THE'].includes(token)) && !genericFormulationWords.has(token),
  );

  return productWords.slice(0, 2).join(' ') || 'UNNAMED';
};

const compactProduct = (identity: OracleSpecimenIdentity): string => {
  const source = `${identity.brand} ${identity.productName}`;
  const actives = recognizedActives(source);
  return actives.length > 0 ? actives.join(' + ') : safeFallbackProduct(identity);
};

const identityNameLines = (identity: string): string[] => {
  const activeParts = identity.split(/\s+\+\s+/);
  if (activeParts.length === 2) return [activeParts[0], `+ ${activeParts[1]}`];

  const tokens = identity.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return tokens;

  let splitIndex = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < tokens.length; index += 1) {
    const left = tokens.slice(0, index).join(' ');
    const right = tokens.slice(index).join(' ');
    const difference = Math.abs(left.length - right.length);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitIndex = index;
    }
  }
  return [tokens.slice(0, splitIndex).join(' '), tokens.slice(splitIndex).join(' ')];
};

const identityLockStateFor = (
  specimenState: OracleTrialState | 'verdict',
  phase: SpecimenRegistrationPhase,
): IdentityLockState => {
  if (specimenState !== 'baseline-ready') {
    return ['pending', 'followup-ready', 'verdict'].includes(specimenState) ? 'locked' : 'loading';
  }
  if (phase === 'scanning') return 'locking';
  return ['processing', 'verified', 'ready'].includes(phase) ? 'locked' : 'loading';
};

export function IdentityLockSpecimen({
  identity,
  specimenState,
  registration,
}: IdentityLockSpecimenProps) {
  const visibleIdentity = identity ?? fallbackIdentity;
  const { phase, scanProgress, isRegistering, isVerified, isReady, reducedMotion } = registration;
  const identityLockState = identityLockStateFor(specimenState, phase);
  const registrationActive = specimenState === 'baseline-ready' && isRegistering;
  const scanActive = specimenState === 'baseline-ready' && phase === 'scanning';
  const scanState = scanActive ? (reducedMotion ? 'wash' : 'active') : 'inactive';
  const displayBrand = compactBrand(visibleIdentity.brand) || 'UNNAMED';
  const displayProduct = compactProduct(visibleIdentity);
  const displayStrength = percentageStrength(visibleIdentity);
  const nameLines = identityNameLines(displayProduct).slice(0, 2);
  const normalizedScanProgress = Math.max(0, Math.min(1, scanProgress));
  const scanResponse = Math.sin(normalizedScanProgress * Math.PI);
  const labelSoftened =
    specimenState === 'baseline-ready' && ['preparing', 'aligning'].includes(phase);
  const labelBlur = scanActive ? (1 - normalizedScanProgress) * 1.15 : labelSoftened ? 1.15 : 0;
  const labelOpacity = scanActive ? 0.64 + normalizedScanProgress * 0.36 : labelSoftened ? 0.64 : 1;
  const registrationStyle: SpecimenRegistrationStyle = {
    '--fv-label-blur': `${labelBlur.toFixed(3)}px`,
    '--fv-label-opacity': labelOpacity.toFixed(3),
    '--fv-paper-catchlight-opacity': (0.24 + scanResponse * 0.62).toFixed(3),
    '--fv-scan-edge-opacity': (0.28 + scanResponse * 0.5).toFixed(3),
    '--fv-scan-translate': `${(-26 + normalizedScanProgress * 104).toFixed(3)}px`,
    '--fv-scan-wash-opacity': (scanResponse * 0.2).toFixed(3),
  };
  const statusLocked =
    (specimenState === 'baseline-ready' && isVerified) ||
    ['pending', 'followup-ready', 'verdict'].includes(specimenState);

  return (
    <div
      className={styles.oracleSpecimen}
      style={registrationStyle}
      data-oracle-specimen
      data-specimen-renderer="identity-lock"
      data-specimen-coordinate-system="oracle-chamber"
      data-specimen-grounding={specimenState === 'verdict' ? 'registered-platform' : 'native'}
      data-specimen-state={specimenState}
      data-ingestion-phase={phase}
      data-ingestion-active={registrationActive}
      data-registration-phase={phase}
      data-registration-active={registrationActive}
      data-registration-complete={isReady}
      data-registration-id={registration.registrationId ?? ''}
      data-scan-state={scanState}
      data-scan-progress={normalizedScanProgress.toFixed(3)}
      data-identity-lock-state={identityLockState}
      data-label-scan-active={scanActive}
      data-specimen-aspect-ratio="104/136"
      data-specimen-brand={visibleIdentity.brand}
      data-specimen-id={visibleIdentity.productId ?? ''}
      data-specimen-accession={visibleIdentity.accession ?? ''}
      data-specimen-product={visibleIdentity.productName}
      data-specimen-strength={visibleIdentity.strength ?? ''}
      data-specimen-volume={visibleIdentity.volume ?? ''}
      data-specimen-job={visibleIdentity.assignedJob}
      data-display-brand={displayBrand}
      data-display-product={displayProduct}
      data-display-strength={displayStrength}
      data-accessibility-product={normalizeForMatching(
        `${visibleIdentity.brand} ${visibleIdentity.productName}`,
      )}
      data-label-layout="safe"
      aria-hidden="true"
    >
      <style
        data-oracle-result-ready-presentation
        data-completion-field-state="sealed-only"
        data-completion-field-cycle-ms="3600"
        data-completion-field-reduced-motion="static"
        data-completion-field-scientific-meaning="none"
      >
        {resultReadyPresentationCss}
      </style>
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
      <i className={styles.alignmentFrame} data-specimen-layer="alignment-frame" />
      <i
        className={styles.labelScanBeam}
        data-label-scan-beam
        data-label-scan-state={scanState}
        data-scan-progress={normalizedScanProgress.toFixed(3)}
      />
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
        <div className={styles.labelContent} data-label-content>
          <b
            className={styles.labelProduct}
            data-label-group="product-identity"
            data-label-product
            data-label-name-lines={nameLines.length}
          >
            {nameLines.map((line, index) => (
              <span data-label-name-line key={`${line}-${index}`}>
                {index > 0 ? ' ' : ''}
                {line}
              </span>
            ))}
          </b>
          <strong
            className={styles.labelStrength}
            data-label-group="strength"
            data-label-has-strength={Boolean(displayStrength)}
          >
            {displayStrength}
          </strong>
        </div>
        <i
          className={styles.labelStatus}
          data-label-status-marker
          data-label-status-state={statusLocked ? 'locked' : 'hidden'}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
