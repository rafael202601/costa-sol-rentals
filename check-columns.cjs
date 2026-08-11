const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'company_settings';
    `);
    console.log(res.rows.map(r => r.column_name));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
check();
