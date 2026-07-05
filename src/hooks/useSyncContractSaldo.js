import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { calcContractTotal, getDiasContrato } from "@/lib/contractCalc";

/**
 * Hook que sincroniza o saldo_pagar e valor_total do contrato no banco
 * com o valor calculado corretamente pela mesma lógica do ContractDetail.
 *
 * Garante que o BillingNoteDialog leia sempre o saldo correto ao gerar nota,
 * sem precisar recalcular nada na geração da nota.
 */
export function useSyncContractSaldo({ contract, enrichedItens, settings }) {
  useEffect(() => {
    if (!contract?.id || !enrichedItens || !settings) return;
    // Não sincronizar contratos cancelados ou finalizados sem saldo
    if (contract.status === "cancelado") return;

    const itens = enrichedItens;
    const diasContrato = getDiasContrato(contract);
    const calcResult = calcContractTotal({
      itens,
      diasContrato,
      valorMinimoContrato: settings.valor_minimo_contrato || 0,
      frete: contract.frete || 0,
      sinal: contract.sinal || 0,
      valorPago: contract.valor_pago || 0,
      regrasDesconto: settings.regras_desconto_tempo || [],
    });

    const saldoCorreto = parseFloat(calcResult.saldoPagar.toFixed(2));
    const totalCorreto = parseFloat(calcResult.valorTotal.toFixed(2));

    // Só atualiza se houver divergência relevante (> 1 centavo)
    const saldoBanco = parseFloat((contract.saldo_pagar ?? 0).toFixed(2));
    const totalBanco = parseFloat((contract.valor_total ?? 0).toFixed(2));

    if (Math.abs(saldoBanco - saldoCorreto) > 0.01 || Math.abs(totalBanco - totalCorreto) > 0.01) {
      base44.entities.Contract.update(contract.id, {
        saldo_pagar: saldoCorreto,
        valor_total: totalCorreto,
      }).catch(() => {});
    }
  }, [contract?.id, enrichedItens, settings]);
}