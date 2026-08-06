import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מחירים | מנגינה אישית",
  description: "שיר אישי בודד, חבילות שירים או מנוי חודשי — כל המחירים והחיסכון במקום אחד.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
