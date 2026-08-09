#!/usr/bin/env node
// One-time discovery script: lists every variant in your Lemon Squeezy
// store so we can map variant ID -> credits/plan without guessing.
// Reads LEMONSQUEEZY_API_KEY from .env.local (same pattern as
// scripts/migrate.mjs reading SUPABASE_DB_URL — gitignored, never
// committed).
//
// Usage: node scripts/lemonsqueezy-list-variants.mjs
//
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const apiKey = process.env.LEMONSQUEEZY_API_KEY;
if (!apiKey) {
  console.error("✗ LEMONSQUEEZY_API_KEY not set in .env.local");
  console.error("  Get it from: Lemon Squeezy dashboard → Settings → API");
  process.exit(1);
}

async function fetchAllVariants() {
  const variants = [];
  let url = "https://api.lemonsqueezy.com/v1/variants?page[size]=100";

  while (url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Lemon Squeezy API error ${res.status}: ${body.slice(0, 500)}`);
    }

    const json = await res.json();
    variants.push(...json.data);
    url = json.links?.next || null;
  }

  return variants;
}

const variants = await fetchAllVariants();

console.log(`Found ${variants.length} variant(s):\n`);

for (const v of variants) {
  const a = v.attributes;
  console.log(`variant_id: ${v.id}`);
  console.log(`  name:        ${a.name}`);
  console.log(`  product_id:  ${a.product_id}`);
  console.log(`  price:       ${a.price} (${a.price_formatted ?? ""})`);
  console.log(`  interval:    ${a.is_subscription ? `${a.interval_count ?? 1} ${a.interval ?? "?"}` : "one-time"}`);
  console.log(`  status:      ${a.status}`);
  console.log("");
}
