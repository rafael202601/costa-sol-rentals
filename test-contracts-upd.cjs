const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query(`UPDATE public.contracts SET data_entrega_real = 'Teste Logistica' WHERE id = '6495d928-41fe-4070-8ea3-a281a271cb9c' RETURNING id`)).then(res => { console.log("OK", res.rows); c.end(); }).catch(e => { console.error(e); c.end(); })
