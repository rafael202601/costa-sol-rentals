import { supabase } from './src/api/supabaseClient.js';

async function testInsert() {
  const { data, error } = await supabase.from('clients').insert([
    { nome_razao_social: 'Teste Direto RLS' }
  ]).select();

  console.log("Error:", error);
  console.log("Data:", data);
}

testInsert();
