const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const alterTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const sql = `
      -- =========================================================
      -- CASH ENTRIES
      -- =========================================================
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS forma_pagamento text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS observacoes text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS hora text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS origem text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS caixa_id text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS usuario text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS usuario_nome text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS motivo text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS responsavel text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS origem_id text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS origem_numero text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS client_nome text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS comprovante_url text;
      ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS payment_request_id text;

      -- =========================================================
      -- CASH REGISTERS
      -- =========================================================
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS valor_inicial numeric;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS responsavel text;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS observacoes text;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS total_entradas numeric;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS total_saidas numeric;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS total_sangrias numeric;
      ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS total_suprimentos numeric;

      -- =========================================================
      -- PAYMENT REQUESTS
      -- =========================================================
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS confirmado_por text;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS motivo_rejeicao text;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS valor_total numeric;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS itens jsonb;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS client_nome text;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS comprovante_url text;
      ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS observacoes text;

      -- =========================================================
      -- BILLING NOTES
      -- =========================================================
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS numero text;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS client_cpf_cnpj text;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS contratos_ids jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS contratos_numeros jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS os_ids jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS os_numeros jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS vendas_ids jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS vendas_numeros jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS tipo text;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS itens jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS valor_bruto numeric;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS desconto numeric;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS valor_final numeric;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS valor_pago numeric;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS saldo_aberto numeric;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS pagamentos jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS anexos jsonb;
      ALTER TABLE public.billing_notes ADD COLUMN IF NOT EXISTS criado_por text;

      -- =========================================================
      -- QUOTES
      -- =========================================================
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS numero text;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS data_validade text;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS data_inicio text;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS data_fim text;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS frete numeric;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS clausulas text;
      ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS endereco_entrega text;
    `;

    console.log("Executing ALTER TABLE scripts for finance tables...");
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
