/**
 * CÁLCULO CENTRALIZADO DE CONTRATO
 *
 * Grupos:
 *  A — itens com aplica_valor_minimo = true  → aplica regra de dias mínimos e valor mínimo
 *  B — itens com aplica_valor_minimo = false → cobra apenas dias reais de uso
 *
 * Ordem de cálculo:
 *  1. Calcular valor_base de cada item (grupo A com mínimo, grupo B proporcional)
 *  2. Somar grupo A → aplicar valorMinimoContrato global se necessário
 *  3. Somar grupo B → sem mínimo
 *  4. Aplicar desconto automático por tempo (sobre valor_base antes do frete)
 *  5. valor_total = (grupoA + grupoB) - desconto_auto + frete
 */

/**
 * Calcula valor base de um item respeitando ou não o mínimo de dias.
 * REGRA: o mínimo de dias é controlado EXCLUSIVAMENTE pelo equipamento (dias_minimos_proprio).
 * Nenhum fallback global é permitido.
 *
 * @param {object} item - item do contrato
 * @param {number} diasContrato
 * @returns {{ valorBase, diasEfetivos, minimoAplicado, temMinimo }}
 */
export function calcItemValorBase(item, diasContrato) {
  const qty = item.quantidade_retirada || 1;
  // Prioriza valor_diario; se ausente mas tem aplica_valor_minimo=true, usa valor_unitario como diário
  const valorDiario = item.valor_diario > 0
    ? item.valor_diario
    : (item.aplica_valor_minimo === true && item.valor_unitario > 0 ? item.valor_unitario : 0);

  // Se não tem valor diário reconhecível e tipo é mensal, usa valor_unitario fixo sem regra de dias
  if (valorDiario <= 0 || item.tipo_cobranca === "mensal") {
    return {
      valorBase: (item.valor_unitario || 0) * qty,
      valorDiarioTotal: 0,
      diasEfetivos: diasContrato,
      minimoAplicado: false,
      temMinimo: false,
    };
  }

  // Regra 100% por equipamento: aplica_valor_minimo controla se há mínimo
  const temMinimo = item.aplica_valor_minimo === true;

  if (!temMinimo) {
    // Sem mínimo: cobra apenas dias reais
    return {
      valorBase: valorDiario * diasContrato * qty,
      valorDiarioTotal: valorDiario * qty,
      diasEfetivos: diasContrato,
      minimoAplicado: false,
      temMinimo: false,
    };
  }

  // Com mínimo: usa dias_minimos_proprio do equipamento (obrigatório, sem fallback global)
  const diasMin = item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : 5;
  const diasEfetivos = Math.max(diasContrato, diasMin);
  const minimoAplicado = diasContrato < diasMin;

  return {
    valorBase: valorDiario * diasEfetivos * qty,
    valorDiarioTotal: valorDiario * qty,
    diasEfetivos,
    minimoAplicado,
    temMinimo: true,
    diasMinUsados: diasMin,
  };
}

/**
 * Encontra a regra de desconto por tempo de locação para os dias informados.
 * @param {Array} regras - settings.regras_desconto_tempo
 * @param {number} dias
 * @returns {{ regra, valorDesconto, descricao } | null}
 */
export function calcDescontoAutomatico(regras = [], dias = 0, valorBase = 0) {
  if (!regras || regras.length === 0 || dias <= 0 || valorBase <= 0) return null;

  // Pegar a regra mais alta que se aplica (maior dias_minimos <= dias)
  const aplicaveis = regras
    .filter((r) => r.dias_minimos > 0 && dias >= r.dias_minimos)
    .sort((a, b) => b.dias_minimos - a.dias_minimos);

  if (aplicaveis.length === 0) return null;

  const regra = aplicaveis[0];
  let valorDesconto = 0;

  if (regra.tipo === "percentual") {
    valorDesconto = (valorBase * (regra.valor || 0)) / 100;
  } else {
    valorDesconto = regra.valor || 0;
  }

  return {
    regra,
    valorDesconto: Math.max(0, Math.min(valorDesconto, valorBase)),
    descricao: regra.tipo === "percentual"
      ? `Desconto de ${regra.valor}% para locações acima de ${regra.dias_minimos} dias`
      : `Desconto fixo de R$ ${regra.valor?.toFixed(2)} para locações acima de ${regra.dias_minimos} dias`,
  };
}

/**
 * Próxima faixa de desconto (para sugestão comercial)
 */
export function getProximaFaixaDesconto(regras = [], dias = 0) {
  if (!regras || regras.length === 0) return null;
  const proximas = regras
    .filter((r) => r.dias_minimos > dias)
    .sort((a, b) => a.dias_minimos - b.dias_minimos);
  return proximas[0] || null;
}

