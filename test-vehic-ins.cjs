const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'});
c.connect().then(() => c.query(`INSERT INTO public.vehicles (nome, placa, modelo, cor, motorista_nome) VALUES ('Caminhao 01', 'ABC1234', 'F250', 'Branco', 'Joao') RETURNING *`)).then(res => { console.log(res.rows); c.end(); }).catch(e => { console.error(e); c.end(); })
