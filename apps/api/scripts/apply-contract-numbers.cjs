const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.api'), quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const schema = process.env.DB_SCHEMA || 'public';
  const db = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '30s'");
    await db.query('SELECT set_config($1, $2, true)', [
      'search_path',
      '"' + schema.replace(/"/g, '""') + '"',
    ]);
    await db.query(
      fs.readFileSync(
        path.resolve(__dirname, '../migrations/20260915-contract-numbers-no-dash.sql'),
        'utf8',
      ),
    );
    const rows = await db.query(
      `SELECT LEFT(contract_no, 2) AS prefix, COUNT(*)::int AS count
       FROM lease_contracts
       WHERE contract_no ~ '^(RS|LS)[0-9]{4}[0-9]{5}$'
       GROUP BY 1
       ORDER BY 1`,
    );
    const missing = await db.query(
      `SELECT COUNT(*)::int AS count FROM lease_contracts
       WHERE contract_no IS NULL OR BTRIM(contract_no) = ''`,
    );
    if (process.argv.includes('--check')) {
      await db.query('ROLLBACK');
      console.log('Migration validated and rolled back.');
    } else {
      await db.query('COMMIT');
      console.log('Migration applied.');
    }
    console.log(JSON.stringify({ series: rows.rows, stillMissing: missing.rows[0].count }));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('Contract number migration failed:', error.code || error.name, error.message);
  process.exitCode = 1;
});
