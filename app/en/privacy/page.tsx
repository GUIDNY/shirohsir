import { redirect } from "next/navigation";

export default function EnPrivacyRedirect() {
  redirect("/privacy#english-version");
}
