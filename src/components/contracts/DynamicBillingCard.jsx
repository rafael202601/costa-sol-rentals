import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useState } from "react";

export default function DynamicBillingCard({ contract, onUpdate }) {
  const [atualizando, setAtualizando] = useState(false);

  const isDevolvido = contract.status === "devolvido_pendente";
  const isClosed = ["finalizado", "cancelado"].includes(contract.status);
  const isActive = !isClosed && !isDevolvido && !["rascunho"].includes(contract.status);

  const diasEmAberto = contract.dinamico_dias_em_aberto ?? 0;
  const valorEmAberto = contract.dinamico_valor_em_aberto ?? contract.saldo_pagar ?? 0;
  const dataBase = contract.dinamico_data_base || contract.data_inicio;
  const ultimaAtualizacao = contract.dinamico_ultima_atualizacao;

  const togglePausaCobranca = async () => {
    await base44.entities.Contract.update(contract.id, {
      cobranca_pausada: !contract.cobranca_pausada,
    });
    toast.success(contract.cobranca_pausada ? "Cobrança automática reativada." : "Cobrança automática pausada.");
    onUpdate();
  };

  const atualizarAgora = async () => {
    setAtualizando(true);
    try {
      const res = await base44.functions.invoke("atualizarContratosDiarios", {});
      toast.success(`Atualizado! ${res.data?.atualizados ?? 0} contrato(s) processado(s).`);
      onUpdate();
    } catch {
      toast.error("Erro ao atualizar. Tente novamente.");
    } finally {
      setAtualizando(false);
    }
  };

  // Contrato devolvido aguardando pagamento: mostra saldo congelado, sem nova diária
  if (isDevolvido) {
    const saldoPendente = contract.saldo_pagar ?? contract.dinamico_valor_em_aberto ?? 0;
    return (
      <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-1">
              <PauseCircle className="w-3.5 h-3.5" /> Cobrança Encerrada — Aguardando Quitação
            </p>
            <p className="text-xs text-muted-foreground">
              Equipamentos devolvidos em {contract.data_encerramento_cobranca || contract.data_recolha_real || "—"}. Nenhuma nova diária será gerada.
            </p>
          </div>
          {saldoPendente > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-right">
              <p className="text-xs text-amber-600">Saldo final pendente</p>
              <p className="text-lg font-bold text-amber-800">
                R$ {saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isActive) return null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2 text-blue-700">
          <TrendingUp className="w-4 h-4" /> Cobrança Dinâmica (Tempo Real)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
              <Clock className="w-3 h-3" /> Dias em aberto
            </div>
            <p className="text-2xl font-bold font-heading text-blue-800">{diasEmAberto}</p>
            {dataBase && (
              <p className="text-[10px] text-blue-500 mt-0.5">
                Desde {dataBase.split("-").reverse().join("/")}
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
              <TrendingUp className="w-3 h-3" /> Valor em aberto
            </div>
            <p className="text-xl font-bold font-heading text-amber-800">
              R$ {valorEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {contract.ultima_cobranca_enviada && (
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Última cobrança</p>
              <p className="text-sm font-semibold">
                {contract.ultima_cobranca_enviada.split("-").reverse().join("/")}
              </p>
            </div>
          )}
        </div>

        {ultimaAtualizacao && (
          <p className="text-[10px] text-muted-foreground">
            Atualizado em: {format(parseISO(ultimaAtualizacao), "dd/MM/yyyy 'às' HH:mm")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={atualizarAgora}
            disabled={atualizando}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${atualizando ? "animate-spin" : ""}`} />
            {atualizando ? "Atualizando..." : "Atualizar agora"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={togglePausaCobranca}
            className={`gap-1 text-xs ${contract.cobranca_pausada ? "border-emerald-400 text-emerald-700" : "border-amber-400 text-amber-700"}`}
          >
            {contract.cobranca_pausada
              ? <><PlayCircle className="w-3 h-3" /> Reativar cobrança</>
              : <><PauseCircle className="w-3 h-3" /> Pausar cobrança</>
            }
          </Button>
        </div>

        {contract.cobranca_pausada && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            ⏸ Cobrança automática pausada para este contrato.
          </p>
        )}
      </CardContent>
    </Card>
  );
}