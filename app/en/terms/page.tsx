import { redirect } from "next/navigation";

export default function EnTermsRedirect() {
  redirect("/terms#english-version");
}
