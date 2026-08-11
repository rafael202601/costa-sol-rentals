import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sotluugxlslvmhfmoidm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGx1dWd4bHNsdm1oZm1vaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk2NzUsImV4cCI6MjA5ODgyNTY3NX0.VCGcAQgtgrKBgAqsBZzGnAkG4e63P-TmXKCxxevg8wk';
const supabase = createClient(supabaseUrl, supabaseKey);

const tableMap = {
  CompanySettings: 'company_settings',
  User: 'users',
  Client: 'clients',
  Vehicle: 'vehicles',
  VehicleExpense: 'vehicle_expenses',
  Equipment: 'equipment',
  Contract: 'contracts',
  ServiceOrder: 'service_orders',
  Sale: 'sales',
  Product: 'products',
  Driver: 'drivers',
  Task: 'tasks',
  MuralPost: 'mural_posts',
  PaymentRequest: 'payment_requests',
  Quote: 'quotes',
  CashEntry: 'cash_entries',
  BillingNote: 'billing_notes',
  Announcement: 'announcements',
  Feedback: 'feedbacks',
  ActivityLog: 'activity_logs',
  AgentSettings: 'agent_settings',
  CashAutoConfig: 'cash_auto_configs',
  CashRegister: 'cash_registers',
  ClientTag: 'client_tags',
  ConversationState: 'conversation_states',
  Counter: 'counters',
  FluxoIA: 'fluxos_ia',
  IntegraWebhookAWS: 'integra_webhooks_aws',
  Intervention: 'interventions',
  WhatsappLog: 'whatsapp_logs'
};

const payloads = {
  company_settings: { },
  users: { },
  clients: { nome_razao_social: "TESTE AUTOMAÇÃO CLIENTE" },
  vehicles: { placa: "TST-0000" },
  vehicle_expenses: { descricao: "Teste" },
  equipment: { nome: "Teste Equip" },
  contracts: { numero: "TEST-001" },
  service_orders: { status: "Aberta" },
  sales: { status: "Fechada" },
  products: { nome: "Produto Teste" },
  drivers: { nome: "Motorista Teste" },
  tasks: { titulo: "Tarefa Teste" },
  mural_posts: { titulo: "Post Teste" },
  payment_requests: { descricao: "Request Teste" },
  quotes: { status: "Pendente" },
  cash_entries: { descricao: "Entrada Teste" },
  billing_notes: { descricao: "Nota Teste" },
  announcements: { titulo: "Anuncio Teste" },
  feedbacks: { mensagem: "Teste" },
  activity_logs: { acao: "Teste" },
  agent_settings: { },
  cash_auto_configs: { },
  cash_registers: { status: "aberto" },
  client_tags: { nome: "Tag" },
  conversation_states: { },
  counters: { },
  fluxos_ia: { nome: "Fluxo" },
  integra_webhooks_aws: { },
  interventions: { },
  whatsapp_logs: { }
};

async function runAllTests() {
  console.log("🚀 Autenticando com credenciais de administrador...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@costasol.com',
    password: '123456',
  });

  if (authError) {
    console.error("❌ Erro de Autenticação:", authError.message);
    process.exit(1);
  }

  console.log("✅ Autenticado. Iniciando varredura CRUD nas 30 tabelas mapeadas...\n");

  const results = [];
  
  for (const [entityName, tableName] of Object.entries(tableMap)) {
    let status = { entity: entityName, table: tableName, create: false, update: false, delete: false, error: null };
    try {
      // Usa um payload muito simples para evitar erros de restrição de FK sempre que possível
      const payload = payloads[tableName] || {};
      
      // CREATE
      const { data: createData, error: createError } = await supabase.from(tableName).insert([payload]).select();
      if (createError) {
        // Se a tabela não existe
        if (createError.code === '42P01') {
          throw new Error(`TABELA NÃO EXISTE NO BANCO`);
        }
        throw new Error(`CREATE FAILED: ${createError.message}`);
      }
      status.create = true;
      const createdId = createData[0].id || createData[0].codigo || createData[0].uuid; // handle non-id keys?
      const idCol = createData[0].id ? 'id' : Object.keys(createData[0])[0];
      const idVal = createData[0][idCol];

      // UPDATE
      const { error: updateError } = await supabase.from(tableName).update(payload).eq(idCol, idVal);
      if (updateError) throw new Error(`UPDATE FAILED: ${updateError.message}`);
      status.update = true;

      // DELETE
      const { error: deleteError } = await supabase.from(tableName).delete().eq(idCol, idVal);
      if (deleteError) throw new Error(`DELETE FAILED: ${deleteError.message}`);
      status.delete = true;

      console.log(`✅ [${entityName}] -> Teste concluído com sucesso.`);
    } catch (err) {
      status.error = err.message;
      console.log(`❌ [${entityName}] -> ${err.message}`);
    }
    results.push(status);
  }

  console.log("\n📊 RESUMO DOS TESTES:");
  let successCount = 0;
  let failCount = 0;
  for (const r of results) {
    if (r.create && r.update && r.delete) {
      successCount++;
    } else {
      failCount++;
    }
  }
  console.log(`✅ Sucessos: ${successCount} tabelas`);
  console.log(`❌ Falhas: ${failCount} tabelas`);
}

runAllTests();
