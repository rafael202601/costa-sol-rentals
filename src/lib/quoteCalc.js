/**
 * Lógica centralizada de cálculo de orçamentos.
 * Aplica regras de cobrança mínima e desconto automático por equipamento,
 * consistente com as regras dos Contratos.
 */

/**
 * Calcula o valor de um item de orçamento respeitando:
 * 1. Dias mínimos do equipamento (se aplica_valor_minimo = true)
 * 2. Desconto automático (somente se aplica_desconto_automatico = true)
 *
 * @returns { valorBase, diasEfetivos, minimoAplicado, desconto, subtotal }
 */
export function calcItemOrcamento({ item, eq, diasPeriodo, regrasDesconto }) {
  const qtd = item.quantidade || 0;
  const valDiario = item.valor_unitario || 0;
  const descontoManual = item.desconto || 0;

  // 1. Calcular dias efetivos (regra mínima do equipamento)
  let diasEfetivos = diasPeriodo || 0;
  let minimoAplicado = false;

  if (eq && eq.aplica_valor_minimo !== false) {
    const diasMin = eq.dias_minimos_proprio > 0 ? eq.dias_minimos_proprio : 0;
    if (diasMin > 0 && diasPeriodo > 0 && diasPeriodo < diasMin) {
      diasEfetivos = diasMin;
      minimoAplicado = true;
    }
  }

  // 2. Valor base (qtd × diária × dias efetivos)
  const valorBase = diasEfetivos > 0
    ? qtd * valDiario * diasEfetivos
    : qtd * valDiario;

  // 3. Desconto automático (somente se equipamento permite)
  let descontoAuto = 0;
  if (eq && eq.aplica_desconto_automatico === true && regrasDesconto?.length > 0 && diasEfetivos > 0) {
    // Encontrar a regra de desconto aplicável (maior dias_minimos <= diasEfetivos)
    const regraAplicavel = [...regrasDesconto]
      .filter(r => r.dias_minimos <= diasEfetivos)
      .sort((a, b) => b.dias_minimos - a.dias_minimos)[0];
    if (regraAplicavel) {
      if (regraAplicavel.tipo === "percentual") {
        descontoAuto = valorBase * (regraAplicavel.valor / 100);
      } else {
        descontoAuto = regraAplicavel.valor;
      }
    }
  }

  // 4. Desconto total = manual + automático
  const descontoTotal = descontoManual + descontoAuto;

  // 5. Subtotal
  const subtotal = Math.max(0, valorBase - descontoTotal);

  return {
    valorBase,
    diasEfetivos,
    minimoAplicado,
    descontoAuto,
    descontoTotal,
    subtotal,
  };
}

/**
 * Calcula o total do orçamento aplicando todas as regras:
 * 1. Soma subtotais dos itens (com dias mínimos e desconto por equipamento)
 * 2. Compara com valor mínimo de contrato (sem frete)
 * 3. Soma frete ao final
 *
 * @returns { totalEquipamentos, totalComMinimo, frete, totalFinal, minimoContratoAplicado, valorMinimoContrato }
 */
export function calcTotalOrcamento({ itens, equipamentos, diasPeriodo, settings }) {
  const regrasDesconto = settings?.regras_desconto_tempo || [];
  const valorMinimoContrato = settings?.valor_minimo_contrato || 0;
  const frete = 0; // frete não entra no cálculo do mínimo

  // 1. Somar subtotais dos itens
  let totalEquipamentos = 0;
  const itensPorItens = (itens || []).map(item => {
    const eq = equipamentos?.find(e => e.id === item.equipamento_id);
    const resultado = calcItemOrcamento({ item, eq, diasPeriodo, regrasDesconto });
    totalEquipamentos += resultado.subtotal;
    return { ...item, ...resultado };
  });

  // 2. Comparar com mínimo de contrato (sem frete)
  let totalComMinimo = totalEquipamentos;
  let minimoContratoAplicado = false;

  if (valorMinimoContrato > 0 && totalEquipamentos < valorMinimoContrato && totalEquipamentos > 0) {
    totalComMinimo = valorMinimoContrato;
    minimoContratoAplicado = true;
  }

  // Soma da diária total = soma de (qtd × valor_unitario) de todos os itens
  const totalDiaria = (itens || []).reduce((acc, item) => {
    return acc + (item.quantidade || 0) * (item.valor_unitario || 0);
  }, 0);

  return {
    totalEquipamentos,
    totalComMinimo,
    frete,
    totalFinal: totalComMinimo, // frete é somado fora
    minimoContratoAplicado,
    valorMinimoContrato,
    itensPorItens,
    totalDiaria,
  };
}

/**
 * Retorna a descrição de cobrança mínima para uso no PDF.
 */
export function getMinimoDescricao(itensPorItens, minimoContratoAplicado, valorMinimoContrato) {
  const notas = [];

  if (minimoContratoAplicado) {
    notas.push(`Valor calculado considerando valor mínimo de locação de R$ ${valorMinimoContrato.toFixed(2)} conforme configuração do sistema.`);
  }

  const itensComMinimo = (itensPorItens || []).filter(i => i.minimoAplicado);
  if (itensComMinimo.length > 0) {
    const diasUnicos = [...new Set(itensComMinimo.map(i => i.diasEfetivos))];
    diasUnicos.forEach(d => {
      const nomes = itensComMinimo
        .filter(i => i.diasEfetivos === d)
        .map(i => i.equipamento_nome)
        .join(", ");
      notas.push(`Valor calculado considerando cobrança mínima de ${d} dias conforme configuração do equipamento (${nomes}).`);
    });
  }

  return notas;
}