const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function testUserInsert() {
  // Sign in as admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@costasol.com',
    password: '123456'
  });
  
  if (authErr) {
    console.error("Auth Error:", authErr);
    return;
  }
  console.log("Logged in:", authData.user.email);

  // Try insert task
  const { data, error } = await supabase.from('tasks').insert({
    titulo: 'Test Task ' + Date.now(),
    status: 'pendente',
    prioridade: 'alta'
  }).select();
  
  if (error) console.error("Task Insert Error:", error);
  else console.log("Task Insert Success!", data[0].id);

  // Try insert cash register
  const { error: cashErr } = await supabase.from('cash_registers').insert({
    status: 'aberto'
  });
  if (cashErr) console.error("Cash Register Insert Error:", cashErr);
  else console.log("Cash Register Insert Success!");
}

testUserInsert();
