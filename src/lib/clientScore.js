/**
 * Sistema de Score Interno do Cliente
 * Pontuação baseada no comportamento de pagamentos
 */

export const SCORE_CONFIG = {
  inicial: 100,
  // Adições
  pagamento_antecipado: +10,
  pagamento_no_prazo: +5,
  cliente_recorrente: +5,
  // Reduções
  atraso_ate_5_dias: -10,
  atraso_6_a_15_dias: -20,
  atraso_mais_15_dias: -40,
  negativado: -50,
};

export function calcularClassificacao(score) {
  if (score >= 80) return { label: "Excelente", color: "emerald", limiteCreditoLabel: "R$ 10.000", limiteCredito: 10000 };
  if (score >= 60) return { label: "Bom", color: "blue", limiteCreditoLabel: "R$ 5.000", limiteCredito: 5000 };
  if (score >= 40) return { label: "Regular", color: "amber", limiteCreditoLabel: "R$ 2.000", limiteCredito: 2000 };
  return { label: "Alto Risco", color: "red", limiteCreditoLabel: "R$ 0", limiteCredito: 0 };
}

export function getScoreBadgeClass(score) {
  const c = calcularClassificacao(score);
  const map = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
  };
  return map[c.color] || map.amber;
}

/**
 * Calcula o score com base no histórico de contratos do cliente
 * @param {Array} contracts - contratos do cliente
 * @returns {number} score calculado
 */
export function calcularScoreFromContracts(contracts) {
  if (!contracts || contracts.length === 0) return SCORE_CONFIG.inicial;

  let score = SCORE_CONFIG.inicial;
  const finalizados = contracts.filter((c) => c.status === "finalizado" || c.status_financeiro === "pago");

  // Cliente recorrente (mais de 2 contratos)
  if (finalizados.length >= 2) score += SCORE_CONFIG.cliente_recorrente;
  if (finalizados.length >= 5) score += SCORE_CONFIG.cliente_recorrente; // bônus extra

  // Analisar contratos finalizados
  finalizados.forEach((c) => {
    const dataBase = c.dinamico_data_base || c.data_prevista_termino;
    const dataPrevista = c.data_prevista_termino;

    if (dataBase && dataPrevista) {
      try {
        const dtBase = new Date(dataBase);
        const dtPrev = new Date(dataPrevista);
        const diasAtraso = Math.floor((dtBase - dtPrev) / (1000 * 60 * 60 * 24));

        if (diasAtraso < 0) {
          // Pagou antecipado
          score += SCORE_CONFIG.pagamento_antecipado;
        } else if (diasAtraso === 0) {
          score += SCORE_CONFIG.pagamento_no_prazo;
        } else if (diasAtraso <= 5) {
          score += SCORE_CONFIG.atraso_ate_5_dias;
        } else if (diasAtraso <= 15) {
          score += SCORE_CONFIG.atraso_6_a_15_dias;
        } else {
          score += SCORE_CONFIG.atraso_mais_15_dias;
        }
      } catch {
        // ignorar erros de data
      }
    }
  });

  // Penalidade por status_serasa negativado
  const ultimoContrato = contracts[0];
  // Será checado externamente

  return Math.max(0, Math.min(100, score));
}