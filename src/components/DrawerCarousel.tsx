import { useRef, type PointerEvent } from 'react';
import type { Specimen } from '../domain/model';
import { DrawerLabelPlate, DrawerShell, ProductSpecimen } from './hardware';
import styles from '../styles/FaceValue.module.css';

export function DrawerCarousel({ products, index, onPrevious, onNext, onOpen }: { products: Specimen[]; index: number; onPrevious: () => void; onNext: () => void; onOpen: () => void }) {
  const startX = useRef<number | null>(null);
  const specimen = products[index];
  const onPointerUp = (event: PointerEvent) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (delta > 42) onPrevious();
    if (delta < -42) onNext();
  };
  return (
    <section className={styles.carouselRegion} aria-label={`Finite drawer carousel. Drawer ${index + 1} of ${products.length}.`}>
      <div className={styles.peekLeft} aria-hidden />
      <div className={styles.peekRight} aria-hidden />
      <div className={styles.carouselHardware} onPointerDown={(e) => { startX.current = e.clientX; }} onPointerUp={onPointerUp}>
        <DrawerShell state="selected">
          <ProductSpecimen specimen={specimen} compact />
          <DrawerLabelPlate specimen={specimen} job={specimen.jobOptions[0]} state="settling" />
        </DrawerShell>
      </div>
      <div className={styles.carouselControls}>
        <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous drawer">←</button>
        <span aria-live="polite">DRAWER {index + 1} OF {products.length}</span>
        <button type="button" onClick={onNext} disabled={index === products.length - 1} aria-label="Next drawer">→</button>
      </div>
      <button className={styles.primaryAction} type="button" onClick={onOpen}>Open {specimen.accession} drawer <span aria-hidden>→</span></button>
    </section>
  );
}
