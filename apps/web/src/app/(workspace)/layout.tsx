import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceShell } from './WorkspaceShell';

export const metadata: Metadata = {
  title: 'Workspace',
};

interface WorkspaceGroupLayoutProps {
  children: ReactNode;
}

/**
 * Workspace group layout.
 *
 * Wraps all workspace routes with the three-panel application shell:
 *   [Left Sidebar 260px] [Main Content flex] [Right Sidebar 280px]
 *
 * Authentication guard is handled in WorkspaceShell (client component)
 * to avoid blocking server rendering.
 */
export default function WorkspaceGroupLayout({ children }: WorkspaceGroupLayoutProps) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
