const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sotluugxlslvmhfmoidm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGx1dWd4bHNsdm1oZm1vaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk2NzUsImV4cCI6MjA5ODgyNTY3NX0.VCGcAQgtgrKBgAqsBZzGnAkG4e63P-TmXKCxxevg8wk'
);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@costasol.com',
    password: '123456'
  });

  if (authError) {
    console.error("ERRO LOGIN:", authError);
    return;
  }
  
  console.log("Logged in:", authData.user.id);

  // Testando 'tasks'
  const taskPayload = {
    titulo: "Teste de Tarefa pelo Script",
    status: "pendente",
    criador: "Admin Test",
    created_date: new Date().toISOString()
  };

  const { data: taskData, error: taskError } = await supabase.from('tasks').insert([taskPayload]).select();
  if (taskError) {
    console.error("ERRO TASKS:", taskError);
  } else {
    console.log("SUCESSO TASKS:", taskData);
  }

  // Testando 'company_settings'
  const settingsPayload = {
    empresa_nome: "Costa do Sol Teste",
    empresa_cnpj: "00.000.000/0001-00"
  };

  const { data: settingsData, error: settingsError } = await supabase.from('company_settings').insert([settingsPayload]).select();
  if (settingsError) {
    console.error("ERRO COMPANY_SETTINGS:", settingsError);
  } else {
    console.log("SUCESSO COMPANY_SETTINGS:", settingsData);
  }

}

run();
