const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function addMissingColumns(tableName, payload) {
  const client = new Client({ connectionString });
  await client.connect();

  const { rows } = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [tableName]);

  const existingColumns = new Set(rows.map(r => r.column_name));
  const missingColumns = Object.keys(payload).filter(k => !existingColumns.has(k) && k !== 'id');

  if (missingColumns.length > 0) {
    console.log(`[${tableName}] Missing columns:`, missingColumns);
    for (const col of missingColumns) {
      const type = typeof payload[col] === 'boolean' ? 'boolean' : 
                   typeof payload[col] === 'number' ? 'numeric' : 
                   Array.isArray(payload[col]) || typeof payload[col] === 'object' && payload[col] !== null ? 'jsonb' : 'text';
      
      console.log(`Adding ${col} as ${type} to ${tableName}...`);
      await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
    }
  } else {
    console.log(`[${tableName}] No missing columns.`);
  }

  await client.end();
}

const payloads = {
  tasks: {
    titulo: "", descricao: "", observacoes: "", prioridade: "media", status: "pendente",
    categoria: "administrativo", data: "", horario: "", visibilidade: "compartilhada",
    responsaveis: [], checklist: [], comentarios: [], anexos: [], ordem: 0,
    usuario_email: "", usuario_nome: ""
  },
  mural_posts: {
    tipo: "info", texto: "", autor: "", data: "", ativo: true
  },
  activity_logs: {
    user_id: "", user_name: "", acao: "", detalhes: "", modulo: "", data_hora: ""
  }
};

async function run() {
  for (const [table, payload] of Object.entries(payloads)) {
    await addMissingColumns(table, payload);
  }
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(`NOTIFY pgrst, 'reload schema'`);
  await client.end();
}

run().catch(console.error);
