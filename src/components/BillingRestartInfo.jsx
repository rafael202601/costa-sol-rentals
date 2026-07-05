import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { CheckCircle2, Calendar, Clock, RefreshCcw } from "lucide-react";

/**
 * Calcula e exibe as informações de reinício de cobrança após pagamento.
 * Regra:
 *  - Calcula a diária total do contrato (soma valor_diario * quantidade de cada item)
 *  - Se valorPago >= valorMinimo (item mais caro): usa dias_minimos daquele item
 *  - Caso contrário: dias_pagos = floor(valorPago / diariaTotalContrato)
 */
export default function BillingRestartInfo({ contract }) {
  const { dinamico_data_base, valor_recebido_ultima_baixa, itens = [], dinamico_dias_em_aberto } = contract || {};

  // Contrato quitado/finalizado/devolvido: nunca mostrar próxima cobrança
  const isEncerrado = ["finalizado", "cancelado", "devolvido_pendente"].includes(contract?.status)
    || contract?.status_financeiro === "pago"
    || (contract?.saldo_pagar ?? 0) <= 0;
  if (isEncerrado) return null;

  if (!dinamico_data_base || !valor_recebido_ultima_baixa) return null;

  const valorPago = valor_recebido_ultima_baixa || 0;

  // Calcula diária total dos itens do contrato
  const diariaTotalContrato = (itens || []).reduce((acc, item) => {
    return acc + (item.valor_diario || item.valor_unitario || 0) * (item.quantidade_retirada || 1);
  }, 0);

  // Calcula valor mínimo (maior valor_minimo individual, ou diária * dias_minimos do item principal)
  let diasPagos = 0;
  let motivo = "";

  if (diariaTotalContrato > 0) {
    // Verifica se pagou o equivalente a um período mínimo de algum item
    const diasMinEquip = Math.max(...(itens || []).map((i) => i.dias_minimos_proprio || 0), 0);
    const diasMinGlobal = 5; // fallback
    const diasMin = diasMinEquip > 0 ? diasMinEquip : diasMinGlobal;
    const valorMinimo = diariaTotalContrato * diasMin;

    if (valorPago >= valorMinimo && diasMin > 0) {
      diasPagos = Math.floor(valorPago / diariaTotalContrato);
      motivo = `${diasPagos} dias pagos (R$ ${diariaTotalContrato.toFixed(2)}/dia × ${diasPagos})`;
    } else {
      diasPagos = Math.floor(valorPago / diariaTotalContrato);
      motivo = `${diasPagos} dias pagos (cálculo por valor)`;
    }
  }

  let dataPagamento, dataCobertura, dataReinicio;
  try {
    dataPagamento = parseISO(dinamico_data_base);
    dataCobertura = addDays(dataPagamento, Math.max(0, diasPagos - 1));
    dataReinicio = addDays(dataPagamento, diasPagos);
  } catch {
    return null;
  }

  const hoje = new Date();
  const diasAteReinicio = differenceInDays(dataReinicio, hoje);
  const jaRecomecou = diasAteReinicio <= 0;

  return (
    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
      <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Último pagamento registrado
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Calendar className="w-3 h-3" /> Data do pagamento
          </div>
          <p className="font-bold text-emerald-700">{format(dataPagamento, "dd/MM/yyyy")}</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Clock className="w-3 h-3" /> Dias pagos
          </div>
          <p className="font-bold text-emerald-700">{diasPagos} dias</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{motivo}</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Calendar className="w-3 h-3" /> Cobertura até
          </div>
          <p className="font-bold text-emerald-700">{format(dataCobertura, "dd/MM/yyyy")}</p>
        </div>
        <div className={`rounded-lg p-2.5 border ${jaRecomecou ? "bg-amber-50 border-amber-200" : "bg-white border-emerald-100"}`}>
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <RefreshCcw className="w-3 h-3" /> Nova cobrança
          </div>
          <p className={`font-bold ${jaRecomecou ? "text-amber-700" : "text-blue-700"}`}>
            {format(dataReinicio, "dd/MM/yyyy")}
          </p>
          <p className={`text-[10px] mt-0.5 ${jaRecomecou ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
            {jaRecomecou
              ? `Cobrança reiniciada há ${Math.abs(diasAteReinicio)} dia(s)`
              : `Em ${diasAteReinicio} dia(s)`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-700 font-medium">
          Valor pago: R$ {valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
        {!jaRecomecou && (
          <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            ✓ Pago até {format(dataCobertura, "dd/MM")}
          </span>
        )}
        {jaRecomecou && (
          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            ⏰ Cobrança em aberto desde {format(dataReinicio, "dd/MM")}
          </span>
        )}
      </div>
    </div>
  );
}