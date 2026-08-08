import { redirect } from "next/navigation";

export default function EnRefundPolicyRedirect() {
  redirect("/refund-policy#english-version");
}
