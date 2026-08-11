const { base44 } = require('./src/api/base44Client.js');

async function testVehicles() {
  try {
    const v = await base44.entities.Vehicle.create({
      nome: "Caminhão 01", placa: "ABC1234", modelo: "F-250", marca: "Ford", ano: 2024, 
      cor: "Branco", tipo: "caminhao", motorista_nome: "João", km_atual: 15000, 
      status: "ativo", observacoes: "Teste"
    });
    console.log("Vehicle created successfully:", v.id);
    
    const e = await base44.entities.VehicleExpense.create({
      vehicle_id: v.id, vehicle_placa: "ABC1234", vehicle_modelo: "F-250", 
      tipo: "combustivel", descricao: "Gasolina", valor: 150,
      data: "2024-07-09", km: 15050, fornecedor: "Posto Ipiranga", observacoes: ""
    });
    console.log("Expense created successfully:", e.id);
  } catch (err) {
    console.error("Error:", err);
  }
}

testVehicles();
