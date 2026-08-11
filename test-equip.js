const { base44 } = require('./src/api/base44Client.js');

async function testInsert() {
  const data = {
      nome: "Equipamento Teste", marca: "", modelo: "",
      tipos: ["andaime"],
      voltagem: "nao_aplicavel",
      codigo: "EQP-001", foto_url: "",
      quantidade_total: 1,
      quantidade_disponivel: 1,
      quantidade_manutencao: 0,
      status_item: "disponivel",
      link_externo: "",
      valor_diario: 10, valor_mensal: 300,
      valor_indenizacao: 1000,
      descricao: "Teste", ativo: true,
      aplica_valor_minimo: true,
      dias_minimos_proprio: 3,
      aplica_desconto_automatico: false,
      controle_individual: false,
      numeracoes: []
  };

  try {
    const res = await base44.entities.Equipment.create(data);
    console.log("Success:", res);
  } catch (err) {
    console.error("Error inserting:", err);
  }
}

testInsert();
