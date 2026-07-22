import type { Specimen } from '../domain/model';

export const PRODUCTS: Specimen[] = [
  {
    id: 'fermented-essence',
    accession: 'A1–03',
    brand: 'FACE VALUE',
    product: 'FERMENTED BRIGHTENING ESSENCE',
    volume: '30 ML',
    shelf: 'observation',
    jobOptions: ['Post-acne pigmentation', 'Visible tone consistency', 'Surface calm'],
  },
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
