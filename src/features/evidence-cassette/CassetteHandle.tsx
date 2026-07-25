import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { CassetteMode } from './cassetteContract';
import { cassetteActionLabel } from './cassetteContract';

const DRAG_INTENT_PX = 5;
const DRAG_ACTIVATION_PX = 28;

export interface CassetteHandleProps {
  mode: CassetteMode;
  accession: string;
  product?: string;
  label?: string;
  expanded?: boolean;
  busy?: boolean;
  describedBy?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onActivate: () => void;
  onEscape?: () => void;
}

export function CassetteHandle({
  mode,
  accession,
  product,
  label,
  expanded = false,
  busy = false,
  describedBy,
  className,
  style,
  children,
  onActivate,
  onEscape,
}: CassetteHandleProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    activated: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const activate = () => {
    if (!busy) onActivate();
  };

  const clearPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      activated: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.activated) return;

    event.preventDefault();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);

    if (distanceX >= DRAG_INTENT_PX || distanceY >= DRAG_INTENT_PX) {
      suppressClickRef.current = true;
    }
    if (distanceX < DRAG_ACTIVATION_PX || distanceX <= distanceY) return;

    drag.activated = true;
    activate();
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    activate();
  };

  return (
    <button
      type="button"
      className={className}
      style={{ touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none', ...style }}
      data-cassette-handle
      data-cassette-mode={mode}
      aria-label={label ?? cassetteActionLabel({ mode, accession, product, expanded })}
      aria-describedby={describedBy}
      aria-expanded={mode === 'active' || mode === 'verdict' ? expanded : undefined}
      aria-disabled={busy || undefined}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPointer}
      onPointerCancel={clearPointer}
      onLostPointerCapture={() => { dragRef.current = null; }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onEscape) {
          event.preventDefault();
          onEscape();
        }
      }}
    >
      {children}
    </button>
  );
}
