import type { RegisteredProduct, Specimen } from '../../domain/model';

export function specimenFromRegisteredProduct(
  registeredProduct: RegisteredProduct,
): Specimen {
  return {
    id: registeredProduct.id,
    accession: registeredProduct.accession,
    brand: registeredProduct.brand,
    product: registeredProduct.productName,
    volume:
      registeredProduct.volume ??
      registeredProduct.strength ??
      'REGISTERED PRODUCT',
    shelf: 'observation',
    jobOptions: [registeredProduct.assignedJob],
  };
}
