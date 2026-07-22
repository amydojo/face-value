import styles from '../styles/FaceValue.module.css';

export function DisturbanceRegister({ accession, product }: { accession: string; product: string }) {
  return (
    <section className={styles.variableRegister} aria-label={`New active product ${accession}, ${product}`}>
      <span>NEW ACTIVE PRODUCT</span>
      <strong>{accession} · {product}</strong>
    </section>
  );
}
