import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { calcContractTotal, getDiasContrato } from "../../lib/contractCalc";

/**
 * Componente invisível que persiste o saldo_pagar correto no banco
 * sempre que os itens enriquecidos e settings estiverem prontos.
 * Garante que BillingNoteDialog use o mesmo valor exibido visualmente no ContractDetail.
 */
export default function SyncContractSaldo({ contract, enrichedItens, settings }) {
  useEffect(() => {
    if (!contract?.id || !enrichedItens || !settings) return;
    // Não sobrescrever saldo de contratos encerrados — a cobrança foi congelada na devolução
    if (["cancelado", "devolvido_pendente", "finalizado"].includes(contract.status)) return;

    const calcResult = calcContractTotal({
      itens: enrichedItens,
      diasContrato: getDiasContrato(contract),
      valorMinimoContrato: settings.valor_minimo_contrato || 0,
      frete: contract.frete || 0,
      sinal: contract.sinal || 0,
      valorPago: contract.valor_pago || 0,
      regrasDesconto: settings.regras_desconto_tempo || [],
    });

    const totalCorreto = parseFloat(calcResult.valorTotal.toFixed(2));
    const totalBanco = parseFloat((contract.valor_total ?? 0).toFixed(2));

    // Se o contrato está ativo e já tem o valor dinâmico atualizado pelo backend,
    // NÃO sobrescrever saldo_pagar com o cálculo estático (prazo fixo).
    // O backend (atualizarContratosDiarios) é a fonte de verdade para saldo em aberto dinâmico.
    const isAtivo = !["finalizado", "cancelado", "rascunho"].includes(contract.status);
    const temDinamico = isAtivo && contract.dinamico_ultima_atualizacao && contract.dinamico_valor_em_aberto != null;

    const updates = {};

    if (Math.abs(totalBanco - totalCorreto) > 0.01) {
      updates.valor_total = totalCorreto;
    }

    if (temDinamico) {
      // Com dado dinâmico: saldo_pagar no banco deve espelhar o valor dinâmico (dias corridos reais)
      const saldoDinamico = parseFloat(Math.max(0, contract.dinamico_valor_em_aberto).toFixed(2));
      const saldoBanco = parseFloat((contract.saldo_pagar ?? 0).toFixed(2));
      if (Math.abs(saldoBanco - saldoDinamico) > 0.01) {
        updates.saldo_pagar = saldoDinamico;
      }
    } else {
      // Sem dado dinâmico: sincroniza saldo_pagar com o cálculo estático normalmente
      const saldoCorreto = parseFloat(calcResult.saldoPagar.toFixed(2));
      const saldoBanco = parseFloat((contract.saldo_pagar ?? 0).toFixed(2));
      if (Math.abs(saldoBanco - saldoCorreto) > 0.01) {
        updates.saldo_pagar = saldoCorreto;
      }
    }

    if (Object.keys(updates).length > 0) {
      base44.entities.Contract.update(contract.id, updates).catch(() => {});
    }
  }, [contract?.id, enrichedItens, settings]);

  return null;
}