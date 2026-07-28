import {
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { RegisteredProduct } from '../../domain/model';
import {
  validateProductRegistration,
  type ProductRegistrationErrors,
  type ProductRegistrationInput,
} from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';

export function ProductRegistration({
  existingProduct,
  onRegister,
  onBack,
}: {
  existingProduct?: RegisteredProduct | null;
  onRegister(input: ProductRegistrationInput): void;
  onBack(): void;
}) {
  const [brand, setBrand] = useState(existingProduct?.brand ?? '');
  const [productName, setProductName] = useState(
    existingProduct?.productName ?? '',
  );
  const [strength, setStrength] = useState(existingProduct?.strength ?? '');
  const [volume, setVolume] = useState(existingProduct?.volume ?? '');
  const [errors, setErrors] = useState<ProductRegistrationErrors>({});
  const brandRef = useRef<HTMLInputElement | null>(null);
  const productNameRef = useRef<HTMLInputElement | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = { brand, productName, strength, volume };
    const nextErrors = validateProductRegistration(input);
    setErrors(nextErrors);
    if (nextErrors.brand) {
      brandRef.current?.focus();
      return;
    }
    if (nextErrors.productName) {
      productNameRef.current?.focus();
      return;
    }
    onRegister(input);
  };

  return (
    <section
      className={styles.registrationScreen}
      data-fv-screen="product-registration"
    >
      <button type="button" className={styles.textButton} onClick={onBack}>
        ← Back
      </button>
      <p className={styles.eyebrow}>REGISTER ONE PRODUCT</p>
      <h1 data-stage-focus tabIndex={-1}>
        What are you putting on trial?
      </h1>
      <p>
        Add only what Face Value cannot observe. You can leave strength and
        volume blank.
      </p>

      <form className={styles.registrationForm} onSubmit={submit} noValidate>
        <label>
          <span>Brand</span>
          <input
            ref={brandRef}
            name="brand"
            autoComplete="organization"
            value={brand}
            aria-invalid={Boolean(errors.brand)}
            aria-describedby={errors.brand ? 'brand-error' : undefined}
            onChange={(event) => setBrand(event.target.value)}
          />
          {errors.brand && (
            <small id="brand-error" role="alert">
              {errors.brand}
            </small>
          )}
        </label>
        <label>
          <span>Product name</span>
          <input
            ref={productNameRef}
            name="product-name"
            autoComplete="off"
            value={productName}
            aria-invalid={Boolean(errors.productName)}
            aria-describedby={
              errors.productName ? 'product-name-error' : undefined
            }
            onChange={(event) => setProductName(event.target.value)}
          />
          {errors.productName && (
            <small id="product-name-error" role="alert">
              {errors.productName}
            </small>
          )}
        </label>
        <div className={styles.registrationOptional}>
          <label>
            <span>Strength or concentration</span>
            <input
              name="strength"
              value={strength}
              placeholder="10%"
              onChange={(event) => setStrength(event.target.value)}
            />
          </label>
          <label>
            <span>Volume</span>
            <input
              name="volume"
              value={volume}
              placeholder="30 ml"
              onChange={(event) => setVolume(event.target.value)}
            />
          </label>
        </div>

        <fieldset className={styles.registrationJob}>
          <legend>ITS JOB</legend>
          <label>
            <input
              type="radio"
              name="supported-job"
              checked
              readOnly
            />
            <span>
              <strong>REDUCE VISIBLE REDNESS</strong>
              <small>The one supported job in this protocol</small>
            </span>
          </label>
        </fieldset>

        <button type="submit" className={styles.primaryAction}>
          <span>REGISTER PRODUCT</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
