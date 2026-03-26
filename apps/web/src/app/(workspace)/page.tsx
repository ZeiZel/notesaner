import { redirect } from 'next/navigation';

/**
 * Workspace group root — redirects to the workspaces list.
 */
export default function WorkspaceGroupPage() {
  redirect('/workspaces');

}
