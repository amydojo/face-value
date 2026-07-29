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
type ActiveIdentity = { label: string; aliases: string[] };

const fallbackIdentity: OracleSpecimenIdentity = {
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
  'SERUM', 'CREAM', 'LOTION', 'GEL', 'TONER', 'ESSENCE', 'AMPOULE', 'CONCENTRATE',
  'EMULSION', 'CLEANSER', 'WASH', 'MASK', 'BALM', 'MOISTURIZER', 'TREATMENT',
  'SOLUTION', 'SUSPENSION', 'FORMULA', 'COMPLEX', 'BOOSTER', 'SUPPORT', 'BARRIER',
  'REPAIR', 'BRIGHTENING', 'CALMING', 'SOOTHING', 'HYDRATING', 'EXFOLIATING',
  'RENEWAL', 'DAILY', 'NIGHT', 'ADVANCED', 'CLINICAL',
]);

const words = (value: string): string[] =>
  value.trim().toUpperCase().match(/[A-Z0-9]+(?:[.-][A-Z0-9]+)?/g) ?? [];

const normalizeForMatching = (value: string): string =>
  value
    .toUpperCase()
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compactWords = (tokens: string[], maximumCharacters: number): string => {
  if (tokens.length === 0) return '';
  const accepted: string[] = [];
  for (const token of tokens) {
    const candidate = [...accepted, token].join(' ');
    if (candidate.length > maximumCharacters) break;
    accepted.push(token);
  }
  return accepted.length > 0 ? accepted.join(' ') : tokens[0].slice(0, maximumCharacters);
};

const compactBrand = (brand: string): string => {
  const tokens = words(brand);
  const complete = tokens.join(' ');
  if (complete.length <= 8) return complete;
  if (tokens.length > 1) return `${tokens[0].slice(0, 4)} ${tokens[1].slice(0, 3)}`.trim();
  return complete.slice(0, 8);
};

const numericStrength = (identity: OracleSpecimenIdentity): string => {
  const explicit = identity.strength?.match(/\d+(?:[.,]\d+)?/);
  const embedded = identity.productName.match(/\d+(?:[.,]\d+)?\s*%/);
  return (explicit?.[0] ?? embedded?.[0] ?? '').replace(',', '.').replace(/\s*%$/, '');
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

  if (matches.some(({ label }) => label === 'AHA') && matches.some(({ label }) => label === 'BHA')) {
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
  const unresolvedPreview =
    specimenState === 'registration-preview' &&
    (!identity || visibleIdentity.productName === 'UNNAMED PRODUCT');
  const labelFooter = unresolvedPreview
    ? 'PREVIEW'
    : displayVolume
      ? `${displayVolume} · BASE`
      : 'BASE';
  const statusLocked = identityLockState === 'locked';

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
      data-accessibility-product={normalizeForMatching(
        `${visibleIdentity.brand} ${visibleIdentity.productName}`,
      )}
      data-label-layout="safe"
      aria-label={`${displayProduct}. ${visibleIdentity.brand} ${visibleIdentity.productName}`.trim()}
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
        <div className={styles.labelContent} data-label-content>
          <span className={styles.labelMetadata} data-label-group="metadata">
            <small>FV / S01</small>
            <small>SPECIMEN ID</small>
          </span>
          <b className={styles.labelProduct} data-label-group="product-identity" data-label-product>
            {displayProduct}
          </b>
          <strong
            className={styles.labelStrength}
            data-label-group="strength"
            data-label-has-strength={Boolean(displayStrength)}
          >
            {displayStrength}
          </strong>
          <span className={styles.labelSupport} data-label-group="supporting-metadata">
            TOPICAL
          </span>
          <span className={styles.labelFooter} data-label-group="footer">
            {labelFooter}
          </span>
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
