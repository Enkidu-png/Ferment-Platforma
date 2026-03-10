import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebarNav } from '@/modules/admin/ui/components/admin-sidebar-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const appRole = user.app_metadata?.app_role;
  if (appRole !== 'super-admin') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebarNav />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
