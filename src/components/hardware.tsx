import type { ReactNode } from 'react';
import headerStyles from './ScreenHeader.module.css';
import { FaceValueBrandLockup } from './FaceValueBrandLockup';
import styles from '../styles/FaceValue.module.css';

export function EvidenceShell({
  tone = 'light',
  captureActive = false,
  children,
  label,
}: {
  tone?: 'light' | 'dark';
  captureActive?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <main
      className={`${styles.appShell} ${tone === 'dark' ? styles.darkShell : ''} ${
        captureActive ? styles.captureShell : ''
      }`}
      data-fv-tone={tone}
      data-capture-active={captureActive || undefined}
      aria-label={label}
    >
      {children}
    </main>
  );
}

export function ScreenHeader({
  code = 'FV–014',
  dark = false,
  compact = true,
}: {
  code?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <header
      className={`${headerStyles.header} ${dark ? headerStyles.dark : ''}`}
      data-fv-part="screen-header"
      data-header-size={compact ? 'compact' : 'standard'}
    >
      <div className={headerStyles.brandBar} data-fv-part="brand-bar">
        <FaceValueBrandLockup
          className={headerStyles.brandLockup}
          state="rest"
          tone={dark ? 'reverse' : 'ink'}
          variant={compact ? 'compact' : 'standard'}
        />
        <span data-oracle-trial-identity>{code}</span>
      </div>
    </header>
  );
}
