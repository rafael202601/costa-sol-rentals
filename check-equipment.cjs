const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'equipment'")).then(res => { console.log(res.rows); c.end(); })
