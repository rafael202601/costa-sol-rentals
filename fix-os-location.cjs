const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "location_url" text');
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "latitude" text');
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "longitude" text');
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "location_notes" text');
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "client_codigo" text');
  await client.query('ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "client_etiquetas" jsonb');
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.end();
  console.log('Fixed service_orders columns!');
}
run().catch(console.error);
