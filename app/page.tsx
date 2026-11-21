import { redirect } from 'next/navigation';
import { AuthPortal } from '@/components/AuthPortal';
import { getAdminStage1, getAuthenticatedAdmin, getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { admin } = await getAuthenticatedAdmin();
  if (admin) {
    redirect('/admin');
  }

  const user = await getAuthenticatedUser();
  if (user) {
    redirect('/dashboard');
  }

  const stage1 = await getAdminStage1();
  return (
    <AuthPortal
      initialAdminStage2={Boolean(stage1)}
      adminDisplayName={stage1?.displayName || ''}
    />
  );
}
