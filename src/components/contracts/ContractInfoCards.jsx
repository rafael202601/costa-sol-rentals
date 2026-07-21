import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { OpenLocationButton } from "@/components/LocationField";
import { useContractSaldoPagar } from "@/hooks/useContractSaldoPagar";

/**
 * Exibe os 4 cards de resumo do contrato (Período, Entrega, Valor Total, Saldo a Pagar).
 * O Saldo a Pagar usa dinamico_valor_em_aberto quando disponível (contratos ativos),
 * garantindo sincronização com a Cobrança Dinâmica em tempo real.
 */
export default function ContractInfoCards({ contract, valorTotalCorreto, calcResult }) {
  // Usa o hook de prioridade: dinâmico para contratos ativos, estático para os demais
  const saldoPagarCorreto = useContractSaldoPagar(contract, calcResult);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" /> Período
          </div>
          <p className="text-sm font-semibold">
            {(() => {
              if (!contract.data_inicio) return "—";
              try {
                const d = parseISO(contract.data_inicio);
                return isNaN(d) ? "—" : format(d, "dd/MM/yyyy");
              } catch {
                return "—";
              }
            })()}
          </p>
          <p className="text-xs text-muted-foreground">
            até {(() => {
              if (!contract.data_prevista_termino) return "—";
              try {
                const d = parseISO(contract.data_prevista_termino);
                return isNaN(d) ? "—" : format(d, "dd/MM/yyyy");
              } catch {
                return "—";
              }
            })()}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5" /> Entrega
          </div>
          <p className="text-sm font-medium">{contract.endereco_entrega || "—"}</p>
          <OpenLocationButton location={contract} className="mt-1.5" />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Valor Total
          </div>
          <p className="text-xl font-bold font-heading">
            R$ {valorTotalCorreto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Saldo a Pagar
          </div>
          <p className={`text-xl font-bold font-heading ${saldoPagarCorreto > 0 ? "text-destructive" : "text-success"}`}>
            R$ {saldoPagarCorreto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          {contract.dinamico_ultima_atualizacao && !["finalizado", "cancelado", "rascunho"].includes(contract.status) && (
            <p className="text-[10px] text-blue-500 mt-0.5">Tempo real</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}