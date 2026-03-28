import type { Metadata } from 'next';

interface PublicVaultPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicVaultPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

/**
 * Public vault index — shows the README or landing note for a published vault.
 */
export default async function PublicVaultPage({ params }: PublicVaultPageProps) {
  const { slug } = await params;

  return (
    <div>
      <h1 className="text-4xl font-bold text-foreground">{slug}</h1>
      <p className="mt-4 text-base text-foreground-secondary">
        This is a publicly published workspace. Select a note from the navigation to start reading.
      </p>
    </div>
  );
}
