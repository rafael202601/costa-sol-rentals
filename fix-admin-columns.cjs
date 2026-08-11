const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const alterTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const sql = `
      -- =========================================================
      -- COMPANY_SETTINGS
      -- =========================================================
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS logo_url text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS chave_pix text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nome_titular_pix text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS dados_bancarios text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clausulas_contrato text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clausulas_ficha_cadastral text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clausulas_orcamento text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clausulas_os text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS mensagem_whatsapp_padrao text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS mensagem_whatsapp_cobranca text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS regras_desconto_tempo jsonb;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cobranca_automatica_ativa boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cobranca_intervalo_dias numeric;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cobranca_valor_minimo numeric;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cobranca_canal text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cobranca_horario text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS whatsapp_api_url text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS whatsapp_api_token text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS whatsapp_api_remetente text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_ativa boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_municipio text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_codigo_municipio text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_inscricao_municipal text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_codigo_servico text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_descricao_servico text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_usuario text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_senha text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS nfse_ambiente text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_ativa boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_banco text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_agencia text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_conta text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_carteira text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_convenio text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_api_url text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS boleto_api_token text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS mensagem_whatsapp_os text;
      
      -- IA Settings Inside Company Settings
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_whatsapp_ativa boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_openai_api_key text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_whatsapp_token text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_whatsapp_phone_id text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_whatsapp_verify_token text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_whatsapp_numero text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_tipo_envio text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_nome_agente text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_personalidade text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_linguagem text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_tempo_resposta text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_boas_vindas text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_cliente_nao_encontrado text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_cobranca text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_confirmacao_pagamento text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_envio_contrato text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_mensagem_envio_orcamento text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_prompt_personalizado text;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_exigir_confirmacao boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_transferir_atendente boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_limite_tentativas numeric;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_consultar_clientes boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_consultar_contratos boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_consultar_os boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_consultar_financeiro boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_consultar_orcamentos boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_cobranca_ativa boolean;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_cobranca_intervalo numeric;
      ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS ia_cobranca_incluir_pix boolean;

      -- =========================================================
      -- USERS
      -- =========================================================
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS setor text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ativo boolean;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions jsonb;

      -- =========================================================
      -- FEEDBACKS
      -- =========================================================
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS titulo text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS descricao text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS categoria text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS resposta text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS respondido_por text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS respondido_em text;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS nota_geral numeric;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS nota_atendimento numeric;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS nota_equipamento numeric;
      ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS nota_prazo numeric;
    `;

    console.log("Executing ALTER TABLE scripts for admin tables...");
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
