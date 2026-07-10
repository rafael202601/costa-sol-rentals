const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sotluugxlslvmhfmoidm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGx1dWd4bHNsdm1oZm1vaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk2NzUsImV4cCI6MjA5ODgyNTY3NX0.VCGcAQgtgrKBgAqsBZzGnAkG4e63P-TmXKCxxevg8wk'
);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@costasol.com',
    password: '123456'
  });

  if (authError) {
    console.error("ERRO LOGIN:", authError);
    return;
  }
  
  console.log("Logged in:", authData.user.id);

  const payload = {
    codigo_cliente: "CLI-002",
    tipo_perfil: "comum",
    nome_razao_social: "Teste Autenticado",
    fantasia: "",
    cpf_cnpj: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    rg: "",
    data_nascimento: "",
    email: "",
    telefone1: "",
    telefone2: "",
    telefone3: "",
    conjuge_contato: "",
    socio: "",
    socio_cpf: "",
    nome_pai: "",
    nome_mae: "",
    empreiteiro_id: "",
    empreiteiro_nome: "",
    obras: [],
    endereco_entrega_rua: "",
    endereco_entrega_numero: "",
    endereco_entrega_complemento: "",
    endereco_entrega_bairro: "",
    endereco_entrega_cidade: "",
    endereco_entrega_uf: "",
    endereco_entrega_cep: "",
    endereco_cobranca_rua: "",
    endereco_cobranca_numero: "",
    endereco_cobranca_complemento: "",
    endereco_cobranca_bairro: "",
    endereco_cobranca_cidade: "",
    endereco_cobranca_uf: "",
    endereco_cobranca_cep: "",
    pessoas_liberadas: [],
    etiquetas: [],
    data_validade_cadastro: "2027-01-09",
    bloqueado: false,
    pendencia_financeira: false,
    status_serasa: "limpo",
    observacoes: "",
    motivo_bloqueio: "",
    financeiro_bloqueio_automatico: false,
    financeiro_limite_bloqueio: 0,
    financeiro_dias_carencia: 0,
    financeiro_faturamento_automatico: false,
    financeiro_intervalo_faturamento: 30,
    financeiro_observacoes: "",
    foto_url: ""
  };

  const { data, error } = await supabase.from('clients').insert([payload]).select();
  
  if (error) {
    console.error("ERRO SUPABASE:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCESSO:", data);
  }
}

run();
