import type { ReactNode } from 'react';
import headerStyles from './ScreenHeader.module.css';
import styles from '../styles/FaceValue.module.css';

export function EvidenceShell({
  tone = 'light',
  children,
  label,
}: {
  tone?: 'light' | 'dark';
  children: ReactNode;
  label: string;
}) {
  return (
    <main
      className={`${styles.appShell} ${tone === 'dark' ? styles.darkShell : ''}`}
      data-fv-tone={tone}
      aria-label={label}
    >
      {children}
    </main>
  );
}

export function ScreenHeader({
  code = 'FV–014',
  dark = false,
  continuity = false,
}: {
  code?: string;
  dark?: boolean;
  continuity?: boolean;
}) {
  return (
    <header
      className={`${headerStyles.header} ${dark ? headerStyles.dark : ''} ${
        continuity ? headerStyles.continuity : ''
      }`}
      data-fv-part="screen-header"
    >
      <div className={headerStyles.brandBar} data-fv-part="brand-bar">
        <strong>FACE VALUE</strong>
        <span data-oracle-trial-identity>{code}</span>
      </div>
    </header>
  );
}
