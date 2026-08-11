const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query("SELECT * FROM public.equipment")).then(res => { console.log("Equipments in DB:", res.rows.length); console.log(res.rows); c.end(); })
