import { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail || !user?.email) {
    return false;
  }

  return user.email.toLowerCase() === adminEmail.toLowerCase();
}
