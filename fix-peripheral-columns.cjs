const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });

const payloads = { 
  announcements: { titulo: '', mensagem: '', data_fim: '', prioridade: 'normal', categoria: 'geral', link_acao: '', label_acao: '', exibicao_obrigatoria: false, publico_alvo: 'todos', id_criador: '', nome_criador: '', status: 'ativo' }, 
  payment_requests: { client_id: '', os_id: '', contract_id: '', valor: 0, status: 'pendente', data_vencimento: '', metodo: '', url_pagamento: '', external_id: '' }, 
  counters: { type: '', current_value: 0 }, 
  billing_notes: { client_id: '', data_emissao: '', data_vencimento: '', valor_total: 0, status: 'pendente', tipo: '', descricao: '', contracts: [], url_pdf: '', nosso_numero: '', nfe_status: '', nfe_url: '', chave_acesso: '' }, 
  vehicle_expenses: { vehicle_id: '', data: '', tipo: '', valor: 0, fornecedor: '', responsavel: '', km_atual: 0, observacoes: '', recibo_url: '' }, 
  cash_auto_configs: { dia_faturamento: 1, ativo: false, configurado_por: '', configurado_por_nome: '', configurado_em: '', notificar_whatsapp: true, criar_cobranca: true, aplicar_juros: false }, 
  client_tags: { client_id: '', tag: '' }, 
  fluxos_ia: { nome: '', prompt: '', ativo: true, triggers: [], metadata: {} }, 
  interventions: { client_id: '', reason: '', data: '', status: 'pendente', agent_id: '', resolved_by: '', notas: '' }, 
  agent_settings: { chave_api: '', model: '', max_tokens: 0, temperature: 0, instrucoes_base: '', enabled: true, assistant_id: '', thread_id: '' } 
};

async function run() { 
  await client.connect(); 
  for (const [t, p] of Object.entries(payloads)) { 
    const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [t]); 
    const ext = new Set(res.rows.map(r => r.column_name)); 
    const missing = Object.keys(p).filter(k => !ext.has(k) && k !== 'id'); 
    
    if (missing.length) { 
      console.log(t, 'missing:', missing); 
      for (const c of missing) { 
        const type = typeof p[c] === 'boolean' ? 'boolean' : typeof p[c] === 'number' ? 'numeric' : Array.isArray(p[c]) || typeof p[c] === 'object' && p[c] !== null ? 'jsonb' : 'text'; 
        await client.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "${c}" ${type}`); 
        console.log(`Added ${c} to ${t}`);
      } 
    } 
  } 
  await client.query("NOTIFY pgrst, 'reload schema'"); 
  await client.end(); 
  console.log("All tables fixed.");
}

run().catch(console.error);
