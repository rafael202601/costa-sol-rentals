const { Client } = require('pg');
const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

(async () => {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(`NOTIFY pgrst, 'reload schema'`);
  console.log('Reloaded schema cache');
  await client.end();
})();
