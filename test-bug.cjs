const { Client } = require('pg');
const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function testInsert(tableName, payload) {
  const cleanPayload = { ...payload };
  if (cleanPayload.id === "") delete cleanPayload.id;
  Object.keys(cleanPayload).forEach(key => {
    if (key.endsWith('_id') && cleanPayload[key] === "") {
      cleanPayload[key] = null;
    }
  });

  const client = new Client({ connectionString });
  await client.connect();
  console.log(`[${tableName}] Attempting to insert:`, cleanPayload);
  try {
    const keys = Object.keys(cleanPayload).map(k => `"${k}"`).join(", ");
    const vals = Object.values(cleanPayload).map((_, i) => `$${i + 1}`).join(", ");
    
    // For arrays or objects, we need to handle them carefully in raw pg query, but for simple tests stringifying them is better,
    // actually pg handles arrays natively if mapped correctly.
    const queryVals = Object.values(cleanPayload).map(v => Array.isArray(v) ? JSON.stringify(v) : v);
    
    const res = await client.query(`INSERT INTO "${tableName}" (${keys}) VALUES (${vals}) RETURNING *`, queryVals);
    console.log(`✅ SUCESSO no ${tableName}:`, res.rows[0]);
  } catch (error) {
    console.error(`❌ ERRO no ${tableName}:`, error.message);
  } finally {
    await client.end();
  }
}

async function testUpdate(tableName, payload) {
  const cleanPayload = { ...payload };
  if (cleanPayload.id === "") delete cleanPayload.id;
  Object.keys(cleanPayload).forEach(key => {
    if (key.endsWith('_id') && cleanPayload[key] === "") {
      cleanPayload[key] = null;
    }
  });

  const client = new Client({ connectionString });
  await client.connect();
  console.log(`[${tableName}] Attempting to update:`, cleanPayload);
  try {
    const keys = Object.keys(cleanPayload).filter(k => k !== 'id');
    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
    const vals = [payload.id, ...keys.map(k => cleanPayload[k])];
    const queryVals = vals.map(v => Array.isArray(v) ? JSON.stringify(v) : v);
    const res = await client.query(`UPDATE "${tableName}" SET ${setClause} WHERE id = $1 RETURNING *`, queryVals);
    console.log(`✅ SUCESSO UPDATE ${tableName}:`, res.rows[0]);
  } catch (error) {
    console.error(`❌ ERRO UPDATE ${tableName}:`, error.message);
  } finally {
    await client.end();
  }
}

async function runTests() {
  console.log("Simulating Frontend Payload issues...");

  await testInsert('sales', {
    id: "",
    client_id: "", 
    valor_total: 100,
    status: "FINALIZADA",
    itens: []
  });

  const client = new Client({ connectionString });
  await client.connect();
  const { rows: settings } = await client.query(`SELECT id FROM company_settings LIMIT 1`);
  await client.end();
  
  if (settings && settings[0]) {
    await testUpdate('company_settings', {
      id: settings[0].id,
      nome_fantasia: "Costa do Sol Locações",
      cnpj: "12.345.678/0001-99",
      empresa_nome: "Costa do Sol" 
    });
  }

  await testInsert('service_orders', {
    id: "",
    contract_id: "",
    vehicle_id: "",
    driver_id: "",
    status: "PENDENTE"
  });
}

runTests();
