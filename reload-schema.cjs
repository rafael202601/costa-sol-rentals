const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const reloadSchema = async () => {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("Schema cache reloaded!");
  } catch (err) {
    console.error("Error reloading schema:", err);
  } finally {
    await client.end();
  }
};

reloadSchema();
