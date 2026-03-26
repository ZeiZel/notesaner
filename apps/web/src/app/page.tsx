import { redirect } from 'next/navigation';

/**
 * Root page — redirects to the workspace area.
 * If the user is not authenticated, the workspace layout will redirect to /login.
 */
export default function RootPage() {
  redirect('/workspaces');
}
