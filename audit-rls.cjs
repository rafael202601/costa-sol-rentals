const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
const tables = ['activity_logs', 'announcements', 'contracts', 'service_orders', 'cash_entries', 'cash_registers', 'payment_requests', 'counters', 'billing_notes', 'clients', 'equipment', 'drivers', 'feedbacks', 'products', 'quotes', 'sales', 'company_settings', 'mural_posts', 'users', 'vehicles', 'vehicle_expenses', 'cash_auto_configs', 'client_tags', 'fluxos_ia', 'interventions', 'agent_settings', 'tasks'];

async function run() {
  await client.connect();
  const res = await client.query("SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'");
  const policies = res.rows;
  const missing = [];
  
  tables.forEach(t => {
    const tPolicies = policies.filter(p => p.tablename === t);
    if (tPolicies.length === 0) {
      missing.push(t);
    }
  });
  
  console.log('Tables missing RLS policies:', missing);

  if (missing.length > 0) {
    console.log("Applying missing policies...");
    for (const t of missing) {
      try {
        await client.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`);
        await client.query(`
          CREATE POLICY "Permitir tudo para usuários autenticados" 
          ON "${t}" 
          FOR ALL 
          TO authenticated 
          USING (true) 
          WITH CHECK (true);
        `);
        console.log(`✅ Applied to ${t}`);
      } catch (err) {
        console.log(`❌ Failed to apply to ${t}:`, err.message);
      }
    }
  }

  await client.end();
}

run().catch(console.error);
