import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { gerarReciboDeTroca } from "../../lib/generateTrocaPDF";

export default function HistoricoTrocas({ historico = [], doc, client, settings }) {
  const [expanded, setExpanded] = useState(null);

  if (!historico.length) return null;

  const handleGerarPDF = (registro, idx) => {
    try {
      gerarReciboDeTroca({ doc, client, settings, registro, numeroTroca: idx + 1 });
    } catch (err) {
      console.error("Erro ao gerar PDF de troca:", err);
    }
  };

  const MOTIVO_LABEL = {
    defeito: "Defeito",
    avaria: "Avaria",
    manutencao: "Manutenção",
    erro_operacional: "Erro Operacional",
    solicitacao_cliente: "Solicitação do Cliente",
    troca_preventiva: "Troca Preventiva",
    equipamento_incompativel: "Equipamento Incompatível",
    outro: "Outro",
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-orange-600" />
          Histórico de Trocas
          <span className="ml-auto text-xs font-normal text-muted-foreground">{historico.length} troca(s)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {historico.map((reg, idx) => (
          <div key={idx} className="border rounded-xl overflow-hidden">
            {/* Header da troca */}
            <button
              type="button"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              className="w-full p-3 text-left flex items-center justify-between gap-3 bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <span className="flex items-center gap-1 text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                  <ArrowLeftRight className="w-3 h-3" /> Troca #{String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted-foreground">{reg.data}</span>
                <span className="text-xs font-semibold text-orange-700">
                  {MOTIVO_LABEL[reg.motivo] || reg.motivo}
                </span>
                {reg.tipo === "em_campo" && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Em Campo</span>
                )}
                {reg.tipo === "na_loja" && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Na Loja</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => { e.stopPropagation(); handleGerarPDF(reg, idx); }}
                >
                  <FileDown className="w-3 h-3" /> PDF
                </Button>
                {expanded === idx ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Detalhes expandidos */}
            {expanded === idx && (
              <div className="p-3 bg-white space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Saindo */}
                  <div>
                    <p className="text-[10px] font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                      ↑ EQUIPAMENTOS RETIRADOS
                    </p>
                    <div className="space-y-1">
                      {(reg.itens_saindo || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1">
                          <span className="font-medium">{item.nome}</span>
                          <span className="font-bold text-red-700">{item.quantidade} un.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Entrando */}
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                      ↓ EQUIPAMENTOS ENTREGUES
                    </p>
                    <div className="space-y-1">
                      {(reg.itens_entrando || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs bg-emerald-50 rounded px-2 py-1">
                          <span className="font-medium">{item.nome}</span>
                          <span className="font-bold text-emerald-700">{item.quantidade} un.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {reg.motorista && <span>🚛 Motorista: <strong>{reg.motorista}</strong></span>}
                  <span>👤 Por: <strong>{reg.usuario}</strong></span>
                  {reg.observacao && <span>📝 {reg.observacao}</span>}
                </div>

                {reg.assinatura_url && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Assinatura:</p>
                    <img src={reg.assinatura_url} alt="Assinatura troca" className="max-h-16 border rounded bg-white p-1" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}