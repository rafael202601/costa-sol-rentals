const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function checkMissingPolicies() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
        AND c.relrowsecurity = true
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname
        );
    `);
    console.log("Tables with RLS enabled but NO policies:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
checkMissingPolicies();
