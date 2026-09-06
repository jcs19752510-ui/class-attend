import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  redirect("/dashboard");
}
