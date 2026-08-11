const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres';

async function addMissingColumns(tableName, payload) {
  const client = new Client({ connectionString });
  await client.connect();

  const { rows } = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [tableName]);

  const existingColumns = new Set(rows.map(r => r.column_name));
  const missingColumns = Object.keys(payload).filter(k => !existingColumns.has(k) && k !== 'id');

  if (missingColumns.length > 0) {
    console.log(`[${tableName}] Missing columns:`, missingColumns);
    for (const col of missingColumns) {
      const type = typeof payload[col] === 'boolean' ? 'boolean' : 
                   typeof payload[col] === 'number' ? 'numeric' : 
                   Array.isArray(payload[col]) || typeof payload[col] === 'object' && payload[col] !== null ? 'jsonb' : 'text';
      
      console.log(`Adding ${col} as ${type} to ${tableName}...`);
      await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
    }
  } else {
    console.log(`[${tableName}] No missing columns.`);
  }

  await client.end();
}

const payloads = {
  clients: {
    codigo_cliente: "", tipo_perfil: "comum", nome_razao_social: "", fantasia: "", cpf_cnpj: "", inscricao_estadual: "",
    inscricao_municipal: "", rg: "", data_nascimento: "", email: "", telefone1: "", telefone2: "", telefone3: "", conjuge_contato: "",
    socio: "", socio_cpf: "", nome_pai: "", nome_mae: "", empreiteiro_id: "", empreiteiro_nome: "", obras: [],
    endereco_entrega_rua: "", endereco_entrega_numero: "", endereco_entrega_complemento: "",
    endereco_entrega_bairro: "", endereco_entrega_cidade: "", endereco_entrega_uf: "", endereco_entrega_cep: "",
    endereco_cobranca_rua: "", endereco_cobranca_numero: "", endereco_cobranca_complemento: "",
    endereco_cobranca_bairro: "", endereco_cobranca_cidade: "", endereco_cobranca_uf: "", endereco_cobranca_cep: "",
    pessoas_liberadas: [], etiquetas: [], data_validade_cadastro: "", bloqueado: false, pendencia_financeira: false,
    status_serasa: "limpo", observacoes: "", motivo_bloqueio: "", financeiro_bloqueio_automatico: false,
    financeiro_limite_bloqueio: 0, financeiro_dias_carencia: 0, financeiro_faturamento_automatico: false,
    financeiro_intervalo_faturamento: 30, financeiro_observacoes: "", foto_url: ""
  },
  equipment: {
    nome: "", marca: "", modelo: "", tipos: ["equipamento"], voltagem: "nao_aplicavel",
    codigo: "", foto_url: "", link_externo: "", quantidade_total: 1, quantidade_disponivel: 1,
    quantidade_manutencao: 0, status_item: "disponivel", valor_diario: 0, valor_mensal: 0,
    valor_indenizacao: 0, descricao: "", ativo: true, aplica_valor_minimo: true, dias_minimos_proprio: 0,
    aplica_desconto_automatico: false, controle_individual: false, numeracoes: []
  },
  products: {
    nome: "", codigo: "", categoria: "", tipo: "venda", marca: "", modelo: "", codigo_barras: "",
    unidade_medida: "un", quantidade_estoque: 0, estoque_minimo: 0, valor_custo: 0, valor_venda: 0,
    margem_lucro: 0, fornecedor_id: "", localizacao_estoque: "", descricao: "", observacoes: "",
    ativo: true, permitir_venda_sem_estoque: false, avisar_estoque_baixo: true, foto_url: ""
  },
  vehicles: {
    marca: "", modelo: "", placa: "", chassi: "", renavam: "", ano_fabricacao: "", ano_modelo: "",
    cor: "", categoria: "carro_passeio", combustivel: "flex", km_atual: 0, status: "ativo",
    data_aquisicao: "", valor_aquisicao: 0, capacidade_carga: "", vencimento_ipva: "", vencimento_seguro: "",
    proxima_revisao_km: 0, proxima_revisao_data: "", observacoes: "", ativo: true, foto_url: ""
  },
  drivers: {
    nome: "", cpf: "", cnh_numero: "", cnh_categoria: "", cnh_vencimento: "",
    telefone: "", email: "", data_nascimento: "", endereco: "",
    status: "ativo", observacoes: "", foto_url: "", ativo: true
  },
  quotes: {
    client_id: "", client_nome: "", itens: [], valor_total: 0, desconto: 0,
    frete: 0, data_validade: "", observacoes: "", status: "pendente",
    link_pdf: "", cliente_id: ""
  },
  feedbacks: {
    client_id: "", os_id: "", contrato_id: "", nota: 5, comentario: "", categoria: "", data: ""
  }
};

async function run() {
  for (const [table, payload] of Object.entries(payloads)) {
    await addMissingColumns(table, payload);
  }
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(`NOTIFY pgrst, 'reload schema'`);
  await client.end();
}

run().catch(console.error);
