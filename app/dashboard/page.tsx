import { redirect } from 'next/navigation';
import { UserDashboard } from '@/components/UserDashboard';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }
  return <UserDashboard />;
}
