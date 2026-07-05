import ReciboDevolucaoButton from "./ReciboDevolucaoButton";
import { History, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Exibe o histórico de devoluções de um contrato com botão de recibo para cada uma
 *
 * Props:
 *   historico     - array de devoluções [{data, motorista, tipo, itens, status, observacao, usuario}]
 *   doc           - contrato ou OS
 *   client        - dados do cliente
 *   settings      - CompanySettings
 *   tipo          - "contrato" | "os"
 */
export default function HistoricoDevolucoes({ historico = [], doc, client, settings, tipo = "contrato" }) {
  if (!historico || historico.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <History className="w-4 h-4" /> Histórico de Devoluções
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {historico.map((rec, i) => {
          // Normaliza os itens para o formato do recibo
          const itensDevolucao = (rec.itens || []).map(it => ({
            nome: it.nome || it.equipamento_nome || "—",
            quantidade: it.quantidade || 1,
            unidade: it.unidade || "un.",
            observacao: it.observacao || "",
          }));

          const tipoDevolucao = rec.tipo === "parcial" ? "parcial" : "total";
          const numeroDevolucao = i + 1;

          return (
            <div key={i} className="p-3 rounded-xl bg-muted/40 border text-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold">
                    {rec.tipo === "parcial" ? `🔄 Devolução Parcial #${numeroDevolucao}` : `📦 Devolução Total`}
                  </span>
                  {rec.status === "concluido" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      ✓ Concluída
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{rec.data}</span>
                  <ReciboDevolucaoButton
                    doc={doc}
                    client={client}
                    settings={settings}
                    tipo={tipo}
                    tipoDevolucao={tipoDevolucao}
                    itensDevolucao={itensDevolucao}
                    motorista={rec.motorista || ""}
                    usuario={rec.usuario || ""}
                    observacoes={rec.observacao || ""}
                    numeroDevolucao={numeroDevolucao}
                    assinaturaClienteUrl={rec.assinatura_cliente_url || rec.assinatura || null}
                    assinaturaResponsavelUrl={rec.assinatura_responsavel_url || null}
                    size="sm"
                  />
                </div>
              </div>

              {rec.motorista && (
                <p className="text-xs text-muted-foreground">Motorista: {rec.motorista}</p>
              )}
              {rec.usuario && (
                <p className="text-xs text-muted-foreground">Responsável: {rec.usuario}</p>
              )}
              {itensDevolucao.length > 0 && (
                <ul className="text-xs space-y-0.5 mt-1 pl-2 border-l-2 border-purple-200">
                  {itensDevolucao.map((it, j) => (
                    <li key={j} className="flex justify-between">
                      <span>{it.nome}</span>
                      <span className="font-medium text-purple-700">{it.quantidade} un.</span>
                    </li>
                  ))}
                </ul>
              )}
              {rec.observacao && (
                <p className="text-xs text-muted-foreground italic">"{rec.observacao}"</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}