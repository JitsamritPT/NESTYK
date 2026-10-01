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
        path.resolve(
          __dirname,
          '../../../docs/new-project/agent/create-room/migrations/20260317-promo-title-contact-social.sql',
        ),
        'utf8',
      ),
    );
    const rows = await db.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = $1 AND
         ((table_name = 'rent_rooms' AND column_name = 'promo_title') OR
          (table_name = 'contacts' AND column_name IN ('line_id', 'facebook')))
       ORDER BY table_name, column_name`,
      [schema],
    );
    if (rows.rows.length !== 3) throw new Error('Expected listing/contact columns missing');
    if (process.argv.includes('--check')) {
      await db.query('ROLLBACK');
      console.log('Migration validated and rolled back.');
    } else {
      await db.query('COMMIT');
      console.log('Migration applied.');
    }
    console.log(JSON.stringify(rows.rows));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(
    'Listing promo/contact migration failed:',
    error.code || error.name,
  );
  process.exitCode = 1;
});
