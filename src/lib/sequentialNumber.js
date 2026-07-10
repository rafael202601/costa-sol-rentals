import { base44 } from "@/api/base44Client";

/**
 * Gera o próximo código/número sequencial via backend (atômico, seguro contra concorrência).
 * tipo: "client_code" | "contrato" | "os"
 *
 * Retorno:
 *   - "contrato" → number (ex: 1058)
 *   - "os"       → string com prefixo CB (ex: "CB1058")
 *   - "client_code" → string numérica (ex: "20001")
 */
async function gerarCodigoBackend(tipo) {
  const res = await base44.functions.invoke("generateSequentialCode", { tipo });
  if (!res?.data?.numero) throw new Error(`Falha ao gerar código para '${tipo}'`);
  return res.data.numero;
}

/**
 * Gera o próximo código de cliente (início em 20000).
 * @returns {Promise<string>}
 */
export async function getNextClientCode() {
  const num = await gerarCodigoBackend("client_code");
  return String(num);
}

/**
 * Gera o próximo número de contrato (somente número, ex: 1058).
 * @returns {Promise<number>}
 */
export async function getNextContractNumber() {
  return await gerarCodigoBackend("contrato");
}

/**
 * Gera o próximo número de OS com prefixo CB (ex: "CB1058").
 * @returns {Promise<string>}
 */
export async function getNextOSNumber() {
  return await gerarCodigoBackend("os");
}

export async function getNextQuoteNumber() {
  return await gerarCodigoBackend("orcamento");
}

export async function getNextSaleNumber() {
  return await gerarCodigoBackend("venda");
}

export async function getNextBillingNoteNumber() {
  return await gerarCodigoBackend("fatura");
}

/**
 * Compatibilidade: getNextNumber(tipo) — usado em ContractForm e ServiceOrderForm.
 * tipo: "contrato" | "os" | "orcamento" | "venda" | "fatura"
 *
 * Retorna:
 *   - "contrato" → number
 *   - "os"       → string "CB1058"
 */
export async function getNextNumber(tipo) {
  if (tipo === "contrato") return await getNextContractNumber();
  if (tipo === "os") return await getNextOSNumber();
  if (tipo === "orcamento") return await getNextQuoteNumber();
  if (tipo === "venda") return await getNextSaleNumber();
  if (tipo === "fatura") return await getNextBillingNoteNumber();
  
  // fallback geral
  return await gerarCodigoBackend(tipo);
}

/**
 * Verifica se um código de cliente já está em uso.
 */
export async function isClientCodeDuplicate(codigo, excludeId = null) {
  if (!codigo) return false;
  const existing = await base44.entities.Client.filter({ codigo_cliente: String(codigo) }).catch(() => []);
  return existing.some(c => c.id !== excludeId);
}

/**
 * Extrai apenas o número de uma string de OS (remove prefixo CB).
 * Ex: "CB1057" → 1057, "1057" → 1057
 */
export function extrairNumeroOS(numero) {
  if (!numero) return 0;
  return parseInt(String(numero).replace(/\D/g, ""), 10) || 0;
}

/**
 * Formata o número de uma OS com prefixo CB se não tiver ainda.
 * Ex: 1057 → "CB1057", "CB1057" → "CB1057", "1057" → "CB1057"
 */
export function formatarNumeroOS(numero) {
  if (!numero) return "";
  const str = String(numero);
  if (str.toUpperCase().startsWith("CB")) return str.toUpperCase();
  const num = parseInt(str.replace(/\D/g, ""), 10);
  if (isNaN(num)) return str;
  return `CB${num}`;
}