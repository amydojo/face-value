import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Synthetic "camera" videos for the Local Optics e2e tests, built at test time with ffmpeg from the
// licensed fixtures (see e2e/fixtures/local-optics/NOTICE.md). A real model runs on real pixels,
// but the motion is a deterministic simulation of a hand-held phone (sinusoidal sway and tremor of
// the whole frame), not a person: no head rotation, no expression, no auto-exposure changes.

const FIXTURES = new URL('./fixtures/local-optics/', import.meta.url).pathname;
export const VIDEO_DIR = join(tmpdir(), 'fv-local-optics-videos-v2');

const PORTRAIT = 'one-face-nasa-eileen-collins.png';
const STILL_LIFE = 'no-face-still-life.jpg';

// Portrait selfie framing: 360×480 (portrait, like an iPhone front camera), face centred with
// about 0.30 of the frame width between the outer eye corners.
const W = 360;
const H = 480;
const SCALE = 790; // fixture is 512 px; ~70 px between eye corners -> ~108 px
const PAD = 260;
const ORIGIN_X = 168 + PAD;
const ORIGIN_Y = -36 + PAD;
const FPS = 30;

const sine = (amplitude: number, hz: number, phase = 0) => `${amplitude}*sin(2*PI*${hz}*t+${phase})`;

export interface MotionProfile {
  /** Seconds; every frequency below divides it so the loop is seamless. */
  seconds: number;
  dx: string;
  dy: string;
  scale?: number;
  fps?: number;
}

export const MOTION = {
  /** Phone on a stand: sub-pixel shimmer only. */
  steady: { seconds: 4, dx: sine(0.6, 0.5), dy: sine(0.6, 0.25, 1) },
  /** Calm hand-held (elbows in): gentle sway and fine tremor. */
  handheld: {
    seconds: 4,
    dx: `${sine(4, 0.5)}+${sine(2, 1.25, 0.7)}+${sine(0.5, 6, 0.3)}`,
    dy: `${sine(3, 0.25, 1.1)}+${sine(1.5, 1, 0.2)}+${sine(0.5, 6, 1.9)}`,
  },
  /** Active hand-held (arm extended, talking): larger sway and tremor. */
  handheldActive: {
    seconds: 4,
    dx: `${sine(6, 0.5)}+${sine(3, 1.25, 0.7)}+${sine(0.8, 6, 0.3)}`,
    dy: `${sine(5, 0.25, 1.1)}+${sine(2.5, 1, 0.2)}+${sine(0.8, 6, 1.9)}`,
  },
  /** Walking or a shaky hand: large, fast movement that should never pass the motion gate. */
  shaky: { seconds: 4, dx: `${sine(26, 1.5)}+${sine(5, 6, 0.4)}`, dy: `${sine(20, 1.25, 0.9)}+${sine(5, 6, 2)}` },
  /**
   * Starts off-centre and low for 6 s (longer than the guide takes to start), glides into place
   * over 1.5 s, then holds steady. The camera restarts the clip on every scan. 16 s loop at 15 fps.
   */
  driftIn: {
    seconds: 16,
    fps: 15,
    dx: `if(lt(t,6),-70,if(lt(t,7.5),-70+70*(t-6)/1.5,0))+${sine(0.6, 0.5)}`,
    dy: `if(lt(t,6),-60,if(lt(t,7.5),-60+60*(t-6)/1.5,0))+${sine(0.6, 0.25, 1)}`,
  },
  /** Held too far away for the whole loop: the face never reaches guide size. */
  far: { seconds: 4, dx: sine(4, 0.5), dy: sine(3, 0.25, 1), scale: 430 },
} satisfies Record<string, MotionProfile>;

export type MotionName = keyof typeof MOTION;

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

export function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * A looping portrait selfie video of the fixture moving with `name`'s profile.
 *
 * `dilate` slows the scene down by that factor (the motion is sampled at FPS × dilate and played
 * at FPS ÷ … so the loop lasts `seconds × dilate`). On a machine that analyses a frame every
 * ~260 ms, a dilation of 8 makes consecutive analysed frames ~32 ms apart in scene time: the
 * per-frame landmark motion a phone analysing every camera frame would see. Guide timers are not
 * dilated, so only per-burst outcomes, not durations, are representative in a dilated run.
 */
export function faceVideo(name: MotionName, dilate = 1): string {
  const target = join(VIDEO_DIR, `face-${name}${dilate === 1 ? '' : `-x${dilate}`}.y4m`);
  if (existsSync(target)) return target;
  mkdirSync(VIDEO_DIR, { recursive: true });
  const profile: MotionProfile = MOTION[name];
  const scale = profile.scale ?? SCALE;
  // Keep the face at the same place in the frame when the scale changes (only size changes).
  const k = scale / SCALE;
  const ox = Math.round((ORIGIN_X - PAD + W / 2) * k - W / 2 + PAD);
  const oy = Math.round((ORIGIN_Y - PAD + H * 0.46) * k - H * 0.46 + PAD);
  const outFps = dilate === 1 ? (profile.fps ?? FPS) : 8;
  ffmpeg([
    '-framerate', String(outFps * dilate), '-loop', '1', '-i', join(FIXTURES, PORTRAIT),
    '-filter_complex',
    `[0:v]scale=${scale}:${scale},pad=${scale + 2 * PAD}:${scale + 2 * PAD}:${PAD}:${PAD}:color=0x6f6a62,` +
      `crop=${W}:${H}:x='${ox}+(${profile.dx})':y='${oy}+(${profile.dy})',setpts=${dilate}*PTS`,
    '-t', String(profile.seconds * dilate), '-r', String(outFps), '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', target,
  ]);
  return target;
}

/** A portrait scene with no person in it. */
export function noFaceVideo(): string {
  const target = join(VIDEO_DIR, 'no-face.y4m');
  if (existsSync(target)) return target;
  mkdirSync(VIDEO_DIR, { recursive: true });
  ffmpeg([
    '-loop', '1', '-i', join(FIXTURES, STILL_LIFE),
    '-filter_complex', `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    '-t', '2', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', target,
  ]);
  return target;
}

/** Two head-and-shoulders crops of the same public-domain portrait side by side (not two people). */
export function twoFacesVideo(): string {
  const target = join(VIDEO_DIR, 'two-faces.y4m');
  if (existsSync(target)) return target;
  mkdirSync(VIDEO_DIR, { recursive: true });
  ffmpeg([
    '-loop', '1', '-i', join(FIXTURES, PORTRAIT),
    '-loop', '1', '-i', join(FIXTURES, PORTRAIT),
    '-filter_complex',
    '[0:v]crop=256:256:150:10,scale=180:180[a];[1:v]crop=256:256:150:10,scale=180:180[b];' +
      `[a][b]hstack,pad=${W}:${H}:0:130:color=0x6f6a62`,
    '-t', '2', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', target,
  ]);
  return target;
}
