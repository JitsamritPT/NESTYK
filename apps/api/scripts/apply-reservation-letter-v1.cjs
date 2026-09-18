#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const root = path.resolve(__dirname, "../../..");
  const env = {
    ...loadEnv(path.join(root, ".env")),
    ...loadEnv(path.join(root, ".env.api")),
    ...loadEnv(path.join(__dirname, "../.env")),
  };
  const url = env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../migrations/20260918-reservation-letter-v1.sql"),
    "utf8",
  );
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    const rows = await client.query(
      `SELECT id, version, document_template_key, is_active
         FROM agreement_templates
        WHERE form_kind = 'reservation'
        ORDER BY version DESC`,
    );
    console.log(rows.rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Reservation letter-v1 migration failed:", error.message);
  process.exit(1);
});
