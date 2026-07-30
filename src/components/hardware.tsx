import type { ReactNode } from 'react';
import headerStyles from './ScreenHeader.module.css';
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

export function ScreenHeader({ code = 'FV–014', dark = false }: { code?: string; dark?: boolean }) {
  return (
    <header
      className={`${headerStyles.header} ${dark ? headerStyles.dark : ''}`}
      data-fv-part="screen-header"
    >
      <div className={headerStyles.brandBar} data-fv-part="brand-bar">
        <strong>FACE VALUE</strong>
        <span data-oracle-trial-identity>{code}</span>
      </div>
    </header>
  );
}
