import type { ProductPlacement } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

const placements: ProductPlacement[] = ['established', 'cooling', 'paused', 'useful_elsewhere', 'retry_alone', 'released'];

export function AccessibleMovementMenu({ selected, onSelect }: { selected: ProductPlacement; onSelect: (placement: ProductPlacement) => void }) {
  return (
    <fieldset className={styles.movementMenu}>
      <legend>Choose final shelf placement</legend>
      {placements.map((placement) => (
        <label key={placement}>
          <input type="radio" name="placement" value={placement} checked={selected === placement} onChange={() => onSelect(placement)} />
          <span>{placement.replaceAll('_', ' ')}</span>
        </label>
      ))}
    </fieldset>
  );
}
