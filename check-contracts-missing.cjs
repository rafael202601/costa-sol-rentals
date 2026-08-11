const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres' });
const p = { numero: '', client_id: '', client_nome: '', data_inicio: '', sem_prazo: true, prazo_tipo: 'dias', prazo_valor: 1, data_prevista_termino: '', solicitante_nome: '', solicitante_tipo: 'cliente', obra_nome: '', obra_endereco: '', itens: [], frete: '', sinal: '', valor_total: 0, valor_pago: '', saldo_pagar: 0, status: 'rascunho', status_financeiro: 'pendente', endereco_entrega: '', observacoes: '', tipo_entrega: 'entrega' };

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'contracts'");
  const ext = new Set(res.rows.map(r => r.column_name));
  const missing = Object.keys(p).filter(k => !ext.has(k) && k !== 'id');
  console.log('missing in contracts:', missing);

  for (const c of missing) {
    const type = typeof p[c] === 'boolean' ? 'boolean' : typeof p[c] === 'number' ? 'numeric' : Array.isArray(p[c]) ? 'jsonb' : 'text';
    await client.query(`ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "${c}" ${type}`);
    console.log(`Added ${c} to contracts`);
  }
  if (missing.length) await client.query("NOTIFY pgrst, 'reload schema'");
  await client.end();
}

run().catch(console.error);
