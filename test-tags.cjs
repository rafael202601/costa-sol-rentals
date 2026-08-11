const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query("INSERT INTO public.client_tags (nome, cor) VALUES ('VIP', '#f00') RETURNING *")).then(res => { console.log(res.rows); c.end(); }).catch(e => { console.error(e); c.end(); })
