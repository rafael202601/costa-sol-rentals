const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
const query = `
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name IN ('cash_entries', 'payment_requests', 'billing_notes', 'quotes', 'cash_registers', 'cash_auto_configs');
`;
c.connect().then(() => c.query(query)).then(res => { 
  const schema = {};
  res.rows.forEach(r => {
    if (!schema[r.table_name]) schema[r.table_name] = [];
    schema[r.table_name].push(r.column_name + ' (' + r.data_type + ')');
  });
  console.log(schema);
  c.end(); 
});
