const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  await client.query('ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "client_codigo" text');
  await client.query('ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "client_etiquetas" jsonb');
  await client.query('ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "pagamento_adiantado_obrigatorio" boolean');
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.end();
  console.log('Fixed contracts final missing columns!');
}
run().catch(console.error);
