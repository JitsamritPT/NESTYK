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
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../migrations/20260918-broker-appointment-agreement.sql",
    ),
    "utf8",
  );
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    const types = await client.query(
      `SELECT code, form_kind, is_active FROM master_agreement_types ORDER BY sort_order`,
    );
    const templates = await client.query(
      `SELECT id, agreement_type_code, version, document_template_key, is_active
         FROM agreement_templates
        WHERE agreement_type_code = 'broker_appointment'
        ORDER BY version DESC`,
    );
    console.log("types", types.rows);
    console.log("templates", templates.rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Broker appointment agreement migration failed:", error.message);
  process.exit(1);
});
