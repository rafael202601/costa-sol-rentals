const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const setupTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const tablesSql = `
      -- 1. activity_logs
      create table if not exists public.activity_logs (
        id uuid primary key default uuid_generate_v4(),
        referencia_tipo text,
        referencia_id text,
        acao text,
        usuario text,
        detalhes jsonb default '{}'::jsonb,
        data_hora text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 2. agent_settings
      create table if not exists public.agent_settings (
        id uuid primary key default uuid_generate_v4(),
        key text unique,
        value jsonb default '{}'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 3. cash_auto_configs
      create table if not exists public.cash_auto_configs (
        id uuid primary key default uuid_generate_v4(),
        ativo boolean default false,
        regras jsonb default '[]'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 4. cash_registers
      create table if not exists public.cash_registers (
        id uuid primary key default uuid_generate_v4(),
        data_abertura text,
        data_fechamento text,
        saldo_inicial numeric,
        saldo_final numeric,
        status text default 'aberto',
        operador text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 5. conversation_states
      create table if not exists public.conversation_states (
        id uuid primary key default uuid_generate_v4(),
        telefone text unique,
        estado text,
        dados jsonb default '{}'::jsonb,
        ultima_interacao text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 6. counters
      create table if not exists public.counters (
        id uuid primary key default uuid_generate_v4(),
        tipo text unique,
        ultimo_numero numeric default 0,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 7. fluxos_ia
      create table if not exists public.fluxos_ia (
        id uuid primary key default uuid_generate_v4(),
        nome text,
        gatilho text,
        resposta text,
        ativo boolean default true,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 8. integra_webhooks_aws
      create table if not exists public.integra_webhooks_aws (
        id uuid primary key default uuid_generate_v4(),
        evento text,
        payload jsonb default '{}'::jsonb,
        status text default 'recebido',
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 9. interventions
      create table if not exists public.interventions (
        id uuid primary key default uuid_generate_v4(),
        telefone text,
        motivo text,
        status text default 'pendente',
        atendente text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );

      -- 10. whatsapp_logs
      create table if not exists public.whatsapp_logs (
        id uuid primary key default uuid_generate_v4(),
        telefone text,
        mensagem text,
        direcao text,
        status text,
        data_hora text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `;

    console.log("Executing table creation scripts...");
    await client.query(tablesSql);
    console.log("Missing tables created successfully!");
    
    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Cache reloaded!");

  } catch (err) {
    console.error("Error setting up missing tables:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

setupTables();
