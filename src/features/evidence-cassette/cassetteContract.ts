export type CassetteMode =
  | 'index'
  | 'active'
  | 'review-due'
  | 'verdict'
  | 'classified';

export const cassetteModeStatus: Record<CassetteMode, string> = {
  index: 'INDEXED',
  active: 'ACTIVE OBSERVATION',
  'review-due': 'REVIEW DUE',
  verdict: 'VERDICT',
  classified: 'CLASSIFIED',
};

export function cassetteActionLabel({
  mode,
  accession,
  product,
  expanded = false,
}: {
  mode: CassetteMode;
  accession: string;
  product?: string;
  expanded?: boolean;
}) {
  switch (mode) {
    case 'index':
      return `Open evidence cassette ${accession}`;
    case 'active':
      return `${expanded ? 'Close' : 'Open'} active observation for ${accession}`;
    case 'review-due':
      return `Review verdict for ${product ?? accession}`;
    case 'verdict':
      return `${expanded ? 'Close' : 'Open'} evidence cassette ${accession}`;
    case 'classified':
      return `Open classified evidence record ${accession}`;
  }
}
