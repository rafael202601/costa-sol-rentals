const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const data = {
    numero: "9999",
    client_id: "82308fc9-d1b6-4ca2-aa78-9fc097789e88",
    local_entrega: "Rua Teste",
    tipo_os: "padrao",
    status: "pendente",
    quantidade_cacambas: 1,
    quantidade_ativa: 1,
    quantidade_recolhida: 0,
    valor: 100,
    valor_unitario: 100,
    hora_tipo: "sem_horario",
    hora_recolha_tipo: "sem_horario",
    hora_periodo: "manha",
    hora_recolha_periodo: "tarde",
    observacoes: ""
  };

  let cleanPayload = { ...data };
  let error;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase.from('service_orders').insert([cleanPayload]).select();
    error = res.error;
    if (!error) {
       console.log('✅ SUCESSO na tentativa', attempt + 1);
       break;
    }
    if (error.code === 'PGRST204') {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        console.log(`[Auto-Heal] Removendo coluna inexistente '${match[1]}'`);
        delete cleanPayload[match[1]];
        continue;
      }
    }
    console.error(`❌ ERRO FATAL na tentativa ${attempt + 1}:`, error);
    break;
  }
})();
