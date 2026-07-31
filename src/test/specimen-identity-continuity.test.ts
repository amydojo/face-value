import { describe, expect, it } from 'vitest';
import {
  oracleSpecimenIdentityFromEvidenceRecord,
  oracleSpecimenIdentityFromRegisteredProduct,
} from '../adapters/product/specimenFromRegisteredProduct';
import type { EvidenceRecordData, RegisteredProduct } from '../domain/model';

const laneigeProduct: RegisteredProduct = {
  id: 'registered-laneige-ceramide',
  accession: 'SPECIMEN 27',
  brand: 'Laneige',
  productName: 'Cream Skin Cerapeptide Refiner',
  strength: 'Ceramide complex 4.2%',
  volume: '150 ml',
  assignedJob: 'Reduce visible redness',
  protocolId: 'youcam-redness-v1',
  createdAt: '2026-07-01T12:00:00.000Z',
};

const savedRecord: EvidenceRecordData = {
  id: 'ER-LANEIGE-1',
  specimenId: laneigeProduct.id,
  accession: laneigeProduct.accession,
  product: laneigeProduct.productName,
  productBrand: laneigeProduct.brand,
  productStrength: laneigeProduct.strength,
  productVolume: laneigeProduct.volume,
  job: laneigeProduct.assignedJob,
  observationWindow: '2026-07-01T12:00:00.000Z to 2026-07-15T12:00:00.000Z',
  comparison: 'comparable',
  finding: 'A small favorable shift showed up.',
  nonFinding: 'The product result remains bounded.',
  confidence: 'possible',
  disturbance: 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary: 'Directional evidence only.',
  createdAt: '2026-07-15T12:30:00.000Z',
  includesFaceImage: false,
};

describe('canonical Oracle specimen identity adapters', () => {
  it('passes every registered product identity field without reconstructing verdict copy', () => {
    expect(oracleSpecimenIdentityFromRegisteredProduct(laneigeProduct)).toEqual({
      productId: 'registered-laneige-ceramide',
      accession: 'SPECIMEN 27',
      brand: 'Laneige',
      productName: 'Cream Skin Cerapeptide Refiner',
      strength: 'Ceramide complex 4.2%',
      volume: '150 ml',
      assignedJob: 'Reduce visible redness',
    });
  });

  it('reconstructs restored presentation only from the immutable saved snapshot', () => {
    expect(oracleSpecimenIdentityFromEvidenceRecord(savedRecord)).toEqual(
      oracleSpecimenIdentityFromRegisteredProduct(laneigeProduct),
    );
  });

  it('keeps legacy records readable with honest optional-field fallbacks', () => {
    const legacy = oracleSpecimenIdentityFromEvidenceRecord({
      ...savedRecord,
      specimenId: '',
      accession: '',
      productBrand: undefined,
      productStrength: undefined,
      productVolume: undefined,
    });
    expect(legacy).toMatchObject({
      productId: null,
      accession: null,
      brand: 'UNRECORDED BRAND',
      productName: laneigeProduct.productName,
      strength: null,
      volume: null,
      assignedJob: 'Reduce visible redness',
    });
    expect(legacy.brand).not.toBe('FACE VALUE');
  });
});
