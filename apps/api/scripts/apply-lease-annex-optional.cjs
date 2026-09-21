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
    path.resolve(__dirname, "../migrations/20260921-lease-annex-optional.sql"),
    "utf8",
  );
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    const active = await client.query(
      `SELECT id, version, document_template_key
         FROM agreement_templates
        WHERE form_kind = 'lease' AND is_active
        ORDER BY version DESC
        LIMIT 1`,
    );
    const t = active.rows[0];
    const reqs = t
      ? await client.query(
          `SELECT group_key, label, document_type_code
             FROM agreement_template_document_requirements
            WHERE template_id = $1
            ORDER BY group_key, document_type_code`,
          [t.id],
        )
      : { rows: [] };
    const moved = await client.query(
      `UPDATE lease_contracts
          SET template_id = $1
        WHERE contract_no = 'LS202600002'
        RETURNING id, contract_no, template_id, status`,
      [t.id],
    );
    console.log("active lease template", t);
    console.log("requirements", reqs.rows);
    console.log("LS202600002", moved.rows[0] || null);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Lease annex optional migration failed:", error.message);
  process.exit(1);
});
