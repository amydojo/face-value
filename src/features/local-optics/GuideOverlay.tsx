import { useEffect, useRef } from 'react';
import type { GuideTarget } from './guidance';

// Alignment overlay drawn over the mirrored, cover-cropped camera preview. Both shapes are generic
// ellipses sized from the outer-eye distance: the overlay never traces the person's face.

export interface OverlayFace {
  centerX: number;
  centerY: number;
  /** Outer-eye distance as a fraction of frame width. */
  interocular: number;
  roll: number;
}

export type OverlayMode = 'off' | 'searching' | 'guiding' | 'aligned' | 'capturing';

export interface GuideOverlayProps {
  video: HTMLVideoElement | null;
  frame: { width: number; height: number } | null;
  target: GuideTarget | null;
  face: OverlayFace | null;
  nudge: { x: number; y: number } | null;
  mode: OverlayMode;
  reducedMotion: boolean;
}

const RX = 0.95; // ellipse radii in outer-eye distances (generic face proportions)
const RY = 1.32;
const GUIDE = 'rgba(244, 243, 239, 0.9)';
const GUIDE_MUTED = 'rgba(244, 243, 239, 0.45)';
const ACCENT = '#ff6a00';

interface Shape {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
}

/** Screen position of a camera-frame point in a mirrored `object-fit: cover` element. */
function coverMap(element: { width: number; height: number }, frame: { width: number; height: number }) {
  const scale = Math.max(element.width / frame.width, element.height / frame.height);
  const offsetX = (element.width - frame.width * scale) / 2;
  const offsetY = (element.height - frame.height * scale) / 2;
  return {
    scale,
    point: (x: number, y: number) => ({ x: offsetX + (1 - x) * frame.width * scale, y: offsetY + y * frame.height * scale }),
  };
}

function shapeFor(
  element: { width: number; height: number },
  frame: { width: number; height: number },
  centerX: number,
  centerY: number,
  interocularPx: number,
  roll: number,
): Shape {
  const map = coverMap(element, frame);
  const p = map.point(centerX, centerY);
  const iod = interocularPx * map.scale;
  // Mirroring flips the apparent roll.
  return { x: p.x, y: p.y, rx: iod * RX, ry: iod * RY, rotation: (-roll * Math.PI) / 180 };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function GuideOverlay(props: GuideOverlayProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let raf = 0;
    let shown: Shape | null = null;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { video, frame, target, face, nudge, mode, reducedMotion } = latest.current;
      const width = element.clientWidth;
      const height = element.clientHeight;
      const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      }
      const context = element.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const size = frame ?? (video && video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null);
      if (mode === 'off' || !size || !target) {
        shown = null;
        return;
      }
      const box = { width, height };
      const goal = shapeFor(box, size, target.centerX, target.centerY, target.interocularPx, target.roll);

      // Target outline: four arcs while guiding, a closed ring once aligned or capturing.
      const closed = mode === 'aligned' || mode === 'capturing';
      context.save();
      context.translate(goal.x, goal.y);
      context.rotate(goal.rotation);
      context.lineCap = 'round';
      context.lineWidth = closed ? 3 : 2.5;
      context.strokeStyle = closed ? ACCENT : mode === 'searching' ? GUIDE_MUTED : GUIDE;
      if (closed) {
        context.beginPath();
        context.ellipse(0, 0, goal.rx, goal.ry, 0, 0, Math.PI * 2);
        context.stroke();
      } else {
        for (const middle of [0.25, 0.75, 1.25, 1.75]) {
          context.beginPath();
          context.ellipse(0, 0, goal.rx, goal.ry, 0, (middle - 0.17) * Math.PI, (middle + 0.17) * Math.PI);
          context.stroke();
        }
      }
      context.restore();

      // The live face, as a soft generic ellipse that eases toward each new reading.
      if (face && mode !== 'capturing') {
        const next = shapeFor(box, size, face.centerX, face.centerY, face.interocular * size.width, face.roll);
        const k = reducedMotion || !shown ? 1 : 0.28;
        shown = shown
          ? { x: lerp(shown.x, next.x, k), y: lerp(shown.y, next.y, k), rx: lerp(shown.rx, next.rx, k), ry: lerp(shown.ry, next.ry, k), rotation: lerp(shown.rotation, next.rotation, k) }
          : next;
        context.save();
        context.translate(shown.x, shown.y);
        context.rotate(shown.rotation);
        context.lineWidth = 1.5;
        context.setLineDash([3, 6]);
        context.strokeStyle = mode === 'aligned' ? 'rgba(255, 106, 0, 0.7)' : 'rgba(244, 243, 239, 0.55)';
        context.beginPath();
        context.ellipse(0, 0, shown.rx, shown.ry, 0, 0, Math.PI * 2);
        context.stroke();
        context.restore();

        // A chevron from the face toward the outline when position is the instruction.
        if (nudge && mode === 'guiding') {
          const angle = Math.atan2(nudge.y, nudge.x);
          const distance = Math.hypot(goal.x - shown.x, goal.y - shown.y);
          const reach = Math.min(distance * 0.5, 64);
          const cx = shown.x + Math.cos(angle) * Math.max(18, reach);
          const cy = shown.y + Math.sin(angle) * Math.max(18, reach);
          context.save();
          context.translate(cx, cy);
          context.rotate(angle);
          context.strokeStyle = ACCENT;
          context.lineWidth = 3;
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.beginPath();
          context.moveTo(-7, -10);
          context.lineTo(5, 0);
          context.lineTo(-7, 10);
          context.stroke();
          context.restore();
        }
      } else if (!face) {
        shown = null;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} aria-hidden="true" data-guide-overlay={props.mode} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
