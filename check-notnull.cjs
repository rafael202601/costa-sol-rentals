const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function checkNotNull() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('tasks', 'contracts', 'service_orders', 'sales', 'company_settings')
      AND is_nullable = 'NO';
    `);
    console.log("NOT NULL columns:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
checkNotNull();
