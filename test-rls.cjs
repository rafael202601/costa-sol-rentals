const { Client } = require('pg');
const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

(async () => {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`SELECT pol.policyname, pol.cmd, pol.qual, pol.with_check FROM pg_policies pol WHERE pol.tablename IN ('service_orders', 'tasks')`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})();
