const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const setupTables = async () => {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const tablesSql = `
      -- 1. users
      create table if not exists public.users (
        id uuid primary key default uuid_generate_v4(),
        full_name text,
        email text,
        role text default 'user',
        status text default 'ativo',
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 2. vehicle_expenses
      create table if not exists public.vehicle_expenses (
        id uuid primary key default uuid_generate_v4(),
        veiculo_id text,
        data text,
        tipo text,
        valor numeric,
        km numeric,
        descricao text,
        motorista text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 3. quotes
      create table if not exists public.quotes (
        id uuid primary key default uuid_generate_v4(),
        client_id text,
        client_nome text,
        itens jsonb default '[]'::jsonb,
        valor_total numeric,
        status text default 'pendente',
        validade text,
        data text,
        observacoes text,
        codigo_orcamento text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 4. cash_entries
      create table if not exists public.cash_entries (
        id uuid primary key default uuid_generate_v4(),
        tipo text,
        valor numeric,
        descricao text,
        categoria text,
        data text,
        status text default 'pago',
        referent_id text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 5. billing_notes
      create table if not exists public.billing_notes (
        id uuid primary key default uuid_generate_v4(),
        client_id text,
        client_nome text,
        valor numeric,
        vencimento text,
        status text default 'aberto',
        os_id text,
        codigo_fatura text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 6. payment_requests
      create table if not exists public.payment_requests (
        id uuid primary key default uuid_generate_v4(),
        os_id text,
        descricao text,
        valor numeric,
        status text default 'pendente',
        responsavel text,
        data_solicitacao text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 7. company_settings
      create table if not exists public.company_settings (
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

      -- 8. tasks
      create table if not exists public.tasks (
        id uuid primary key default uuid_generate_v4(),
        titulo text,
        descricao text,
        status text default 'pendente',
        criador text,
        responsavel text,
        data_limite text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 9. mural_posts
      create table if not exists public.mural_posts (
        id uuid primary key default uuid_generate_v4(),
        conteudo text,
        autor text,
        fixado boolean default false,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 10. client_tags
      create table if not exists public.client_tags (
        id uuid primary key default uuid_generate_v4(),
        nome text,
        cor text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 11. feedbacks
      create table if not exists public.feedbacks (
        id uuid primary key default uuid_generate_v4(),
        client_id text,
        client_nome text,
        nota numeric,
        comentario text,
        status text,
        data_feedback text,
        created_date text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `;

    await client.query(tablesSql);
    console.log("All missing tables created successfully.");

    // Enable RLS and create generic policies for each table
    const tableNames = [
      'users', 'vehicle_expenses', 'quotes', 'cash_entries',
      'billing_notes', 'payment_requests', 'company_settings',
      'tasks', 'mural_posts', 'client_tags', 'feedbacks'
    ];

    for (const table of tableNames) {
      const rlsSql = `
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'Permitir tudo para usuários autenticados'
            ) THEN
                CREATE POLICY "Permitir tudo para usuários autenticados" 
                ON public.${table} 
                FOR ALL TO authenticated USING (true);
            END IF;
        END $$;
      `;
      await client.query(rlsSql);
      console.log(`RLS configured for ${table}`);
    }

    console.log("Database update completed entirely!");
  } catch (err) {
    console.error("Error setting up tables:", err);
  } finally {
    await client.end();
  }
};

setupTables();
