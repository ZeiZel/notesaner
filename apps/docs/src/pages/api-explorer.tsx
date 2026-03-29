import type { ReactNode } from 'react';
import Layout from '@theme/Layout';
import styles from './embed.module.css';

export default function ApiExplorerPage(): ReactNode {
  return (
    <Layout
      title="Interactive API Explorer — Swagger UI"
      description="Interactive Swagger UI for the Notesaner REST API"
      noFooter
    >
      <div className={styles.embedContainer}>
        <div className={styles.embedBanner}>
          <span>
            Interactive API explorer — requires a running Notesaner backend (
            <code>pnpm nx serve server</code>).{' '}
            <a href="/docs/api-reference/overview">Read the static API reference →</a>
          </span>
        </div>
        <iframe
          src="http://localhost:4000/api/docs"
          title="Notesaner API — Swagger UI"
          className={styles.embedFrame}
          allow="clipboard-write"
        />
      </div>
    </Layout>
  );
}
