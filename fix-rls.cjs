const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function fixRLS() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    const tables = [
      'activity_logs', 'conversation_states', 'cash_registers',
      'counters', 'integra_webhooks_aws', 'whatsapp_logs',
      'fluxos_ia', 'agent_settings', 'cash_auto_configs', 'interventions'
    ];

    console.log("Applying RLS policies to missing tables...");

    for (const table of tables) {
      const sql = `
        CREATE POLICY "Permitir tudo para usuários autenticados" 
        ON "${table}" 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
      `;
      try {
        await client.query(sql);
        console.log(`✅ Policy added to ${table}`);
      } catch (err) {
        if (err.code === '42710') { // Policy already exists
          console.log(`⚠️ Policy already exists for ${table}`);
        } else {
          console.error(`❌ Error adding policy to ${table}:`, err.message);
        }
      }
    }

    console.log("Adding missing columns to company_settings...");
    const alterSettings = `
      ALTER TABLE "company_settings"
      ADD COLUMN IF NOT EXISTS "nome_fantasia" text,
      ADD COLUMN IF NOT EXISTS "nome_social" text,
      ADD COLUMN IF NOT EXISTS "cnpj" text,
      ADD COLUMN IF NOT EXISTS "telefone" text,
      ADD COLUMN IF NOT EXISTS "email" text,
      ADD COLUMN IF NOT EXISTS "endereco" text,
      ADD COLUMN IF NOT EXISTS "cidade" text,
      ADD COLUMN IF NOT EXISTS "estado" text,
      ADD COLUMN IF NOT EXISTS "cep" text;
    `;
    await client.query(alterSettings);
    console.log("✅ Columns added to company_settings");

    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log("✅ Schema cache reloaded.");
    
  } catch (err) {
    console.error("Critical error:", err);
  } finally {
    await client.end();
  }
}
fixRLS();
