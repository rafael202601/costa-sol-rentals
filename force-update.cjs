const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const force = async () => {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    // Recreate company_settings from scratch to ensure columns exist
    await client.query(`DROP TABLE IF EXISTS public.company_settings CASCADE`);
    await client.query(`
      create table public.company_settings (
        id uuid primary key default uuid_generate_v4(),
        empresa_nome text,
        empresa_cnpj text,
        empresa_telefone text,
        empresa_email text,
        empresa_endereco text,
        empresa_cidade text,
        empresa_uf text,
        empresa_cep text,
        empresa_logo_url text,
        recibo_observacoes text,
        contrato_clausulas text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Permitir tudo para usuários autenticados" ON public.company_settings FOR ALL TO authenticated USING (true);
    `);
    
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("Forced recreation and reloaded schema.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
};

force();
