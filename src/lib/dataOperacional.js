/**
 * Retorna a data operacional correta para um contrato,
 * baseada no status atual (recolha, entrega, etc.)
 *
 * REGRA:
 *  - Status de recolha → data_recolha (campo exclusivo da solicitação de recolha)
 *  - Status de entrega → data_inicio
 *  - Sem data → ""
 *
 * NÃO usa created_at nem data_prevista_termino como fallback para recolha,
 * pois esses campos refletem a criação/entrega, não o agendamento da recolha.
 */

export const STATUS_RECOLHA = [
  "aguardando_recolha",
  "devolvido_parcial",
  "devolvido_pendente",
];

/**
 * @param {object} contract - objeto do contrato
 * @returns {string} data no formato "yyyy-MM-dd" ou ""
 */
export function getDataOperacional(contract) {
  if (!contract) return "";

  const emRecolha = STATUS_RECOLHA.includes(contract.status);

  if (emRecolha) {
    // data_recolha é a fonte de verdade para recolhas
    // Fallback para data_prevista_termino em contratos antigos sem data_recolha
    return normalizeDate(contract.data_recolha)
      || normalizeDate(contract.data_prevista_termino)
      || "";
  }

  // Entrega / rascunho / em_transito / na_obra
  return normalizeDate(contract.data_inicio) || "";
}

/**
 * @param {object} contract
 * @returns {"recolha"|"entrega"}
 */
export function getTipoOperacional(contract) {
  if (!contract) return "entrega";
  return STATUS_RECOLHA.includes(contract.status) ? "recolha" : "entrega";
}

/** Normaliza datas yyyy-MM-dd, ISO e dd/MM/yyyy para yyyy-MM-dd */
function normalizeDate(d) {
  if (!d) return "";
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;           // já no formato certo
  if (s.includes("T")) return s.split("T")[0];             // ISO datetime
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {                   // dd/MM/yyyy
    const [day, month, year] = s.split("/");
    return `${year}-${month}-${day}`;
  }
  return "";
}