const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log("Testing Task insertion...");
  const { data, error } = await supabase.from('tasks').insert({
    titulo: 'Test Task ' + Date.now(),
    status: 'pendente',
    prioridade: 'alta'
  }).select();
  
  if (error) {
    console.error("Task Insert Error:", error);
  } else {
    console.log("Task Insert Success:", data);
  }

  console.log("Testing Company Settings insertion...");
  const { data: cData, error: cError } = await supabase.from('company_settings').insert({
    nome_fantasia: 'Test Name ' + Date.now()
  }).select();

  if (cError) {
    console.error("Company Settings Insert Error:", cError);
  } else {
    console.log("Company Settings Insert Success:", cData);
  }
}

testInsert();
