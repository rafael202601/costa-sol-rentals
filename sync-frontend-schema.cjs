const { Client } = require('pg');
const fs = require('fs');

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
    await client.query(`NOTIFY pgrst, 'reload schema'`);
  } else {
    console.log(`[${tableName}] No missing columns.`);
  }

  await client.end();
}

const cashRegisterPayload = {
  data_abertura: "",
  valor_inicial: 0,
  responsavel: "",
  observacoes: "",
  status: "aberto"
};

async function syncAll() {
  await addMissingColumns('cash_registers', cashRegisterPayload);
}

syncAll().catch(console.error);
