export type CassetteMode =
  | 'index'
  | 'active'
  | 'review-due'
  | 'verdict'
  | 'classified';

export const cassetteModeStatus: Record<CassetteMode, string> = {
  index: 'TRIAL SELECTED',
  active: 'TRIAL IN PROGRESS',
  'review-due': 'READY TO COMPARE',
  verdict: 'RESULT',
  classified: 'SAVED RESULT',
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
      return `View trial for ${product ?? accession}`;
    case 'active':
      return `${expanded ? 'Close' : 'Open'} trial summary for ${product ?? accession}`;
    case 'review-due':
      return `Reveal result for ${product ?? accession}`;
    case 'verdict':
      return `${expanded ? 'Close' : 'Reveal'} result for ${product ?? accession}`;
    case 'classified':
      return `Open saved result ${accession}`;
  }
}
