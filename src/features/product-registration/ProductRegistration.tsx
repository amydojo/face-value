import { useRef, useState, type FormEvent } from 'react';
import {
  validateProductRegistration,
  type ProductRegistrationErrors,
  type ProductRegistrationInput,
} from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';

export interface ProductRegistrationProps {
  value: ProductRegistrationInput;
  disabled?: boolean;
  exiting?: boolean;
  submitLabel?: string;
  onChange(value: ProductRegistrationInput): void;
  onRegister(value: ProductRegistrationInput): void;
}

export function ProductRegistration({
  value,
  disabled = false,
  exiting = false,
  submitLabel = 'REGISTER & LOAD',
  onChange,
  onRegister,
}: ProductRegistrationProps) {
  const [errors, setErrors] = useState<ProductRegistrationErrors>({});
  const brandRef = useRef<HTMLInputElement | null>(null);
  const productNameRef = useRef<HTMLInputElement | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const nextErrors = validateProductRegistration(value);
    setErrors(nextErrors);
    if (nextErrors.brand) {
      brandRef.current?.focus();
      return;
    }
    if (nextErrors.productName) {
      productNameRef.current?.focus();
      return;
    }
    onRegister(value);
  };

  return (
    <section
      className={styles.registrationPanel}
      data-registration-panel
      data-registration-panel-state={exiting ? 'exiting' : 'active'}
      aria-busy={disabled}
    >
      <p className={styles.eyebrow}>REGISTER ONE PRODUCT</p>
      <h2>Give the specimen an identity.</h2>
      <p>Strength and volume are optional.</p>

      <form className={styles.registrationForm} onSubmit={submit} noValidate>
        <label>
          <span>Brand</span>
          <input
            ref={brandRef}
            name="brand"
            autoComplete="organization"
            value={value.brand}
            disabled={disabled}
            aria-invalid={Boolean(errors.brand)}
            aria-describedby={errors.brand ? 'brand-error' : undefined}
            onChange={(event) => onChange({ ...value, brand: event.target.value })}
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
            value={value.productName}
            disabled={disabled}
            aria-invalid={Boolean(errors.productName)}
            aria-describedby={errors.productName ? 'product-name-error' : undefined}
            onChange={(event) => onChange({ ...value, productName: event.target.value })}
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
              value={value.strength ?? ''}
              disabled={disabled}
              placeholder="10%"
              onChange={(event) => onChange({ ...value, strength: event.target.value })}
            />
          </label>
          <label>
            <span>Volume</span>
            <input
              name="volume"
              value={value.volume ?? ''}
              disabled={disabled}
              placeholder="30 ml"
              onChange={(event) => onChange({ ...value, volume: event.target.value })}
            />
          </label>
        </div>

        <fieldset className={styles.registrationJob} disabled={disabled}>
          <legend>ITS JOB</legend>
          <label>
            <input type="radio" name="supported-job" checked readOnly />
            <span>
              <strong>REDUCE VISIBLE REDNESS</strong>
              <small>The one supported job in this protocol</small>
            </span>
          </label>
        </fieldset>

        <button type="submit" className={styles.primaryAction} disabled={disabled}>
          <span>{submitLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
