import { useEffect } from 'react';
import { useFaceValue } from './faceValueContext';

export function StageFocusManager() {
  const { state } = useFaceValue();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('h1') ??
        document.querySelector<HTMLElement>('[data-stage-focus]');

      if (target) {
        if (!target.hasAttribute('tabindex') && target.tagName !== 'BUTTON') {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state.stage]);

  return null;
}
