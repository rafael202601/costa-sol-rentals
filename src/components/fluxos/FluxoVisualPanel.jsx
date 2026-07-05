import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

/**
 * Painel visual do estado atual de uma conversa num fluxo específico.
 * Props:
 *   fluxo: FluxoIA record
 *   estado: ConversationState record (dados_coletados, step)
 */
export default function FluxoVisualPanel({ fluxo, estado }) {
  if (!fluxo) return null;

  const dadosColetados = estado?.dados_coletados || {};
  const stepAtual = estado?.step || "";

  const etapas = (fluxo.etapas || []).filter(e => e.obrigatoria !== false);

  return (
    <div className="bg-card border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Fluxo Ativo</p>
          <p className="font-semibold text-sm">{fluxo.nome}</p>
        </div>
        <Badge className="text-xs bg-primary/10 text-primary border-none">
          {stepAtual ? stepAtual.replace(/_/g, " ") : "saudação"}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progresso das Etapas</p>
        {etapas.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Sem etapas configuradas</p>
        )}
        {etapas.map((etapa, i) => {
          const coletado = dadosColetados[etapa.chave] !== undefined && dadosColetados[etapa.chave] !== null && dadosColetados[etapa.chave] !== "";
          const isAtual = stepAtual === etapa.chave || stepAtual === `aguardando_${etapa.chave}`;
          return (
            <div key={etapa.id || i} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${isAtual ? "bg-primary/5 border border-primary/20" : ""}`}>
              {coletado ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : isAtual ? (
                <Clock className="w-4 h-4 text-primary shrink-0 animate-pulse" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className={`flex-1 ${coletado ? "text-foreground" : "text-muted-foreground"}`}>
                {etapa.nome || etapa.chave}
              </span>
              {coletado && (
                <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                  {String(dadosColetados[etapa.chave]).substring(0, 20)}
                </span>
              )}
              {isAtual && !coletado && (
                <Badge className="text-[9px] bg-primary/10 text-primary border-none py-0 px-1.5">aguardando</Badge>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(dadosColetados).length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados Coletados</p>
          <div className="bg-muted/50 rounded-lg p-2 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(dadosColetados, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}