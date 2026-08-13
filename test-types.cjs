const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabase.from('contracts').select('*').limit(1);
  console.log("historico_recolhas type:", typeof data[0].historico_recolhas, Array.isArray(data[0].historico_recolhas));
  console.log("recolha_parcial_itens type:", typeof data[0].recolha_parcial_itens, Array.isArray(data[0].recolha_parcial_itens));
  console.log("itens type:", typeof data[0].itens, Array.isArray(data[0].itens));
})();
