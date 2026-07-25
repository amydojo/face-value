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
  controls?: string;
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
  controls,
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
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const activate = () => {
    if (!busy) onActivate();
  };

  const releaseCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    suppressClickRef.current = false;
    event.currentTarget.focus({ preventScroll: true });
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      activated: false,
      moved: false,
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
      drag.moved = true;
      suppressClickRef.current = true;
    }
    if (distanceX < DRAG_ACTIVATION_PX || distanceX <= distanceY) return;

    drag.activated = true;
    activate();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    suppressClickRef.current = drag.moved;
    releaseCapture(event);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    suppressClickRef.current = false;
    releaseCapture(event);
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
      aria-controls={controls}
      aria-expanded={mode === 'active' || mode === 'verdict' ? expanded : undefined}
      aria-disabled={busy || undefined}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={() => {
        if (dragRef.current) {
          dragRef.current = null;
          suppressClickRef.current = false;
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onEscape) {
          event.preventDefault();
          event.stopPropagation();
          onEscape();
        }
      }}
    >
      {children}
    </button>
  );
}
