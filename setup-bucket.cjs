const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

const setupBucket = async () => {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    // Create the 'arquivos' bucket if it doesn't exist
    const createBucketSql = `
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('arquivos', 'arquivos', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `;
    await client.query(createBucketSql);
    console.log("Bucket 'arquivos' created/updated successfully.");

    // Allow public access to read files
    const selectPolicySql = `
      CREATE POLICY "Public Access" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'arquivos');
    `;
    try { await client.query(selectPolicySql); console.log("Created SELECT policy."); } catch (e) { console.log("SELECT policy already exists."); }

    // Allow authenticated users to upload files
    const insertPolicySql = `
      CREATE POLICY "Auth Upload" ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'arquivos');
    `;
    try { await client.query(insertPolicySql); console.log("Created INSERT policy."); } catch (e) { console.log("INSERT policy already exists."); }

    // Allow authenticated users to delete their files (or all files for simplicity since it's a small app)
    const deletePolicySql = `
      CREATE POLICY "Auth Delete" ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'arquivos');
    `;
    try { await client.query(deletePolicySql); console.log("Created DELETE policy."); } catch (e) { console.log("DELETE policy already exists."); }
    
    // Allow anon users to upload files if they are somehow considered anon (which might happen)
    const insertAnonPolicySql = `
      CREATE POLICY "Anon Upload" ON storage.objects
      FOR INSERT
      TO anon
      WITH CHECK (bucket_id = 'arquivos');
    `;
    try { await client.query(insertAnonPolicySql); console.log("Created Anon INSERT policy."); } catch (e) { console.log("Anon INSERT policy already exists."); }


    console.log("All storage policies configured successfully!");
  } catch (err) {
    console.error("Error setting up bucket:", err);
  } finally {
    await client.end();
  }
};

setupBucket();
