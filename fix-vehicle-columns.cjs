const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const alterTables = async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const sql = `
      -- Adding missing columns to vehicles to match the frontend form
      ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS nome text;
      ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS cor text;
      ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS motorista_nome text;

      -- Adding missing columns to vehicle_expenses to match the frontend form
      ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS vehicle_id text;
      ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS vehicle_placa text;
      ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS vehicle_modelo text;
      ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS fornecedor text;
      ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS observacoes text;
    `;

    console.log("Executing ALTER TABLE scripts...");
    await client.query(sql);
    console.log("Columns added successfully!");

    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Cache reloaded!");

  } catch (err) {
    console.error("Error altering tables:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

alterTables();
