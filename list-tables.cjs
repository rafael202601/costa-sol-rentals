const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).then(res => { console.log(res.rows.map(r => r.table_name).sort()); c.end(); })
