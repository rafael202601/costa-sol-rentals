/**
 * Utilitários para controle de validade do cadastro do cliente.
 */
import { addMonths, addYears, format, parseISO, differenceInDays, isBefore, isAfter } from "date-fns";

export const PERIODOS_VALIDADE = [
  { value: "1m", label: "1 mês" },
  { value: "6m", label: "6 meses" },
  { value: "1a", label: "1 ano" },
  { value: "2a", label: "2 anos" },
  { value: "5a", label: "5 anos" },
  { value: "manual", label: "Data manual" },
];

/**
 * Calcula a data de validade a partir de hoje com base no período.
 */
export function calcularDataValidade(periodo) {
  const hoje = new Date();
  switch (periodo) {
    case "1m": return format(addMonths(hoje, 1), "yyyy-MM-dd");
    case "6m": return format(addMonths(hoje, 6), "yyyy-MM-dd");
    case "1a": return format(addYears(hoje, 1), "yyyy-MM-dd");
    case "2a": return format(addYears(hoje, 2), "yyyy-MM-dd");
    case "5a": return format(addYears(hoje, 5), "yyyy-MM-dd");
    default: return "";
  }
}

/**
 * Retorna o status de validade do cliente.
 * @returns "valido" | "proximo" | "vencido" | "sem_validade"
 */
export function getStatusValidade(dataValidade) {
  if (!dataValidade) return "sem_validade";
  const hoje = new Date();
  const validade = parseISO(dataValidade);
  if (isBefore(validade, hoje)) return "vencido";
  const diasRestantes = differenceInDays(validade, hoje);
  if (diasRestantes <= 7) return "proximo";
  return "valido";
}

/**
 * Retorna config visual para o status de validade.
 */
export function getValidadeConfig(status) {
  switch (status) {
    case "valido":
      return { label: "Cadastro Válido", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: "🟢" };
    case "proximo":
      return { label: "Próximo do Vencimento", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", icon: "🟡" };
    case "vencido":
      return { label: "Cadastro Vencido", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", icon: "🔴" };
    default:
      return { label: "Sem validade definida", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400", icon: "⚪" };
  }
}

/**
 * Verifica se um cliente está bloqueado para operações por cadastro vencido.
 */
export function isCadastroVencido(client) {
  if (!client?.data_validade_cadastro) return false;
  return getStatusValidade(client.data_validade_cadastro) === "vencido";
}

/**
 * Retorna quantos dias faltam (ou passaram) para o vencimento.
 */
export function getDiasParaValidade(dataValidade) {
  if (!dataValidade) return null;
  return differenceInDays(parseISO(dataValidade), new Date());
}