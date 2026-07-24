import styles from '../styles/FaceValue.module.css';

export function DisturbanceRegister({ accession, product }: { accession: string; product: string }) {
  return (
    <section
      className={styles.variableRegister}
      data-fv-part="interference-register"
      aria-label={`Secondary cassette ${accession}, ${product}, registered as interference`}
    >
      <span>INTERFERENCE REGISTER</span>
      <strong>{accession} · {product}</strong>
      <small>SECOND CASSETTE ACTIVE IN THE SAME OBSERVATION WINDOW</small>
      <time>23 JUL</time>
    </section>
  );
}
