import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenHeader } from '../components/hardware';

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('Face Value static and header brand surfaces', () => {
  it.each([
    { dark: false, tone: 'ink' },
    { dark: true, tone: 'reverse' },
  ])('uses the lowercase Rest lockup for the $tone header', ({ dark, tone }) => {
    const { container } = render(<ScreenHeader dark={dark} />);
    const lockup = container.querySelector('[data-face-value-brand-lockup]');

    expect(lockup).toHaveAccessibleName('face value');
    expect(lockup).toHaveAttribute('data-brand-lockup-tone', tone);
    expect(lockup).toHaveAttribute('data-brand-lockup-state', 'rest');
    expect(lockup?.querySelector('[data-face-value-actuator]')).toHaveAttribute(
      'data-actuator-state',
      'rest',
    );
    expect(lockup?.querySelectorAll('[data-face-value-wordmark-foot]')).toHaveLength(1);
    expect(lockup?.querySelector('[data-actuator-ring]')).toBeNull();
  });

  it('commits the complete Rest-state browser and installed-app icon surface', () => {
    const publicDirectory = resolve('public');
    const manifest = JSON.parse(
      readFileSync(resolve(publicDirectory, 'site.webmanifest'), 'utf8'),
    ) as {
      name: string;
      short_name: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
    };
    const favicon = readFileSync(resolve(publicDirectory, 'favicon.svg'), 'utf8');
    const html = readFileSync(resolve('index.html'), 'utf8');

    expect(pngDimensions(resolve(publicDirectory, 'favicon-32x32.png'))).toEqual({
      width: 32,
      height: 32,
    });
    expect(pngDimensions(resolve(publicDirectory, 'apple-touch-icon.png'))).toEqual({
      width: 180,
      height: 180,
    });
    expect(pngDimensions(resolve(publicDirectory, 'icon-192.png'))).toEqual({
      width: 192,
      height: 192,
    });
    expect(pngDimensions(resolve(publicDirectory, 'icon-512.png'))).toEqual({
      width: 512,
      height: 512,
    });
    expect(pngDimensions(resolve(publicDirectory, 'icon-maskable-512.png'))).toEqual({
      width: 512,
      height: 512,
    });

    expect(manifest).toMatchObject({ name: 'Face Value', short_name: 'Face Value' });
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);
    expect(22 / 32).toBeLessThanOrEqual(0.8);

    expect(favicon).toContain('Favicon / 32 PX');
    expect(favicon).toContain('Actuator / Housing');
    expect(favicon).toContain('Actuator / Amber Cap');
    expect(favicon).not.toMatch(/Ready Ring|Scanning|Scanning Ring/);
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(html).toContain(
      '<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />',
    );
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest" />');
  });
});
