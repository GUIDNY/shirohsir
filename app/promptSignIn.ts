// Opens the existing sign-in popover (see AccountPanel's #account-trigger-btn)
// instead of building a second sign-in form wherever a signed-out visitor
// needs to be prompted (buying a plan, starting a demo, etc.).
export function promptSignIn() {
  const trigger = document.getElementById("account-trigger-btn");
  trigger?.scrollIntoView({ behavior: "smooth", block: "center" });
  (trigger as HTMLButtonElement | null)?.click();
}
