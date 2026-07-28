import type { Specimen } from '../domain/model';

export const PRODUCTS: Specimen[] = [
  {
    id: 'one-thing',
    accession: '02',
    brand: 'FACE VALUE',
    product: '02 / ONE THING',
    volume: '30 ML',
    shelf: 'observation',
    jobOptions: ['Reduce visible redness'],
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
