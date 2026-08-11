const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function checkRLS() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Check if RLS is enabled on these tables
    const rlsQuery = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('tasks', 'contracts', 'service_orders', 'sales', 'cash_registers', 'company_settings');
    `);
    console.log("RLS Enabled:", rlsQuery.rows);

    // Check policies
    const polQuery = await client.query(`
      SELECT tablename, policyname, cmd, roles, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('tasks', 'contracts', 'service_orders', 'sales', 'cash_registers', 'company_settings');
    `);
    console.log("Policies:", polQuery.rows);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
checkRLS();
