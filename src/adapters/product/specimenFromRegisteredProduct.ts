import type { EvidenceRecordData, RegisteredProduct, Specimen } from '../../domain/model';

export interface OracleSpecimenIdentity {
  productId: string | null;
  accession: string | null;
  brand: string;
  productName: string;
  strength: string | null;
  volume: string | null;
  assignedJob: string;
}

const nonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function specimenFromRegisteredProduct(registeredProduct: RegisteredProduct): Specimen {
  return {
    id: registeredProduct.id,
    accession: registeredProduct.accession,
    brand: registeredProduct.brand,
    product: registeredProduct.productName,
    volume: registeredProduct.volume ?? registeredProduct.strength ?? 'REGISTERED PRODUCT',
    shelf: 'observation',
    jobOptions: [registeredProduct.assignedJob],
  };
}

export function oracleSpecimenIdentityFromRegisteredProduct(
  registeredProduct: RegisteredProduct,
): OracleSpecimenIdentity {
  return {
    productId: registeredProduct.id,
    accession: registeredProduct.accession,
    brand: registeredProduct.brand,
    productName: registeredProduct.productName,
    strength: registeredProduct.strength,
    volume: registeredProduct.volume,
    assignedJob: registeredProduct.assignedJob,
  };
}

export function oracleSpecimenIdentityFromEvidenceRecord(
  record: EvidenceRecordData,
): OracleSpecimenIdentity {
  return {
    productId: nonEmpty(record.specimenId),
    accession: nonEmpty(record.accession),
    brand: nonEmpty(record.productBrand) ?? 'UNRECORDED BRAND',
    productName: nonEmpty(record.product) ?? 'UNRECORDED PRODUCT',
    strength: nonEmpty(record.productStrength),
    volume: nonEmpty(record.productVolume),
    assignedJob: nonEmpty(record.job) ?? 'UNRECORDED JOB',
  };
}

export function oracleSpecimenIdentityLabel(identity: OracleSpecimenIdentity): string {
  return [identity.brand, identity.productName, identity.strength, identity.volume]
    .filter((value): value is string => Boolean(value))
    .join(', ');
}
