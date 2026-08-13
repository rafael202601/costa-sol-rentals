import { supabase } from './src/api/supabaseClient.js';

(async () => {
  const { data, error } = await supabase.from('contracts').select('*').limit(1);
  if (!data || !data.length) {
    console.log("No data");
    return;
  }
  const row = data[0];
  console.log("historico_recolhas type:", typeof row.historico_recolhas, Array.isArray(row.historico_recolhas));
  console.log("recolha_parcial_itens type:", typeof row.recolha_parcial_itens, Array.isArray(row.recolha_parcial_itens));
  console.log("itens type:", typeof row.itens, Array.isArray(row.itens));
  console.log("regras_desconto_tempo type:", typeof row.regras_desconto_tempo, Array.isArray(row.regras_desconto_tempo));
  process.exit(0);
})();
