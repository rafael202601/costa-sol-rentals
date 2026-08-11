const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'base44', 'functions');
const destDir = path.join(__dirname, 'supabase', 'functions');

const foldersToMigrate = [
  'webhookWhatsapp',
  'automacaoCaixa',
  'enviarCobrancasAutomaticas',
  'atualizarContratosDiarios',
  'enviarMensagemHumana',
  'searchClients',
  'countClients',
  'generateSequentialCode'
];

foldersToMigrate.forEach(folder => {
  const srcFile = path.join(srcDir, folder, 'entry.ts');
  if (fs.existsSync(srcFile)) {
    // Map folder to snake case / kebab case for Supabase standard
    const newFolderName = folder.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const newDir = path.join(destDir, newFolderName);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

    let content = fs.readFileSync(srcFile, 'utf8');
    
    // Replace the Base44 SDK import with our shim
    content = content.replace(
      /import\s+\{\s*createClientFromRequest\s*\}\s+from\s+['"]npm:@base44\/sdk[^'"]*['"]/g,
      `import { createClientFromRequest } from '../shared/base44Client.ts'`
    );

    // Also replace other npm imports if necessary (Supabase Edge functions support npm: via Deno 1.28+)
    // But we don't need to change `npm:openai` or `npm:@google/generative-ai`, they work fine in Supabase Edge Functions.

    // Wrap the serve handler properly if it's not wrapped.
    // In Base44, entry.ts usually exports default async function(req).
    // In Deno standard (Supabase), we need Deno.serve(async (req) => { ... })
    // Let's check if Deno.serve is present.
    if (!content.includes('Deno.serve')) {
      // Find export default function or export default async function
      content = content.replace(/export\s+default\s+(?:async\s+)?function(?:\s*\w+)?\s*\(([^)]+)\)\s*\{/g, 'Deno.serve(async ($1) => {');
      content += '\n});\n'; // close Deno.serve
    }

    fs.writeFileSync(path.join(newDir, 'index.ts'), content);
    console.log(`✅ Migrated ${folder} -> ${newFolderName}/index.ts`);
  }
});
