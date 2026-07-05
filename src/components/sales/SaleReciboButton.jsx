import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import { generateReciboPagamentoPDF } from "../../lib/generateReciboPagamento";
import { toast } from "sonner";

/**
 * Botão que gera recibo de pagamento de contrato
 * Props: contract, client, settings, pagamento (objeto com valorPago, formaPagamento, dataPagamento, responsavel)
 */
export default function SaleReciboButton({ contract, client, settings, pagamento, variant = "outline" }) {
  const [open, setOpen] = useState(false);

  const handleGerar = () => {
    try {
      const saldoRestante = Math.max(0, (contract?.saldo_pagar || 0) - (pagamento?.valorPago || 0));
      const doc = generateReciboPagamentoPDF({
        contract,
        client,
        settings,
        valorPago: pagamento?.valorPago || 0,
        formaPagamento: pagamento?.formaPagamento || contract?.forma_pagamento || "—",
        saldoRestante,
        dataPagamento: pagamento?.dataPagamento || format(new Date(), "dd/MM/yyyy HH:mm"),
        responsavel: pagamento?.responsavel || "",
        numeroRecibo: `REC-${contract?.numero || "000"}-${Date.now().toString().slice(-4)}`,
      });
      doc.save(`recibo_contrato_${contract?.numero || "000"}.pdf`);
      toast.success("Recibo gerado com sucesso!");
      setOpen(false);
    } catch (err) {
      toast.error("Erro ao gerar recibo: " + err.message);
    }
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className="gap-2">
        <Receipt className="w-4 h-4" /> Gerar Recibo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" /> Recibo de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contrato:</span>
                <span className="font-semibold">#{contract?.numero || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-semibold truncate max-w-[160px]">{contract?.client_nome || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor pago:</span>
                <span className="font-bold text-emerald-700">
                  R$ {(pagamento?.valorPago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma:</span>
                <span>{pagamento?.formaPagamento || contract?.forma_pagamento || "—"}</span>
              </div>
              {(() => {
                const saldoAposPageamento = Math.max(0, (contract?.saldo_pagar || 0) - (pagamento?.valorPago || 0));
                return saldoAposPageamento > 0 ? (
                  <div className="flex justify-between border-t border-emerald-200 pt-1.5 mt-1">
                    <span className="text-muted-foreground">Saldo restante:</span>
                    <span className="font-semibold text-amber-700">
                      R$ {saldoAposPageamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              O recibo será gerado em PDF, pronto para impressão ou envio.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleGerar} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Receipt className="w-4 h-4" /> Baixar Recibo PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}