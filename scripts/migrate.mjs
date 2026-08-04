#!/usr/bin/env node
// Run a SQL migration against the project's Postgres.
// Reads the connection string from SUPABASE_DB_URL in .env.local
// (gitignored — the password is never stored in this file or in git).
//
// Usage:
//   node scripts/migrate.mjs path/to/file.sql
//   node scripts/migrate.mjs -e "CREATE TABLE ..."
//
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// load .env.local manually (no extra deps)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const conn = process.env.SUPABASE_DB_URL;
if (!conn) {
  console.error("✗ SUPABASE_DB_URL not set in .env.local");
  process.exit(1);
}

const arg = process.argv[2];
const inline = process.argv[2] === "-e" ? process.argv.slice(3).join(" ") : null;
let sql;
if (inline) sql = inline;
else if (arg && fs.existsSync(arg)) sql = fs.readFileSync(arg, "utf8");
else {
  console.error('Usage: node scripts/migrate.mjs <file.sql>  |  node scripts/migrate.mjs -e "SQL"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("✅ migration applied successfully");
} catch (e) {
  console.error("✗ migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
