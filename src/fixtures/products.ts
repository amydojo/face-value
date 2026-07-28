import type { Specimen } from '../domain/model';

/**
 * Phase A/B fixture compatibility only.
 *
 * Phase B.5 production registration never selects from this catalogue. Keeping
 * the fallback named makes legacy migration and explicit demo fixtures visible
 * at their call sites instead of silently coupling them to an array position.
 */
export const LEGACY_DEFAULT_SPECIMEN: Specimen = {
  id: 'one-thing',
  accession: '02',
  brand: 'FACE VALUE',
  product: '02 / ONE THING',
  volume: '30 ML',
  shelf: 'observation',
  jobOptions: ['Reduce visible redness'],
};

export const PRODUCTS: Specimen[] = [
  LEGACY_DEFAULT_SPECIMEN,
  {
    id: 'hydrating-drops',
    accession: 'C2–01',
    brand: 'FACE VALUE',
    product: 'HYDRATING DROPS',
    volume: '20 ML',
    shelf: 'cooling',
    jobOptions: ['Visible dryness', 'Surface comfort', 'Routine support'],
  },
  {
    id: 'barrier-emulsion',
    accession: 'S4–02',
    brand: 'FACE VALUE',
    product: 'BARRIER EMULSION',
    volume: '50 ML',
    shelf: 'established',
    jobOptions: ['Visible flaking', 'Surface calm', 'Routine support'],
  },
];

export function legacySpecimenFor(
  selectedSpecimenId: string,
  selectedDrawerIndex: number,
): Specimen {
  return (
    PRODUCTS.find((product) => product.id === selectedSpecimenId) ??
    PRODUCTS[selectedDrawerIndex] ??
    LEGACY_DEFAULT_SPECIMEN
  );
}
