const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_orders'");
  console.log(res.rows.map(r => r.column_name));
  await client.end();
}
run().catch(console.error);
