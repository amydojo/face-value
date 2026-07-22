import { useRef, type PointerEvent } from 'react';
import type { Specimen } from '../domain/model';
import { DrawerShell } from './hardware';
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
    <section className={styles.carouselRegion} data-fv-part="drawer-carousel" aria-label={`Finite drawer carousel. Drawer ${index + 1} of ${products.length}.`}>
      <div className={styles.carouselHardware} data-fv-part="carousel-hardware" onPointerDown={(event) => { startX.current = event.clientX; }} onPointerUp={onPointerUp}>
        <DrawerShell state="selected" />
      </div>
      <div className={styles.carouselControls} data-fv-part="carousel-index">
        <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous drawer">‹</button>
        <div data-fv-part="carousel-track" aria-hidden>
          {products.map((product, productIndex) => <span key={product.id} data-active={productIndex === index} />)}
        </div>
        <button type="button" onClick={onNext} disabled={index === products.length - 1} aria-label="Next drawer">›</button>
        <small aria-live="polite">DRAWER {String(index + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</small>
      </div>
      <p data-fv-part="drawer-instruction">Swipe between drawers. Open to inspect.</p>
      <button className={styles.primaryAction} data-fv-action="open-drawer" type="button" aria-label={`Open ${specimen.accession} drawer`} onClick={onOpen}>OPEN DRAWER <span aria-hidden>→</span></button>
    </section>
  );
}
