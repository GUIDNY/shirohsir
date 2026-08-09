import type { Metadata } from "next";
import { Heebo, Montserrat } from "next/font/google";
import Script from "next/script";
import { singleSongPlan } from "@/lib/pricing-catalog";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

// Latin-only — used narrowly for the "My Shirli" wordmark and the fully
// English /en page. Heebo stays the primary font everywhere else, since
// Montserrat has no Hebrew glyphs and would silently fall back for the
// vast majority of the site's actual content.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const siteTitle = "My Shirli | הופכים את הסיפור שלכם לשיר אישי";
const siteDescription = `הופכים את הסיפור שלכם לשיר אישי בעברית — מערכת אוטומטית שכותבת, מלחינה ומפיקה שיר מוכן להורדה ולשיתוף במחיר של ${singleSongPlan.priceIls} ₪.`;

// Runs before hydration (next/script beforeInteractive) so the correct
// theme is set before first paint — avoids a flash of the wrong theme.
// Dark is the site's default look (the brand identity is designed
// dark-first); a visitor's own explicit choice in the toggle always wins.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "My Shirli - אתר יצירת שיר AI בעברית",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="rtl" lang="he" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className={`${heebo.variable} ${montserrat.variable} antialiased`}>{children}</body>
    </html>
  );
}
