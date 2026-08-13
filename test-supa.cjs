const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabase.from('contracts').select('*').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
  
  const { data: d2, error: e2 } = await supabase.from('service_orders').select('*').limit(1);
  console.log('SO Data:', d2);
  console.log('SO Error:', e2);
})();
