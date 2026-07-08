import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sotluugxlslvmhfmoidm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGx1dWd4bHNsdm1oZm1vaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk2NzUsImV4cCI6MjA5ODgyNTY3NX0.VCGcAQgtgrKBgAqsBZzGnAkG4e63P-TmXKCxxevg8wk';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Anon Key must be provided in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Utility helper to replace base44.integrations.Core.UploadFile
export const uploadFile = async ({ file }) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error, data } = await supabase.storage
    .from('arquivos') // Ensure you have a public bucket named 'arquivos' in Supabase
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('arquivos')
    .getPublicUrl(filePath);

  return { file_url: urlData.publicUrl };
};

