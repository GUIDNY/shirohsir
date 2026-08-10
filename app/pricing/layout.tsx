import type { Metadata } from "next";

const title = "מחירים | Shirli";
const description = "שיר אישי בודד, חבילות שירים או מנוי חודשי — כל המחירים והחיסכון במקום אחד.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title,
    description,
    url: "/pricing",
    images: ["/og.png"],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
