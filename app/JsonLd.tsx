// Renders one schema.org JSON-LD block. Plain component (no hooks, no
// "use client"), like SiteFooter, so it drops into both server pages and
// client pages. "<" is escaped as \u003c so no string inside the data
// (a plan name, an FAQ answer) can ever close the <script> tag early.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
