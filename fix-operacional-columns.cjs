const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const alterTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const sql = `
      -- =========================================================
      -- SALES
      -- =========================================================
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_cpf_cnpj text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS desconto_tipo text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS desconto_valor numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS valor_pago numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS saldo_pendente numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS troco numeric;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status_pagamento text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nota_vinculada_id text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nota_vinculada_numero text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS criado_por text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS editado_por text;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS numero text;

      -- =========================================================
      -- TASKS
      -- =========================================================
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS usuario_email text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS usuario_nome text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS observacoes text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS data text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS horario text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS prioridade text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist jsonb;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS comentarios jsonb;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS anexos jsonb;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS local text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cor text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS etiquetas jsonb;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tipo_vinculo text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS vinculo_id text;
      ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS vinculo_numero text;
    `;

    console.log("Executing ALTER TABLE scripts for operational tables...");
    await client.query(sql);
    console.log("Columns added successfully!");

    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Cache reloaded!");

  } catch (err) {
    console.error("Error altering tables:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

alterTables();
