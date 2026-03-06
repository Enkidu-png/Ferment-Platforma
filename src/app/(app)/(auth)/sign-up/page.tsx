import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SignUpView } from "@/modules/auth/ui/views/sign-up-view";

export const dynamic = "force-dynamic";

const Page = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <SignUpView />;
};

export default Page;
