import type { ReactNode } from 'react';
import Layout from '@theme/Layout';
import styles from './embed.module.css';

export default function StorybookPage(): ReactNode {
  return (
    <Layout
      title="Component Library — Storybook"
      description="Interactive Storybook component catalog for @notesaner/ui"
      noFooter
    >
      <div className={styles.embedContainer}>
        <div className={styles.embedBanner}>
          <span>
            Interactive component catalog — run <code>pnpm storybook</code> locally or{' '}
            <a href="https://storybook.notesaner.com" target="_blank" rel="noopener noreferrer">
              open the deployed Storybook
            </a>
          </span>
        </div>
        <iframe
          src="http://localhost:6006"
          title="Notesaner Storybook — Component Catalog"
          className={styles.embedFrame}
          allow="clipboard-write"
        />
      </div>
    </Layout>
  );
}
