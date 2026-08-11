const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const alterTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const sql = `
      -- =========================================================
      -- SERVICE ORDERS
      -- =========================================================
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_entrega text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_recolhimento text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_entrega_real text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_entrega_real_iso text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_recolhimento_real text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS data_recolhimento_real_iso text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS motorista_entrega_confirmado text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS motorista_recolhimento_confirmado text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS motorista_recolhimento text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS veiculo_recolhimento text;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_cliente text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_data text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_entrega_url text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_entrega_motorista text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_entrega_data text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_devolucao_url text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_devolucao_motorista text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_devolucao_data text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_pendente boolean;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_pendente_motorista text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS assinatura_pendente_data text;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS locador_nome text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS locador_assinatura text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS locador_data text;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS criado_por text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS editado_por text;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS historico_recolhas jsonb;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS historico_trocas jsonb;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS historico_devolucoes jsonb;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS quantidade_recolhida numeric;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS quantidade_ativa numeric;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS quantidade_cacambas numeric;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS os_troca_id text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS numero text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_codigo text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_etiquetas jsonb;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS local_entrega text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS customer_code text;
      
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS pagamento_adiantado_obrigatorio boolean;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS tipo_os text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS cacamba_equipamento_id text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS tipo_cacamba text;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS valor numeric;
      ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS valor_unitario numeric;

      -- =========================================================
      -- CONTRACTS
      -- =========================================================
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS locador_nome text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS locador_assinatura text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS locador_data text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_cliente text;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_entrega_url text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_entrega_motorista text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_entrega_data text;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_devolucao_url text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_devolucao_motorista text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_devolucao_data text;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_pendente boolean;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_pendente_motorista text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assinatura_pendente_data text;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS historico_recolhas jsonb;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS historico_devolucoes jsonb;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS historico_trocas jsonb;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS recolha_parcial_pendente boolean;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS recolha_parcial_itens jsonb;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS ultima_cobranca_enviada text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS cobranca_pausada boolean;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dinamico_data_base text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dinamico_valor_pago_acumulado numeric;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dinamico_dias_em_aberto numeric;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dinamico_valor_em_aberto numeric;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dinamico_ultima_atualizacao text;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS criado_por text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS editado_por text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS pagamentos jsonb;
      
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS data_entrega_real text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS data_recolhimento_real text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS data_entrega_real_iso text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS data_recolhimento_real_iso text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS motorista_entrega_confirmado text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS motorista_recolhimento_confirmado text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS motorista_recolhimento text;
      ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS veiculo_recolhimento text;
    `;

    console.log("Executing ALTER TABLE scripts for contracts and service_orders...");
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