/**
 * Calcula o valor total do contrato respeitando TODAS as regras.
 * IMPORTANTE: dias mínimos são por equipamento, não globais.
 */
export function calcContractTotal({
  itens = [],
  diasContrato = 30,
  valorMinimoContrato = 0,
  frete = 0,
  sinal = 0,
  valorPago = 0,
  regrasDesconto = [],
  // Parâmetros legados ignorados — mantidos apenas para não quebrar chamadas antigas
  diasMinimos,
}) {
  // ─── PASSO 1: calcular cada item (mínimo por equipamento, sem global)
  const itensCalculados = itens.map((item) => {
    const calc = calcItemValorBase(item, diasContrato);
    const desconto = item.desconto || 0;
    const subtotal = Math.max(0, calc.valorBase - desconto);
    return {
      ...item,
      _valorBase: calc.valorBase,
      _diasEfetivos: calc.diasEfetivos,
      _minimoAplicado: calc.minimoAplicado,
      _temMinimo: calc.temMinimo,
      _diasMinUsados: calc.diasMinUsados,
      _subtotal: subtotal,
    };
  });

  // ─── PASSO 2: separar grupos
  const grupoA = itensCalculados.filter((i) => i._temMinimo);
  const grupoB = itensCalculados.filter((i) => !i._temMinimo);

  const somaA = grupoA.reduce((s, i) => s + (i._subtotal || 0), 0);
  const somaB = grupoB.reduce((s, i) => s + (i._subtotal || 0), 0);

  // ─── PASSO 3: aplicar mínimo global só no grupo A
  const valorMinConfig = valorMinimoContrato || 0;
  let valorBaseA = somaA;
  let minimoGlobalAplicado = false;
  if (valorMinConfig > 0 && somaA < valorMinConfig && grupoA.length > 0) {
    valorBaseA = valorMinConfig;
    minimoGlobalAplicado = true;
  }

  const valorBaseTotal = valorBaseA + somaB;

  // ─── PASSO 4: desconto automático por tempo
  const descontoInfo = calcDescontoAutomatico(regrasDesconto, diasContrato, valorBaseTotal);
  const valorDescontoAuto = descontoInfo?.valorDesconto || 0;

  // ─── PASSO 5: total final
  const valorComDesconto = valorBaseTotal - valorDescontoAuto;
  const valorTotal = valorComDesconto + (frete || 0);
  const saldoPagar = Math.max(0, valorTotal - (valorPago || 0) - (sinal || 0));

  const proximaFaixa = getProximaFaixaDesconto(regrasDesconto, diasContrato);

  return {
    itensCalculados,
    grupoA,
    grupoB,
    somaA,
    somaB,
    valorBaseA,
    valorBaseTotal,
    valorDescontoAuto,
    descontoInfo,
    proximaFaixa,
    valorTotal,
    saldoPagar,
    minimoAplicado: minimoGlobalAplicado || itensCalculados.some((i) => i._minimoAplicado),
    minimoGlobalAplicado,
    detalhes: {
      somaItens: valorBaseTotal,
      somaA,
      somaB,
      valorMinConfig,
      diasContrato,
      frete,
    },
  };
}

/**
 * Calcula o valor mínimo de locação para um conjunto de itens do Grupo A.
 * Regra: soma de (diária × diasMin × qtd) por item, depois compara com valorMinimoContrato global.
 * Se o valor calculado for menor que o mínimo configurado nos parâmetros, usa o mínimo configurado.
 * Usado na cláusula 2, resumo financeiro e PDF — fonte única de verdade.
 */
export function calcValorMinimoLocacao(itensGrupoA = [], diasMinimoGlobal = 5, valorMinimoContrato = 0) {
  const valorCalculado = itensGrupoA.reduce((total, item) => {
    const qty = item.quantidade_retirada || 1;
    const diaria = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
    const diasMin = item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : diasMinimoGlobal;
    return total + diaria * diasMin * qty;
  }, 0);
  return Math.max(valorCalculado, valorMinimoContrato || 0);
}

/**
 * Retorna o número de dias do contrato
 * Se sem_prazo=true ou prazo_valor=0, usa pelo menos os dias mínimos globais (fallback 30).
 */
export function getDiasContrato(form) {
  if (form.sem_prazo) return Number(form.prazo_valor) || 30;
  const dias = form.prazo_tipo === "dias"
    ? Number(form.prazo_valor) || 30
    : (Number(form.prazo_valor) || 1) * 30;
  // Garante pelo menos 1 dia real; o mínimo por equipamento é aplicado em calcItemValorBase
  return Math.max(1, dias);
}