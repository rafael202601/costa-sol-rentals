/**
 * Hook que retorna o saldo a pagar correto para um contrato.
 *
 * Regra de prioridade:
 *  1. Contratos ativos com dinamico_valor_em_aberto preenchido → usa o valor dinâmico
 *     (atualizado diariamente pelo backend com dias corridos reais, mínimo, pagamentos, etc.)
 *  2. Qualquer outro caso (rascunho, finalizado, cancelado, ou sem dado dinâmico) →
 *     usa o cálculo estático do calcContractTotal
 */
export function useContractSaldoPagar(contract, calcResult) {
  if (!contract) return calcResult?.saldoPagar ?? 0;

  const isAtivo = !["finalizado", "cancelado", "rascunho"].includes(contract.status);

  if (
    isAtivo &&
    contract.dinamico_ultima_atualizacao &&
    contract.dinamico_valor_em_aberto != null
  ) {
    return Math.max(0, contract.dinamico_valor_em_aberto);
  }

  return calcResult?.saldoPagar ?? 0;
}