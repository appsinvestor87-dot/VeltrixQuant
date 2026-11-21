import { notFound, redirect } from 'next/navigation';
import { AdminConsole } from '@/components/AdminConsole';
import { AuthPortal } from '@/components/AuthPortal';
import { getAdminStage1, getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { admin, idleLocked } = await getAuthenticatedAdmin();
  if (admin) {
    return <AdminConsole adminName={admin.displayName} adminRole={admin.role} />;
  }

  const stage1 = await getAdminStage1();
  if (stage1) {
    return (
      <AuthPortal
        initialAdminStage2={true}
        adminDisplayName={stage1.displayName}
      />
    );
  }

  if (idleLocked) {
    redirect('/');
  }

  // Strictly return 404 to any unauthenticated or normal member browsing /admin
  notFound();
}
