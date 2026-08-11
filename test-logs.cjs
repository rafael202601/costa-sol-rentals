const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query("INSERT INTO public.activity_logs (acao, usuario) VALUES ('Teste', 'Admin') RETURNING *")).then(res => { console.log(res.rows); c.end(); }).catch(e => { console.error(e); c.end(); })
