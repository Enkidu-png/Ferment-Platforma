import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SignInView } from "@/modules/auth/ui/views/sign-in-view";

export const dynamic = "force-dynamic";

const Page = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <SignInView />;
};

export default Page;
