const { Client } = require('pg');
const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

(async () => {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`SELECT id, client_id, status FROM contracts LIMIT 5`);
  console.log(res.rows);
  await client.end();
})();
