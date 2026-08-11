const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'uuid'");
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
