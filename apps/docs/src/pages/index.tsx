import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import clsx from 'clsx';

import styles from './index.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
  href: string;
  icon: string;
};

const features: FeatureItem[] = [
  {
    title: 'Help Center',
    icon: '📖',
    href: '/help/getting-started/what-is-notesaner',
    description: (
      <>
        Get started with Notesaner. Learn the editor, organize your notes, collaborate in real time,
        and discover powerful plugins.
      </>
    ),
  },
  {
    title: 'Self-Hosting Guide',
    icon: '🖥️',
    href: '/docs/self-hosting/overview',
    description: (
      <>
        Deploy Notesaner on your own infrastructure with Docker Compose. Covers PostgreSQL, ValKey,
        reverse proxy, SAML SSO, and backups.
      </>
    ),
  },
  {
    title: 'Architecture Overview',
    icon: '🏗️',
    href: '/docs/architecture/system-diagram',
    description: (
      <>
        Deep dive into the NX monorepo, Feature-Sliced Design frontend, NestJS clean architecture
        backend, and Yjs CRDT sync engine.
      </>
    ),
  },
  {
    title: 'API Reference',
    icon: '🔌',
    href: '/docs/api-reference/overview',
    description: (
      <>
        REST API and WebSocket events reference. Authentication, pagination, rate limiting, and
        complete endpoint documentation.
      </>
    ),
  },
  {
    title: 'Plugin Development',
    icon: '🧩',
    href: '/docs/plugin-development/getting-started/architecture',
    description: (
      <>
        Build plugins with the Notesaner Plugin SDK. iframe sandbox model, postMessage protocol,
        Editor API, Storage API, and publishing to the registry.
      </>
    ),
  },
  {
    title: 'Contributing',
    icon: '🤝',
    href: '/docs/contributing/overview',
    description: (
      <>
        Contribute to Notesaner — code, documentation, plugins, and translations. TypeScript
        guidelines, FSD patterns, and PR workflow.
      </>
    ),
  },
];

function HeroBanner() {
  return (
    <div className={styles.heroBanner}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          Notesaner Documentation
        </Heading>
        <p className={styles.heroSubtitle}>
          The open-source, collaborative note-taking platform inspired by Obsidian.
        </p>
        <div className={styles.heroButtons}>
          <Link
            className="button button--primary button--lg"
            to="/help/getting-started/what-is-notesaner"
          >
            Get Started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/self-hosting/overview">
            Self-Host Notesaner
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, icon, description, href }: FeatureItem) {
  return (
    <div className={clsx('col col--4', styles.featureCard)}>
      <div className="card padding--lg">
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        <Link className="button button--outline button--sm button--primary" to={href}>
          Read Docs →
        </Link>
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HeroBanner />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
