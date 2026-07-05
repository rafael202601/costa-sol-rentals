import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

// Status disponíveis para Contrato
const STATUS_CONTRATO = [
  { value: "rascunho", label: "🟡 Lançado (Rascunho)" },
  { value: "em_transito", label: "🚚 Em Trânsito (Entrega)" },
  { value: "na_obra", label: "✅ Entregue / Na Obra" },
  { value: "aguardando_recolha", label: "🔄 Recolha Solicitada" },
  { value: "devolvido_parcial", label: "📦 Recolhido Parcialmente" },
  { value: "devolvido_pendente", label: "📋 Dev. Pendente Pagamento" },
  { value: "finalizado", label: "✔️ Finalizado" },
  { value: "cancelado", label: "❌ Cancelado" },
];

// Status disponíveis para OS
const STATUS_OS = [
  { value: "pendente", label: "🟡 Pendente (Lançado)" },
  { value: "em_transito", label: "🚚 Em Trânsito (Entrega)" },
  { value: "entregue", label: "✅ Entregue" },
  { value: "aguardando_recolha", label: "🔄 Aguardando Recolha" },
  { value: "recolhida", label: "📦 Recolhida" },
  { value: "finalizada", label: "✔️ Finalizada" },
  { value: "cancelada", label: "❌ Cancelada" },
];

export default function AlterarStatusDialog({ open, onClose, doc, docTipo, currentUser, onSaved }) {
  const [novoStatus, setNovoStatus] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const statusOptions = docTipo === "contrato" ? STATUS_CONTRATO : STATUS_OS;
  const statusAtual = doc?.status || "";
  const statusAtualLabel = statusOptions.find(s => s.value === statusAtual)?.label || statusAtual;

  const handleSalvar = async () => {
    if (!novoStatus) { toast.error("Selecione o novo status"); return; }
    if (!motivo.trim()) { toast.error("Informe o motivo da alteração"); return; }
    if (novoStatus === statusAtual) { toast.error("O novo status é igual ao status atual"); return; }

    setSaving(true);
    const agora = format(new Date(), "dd/MM/yyyy HH:mm");
    const agoraISO = new Date().toISOString();

    const registroHistorico = {
      tipo: "correcao_operacional",
      data: agora,
      usuario: currentUser?.full_name || currentUser?.email || "—",
      usuario_email: currentUser?.email || "",
      status_anterior: statusAtual,
      novo_status: novoStatus,
      motivo: motivo,
    };

    try {
      if (docTipo === "contrato") {
        const historicoAtual = doc.historico_recolhas || [];
        await base44.entities.Contract.update(doc.id, {
          status: novoStatus,
          historico_recolhas: [...historicoAtual, registroHistorico],
        });
      } else {
        const historicoAtual = doc.historico_recolhas || [];
        await base44.entities.ServiceOrder.update(doc.id, {
          status: novoStatus,
          historico_recolhas: [...historicoAtual, registroHistorico],
        });
      }

      // Log de auditoria
      await base44.entities.ActivityLog.create({
        usuario: currentUser?.full_name || currentUser?.email || "—",
        acao: "Correção Operacional — Alteração de Status",
        modulo: docTipo === "contrato" ? "contrato" : "os",
        referencia_id: doc.id,
        referencia_numero: doc.numero,
        detalhes: `Status alterado: "${statusAtualLabel}" → "${statusOptions.find(s => s.value === novoStatus)?.label || novoStatus}". Motivo: ${motivo}`,
        data_hora: agoraISO,
      });

      toast.success("Status alterado com sucesso! Histórico registrado.");
      setNovoStatus("");
      setMotivo("");
      onClose();
      onSaved();
    } catch (err) {
      toast.error("Erro ao alterar status: " + (err?.message || "tente novamente"));
    }
    setSaving(false);
  };

  const handleClose = () => {
    setNovoStatus("");
    setMotivo("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-amber-700">
            <ShieldAlert className="w-5 h-5" />
            Correção Operacional — Alterar Status
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Ação administrativa restrita</p>
              <p>Esta alteração será registrada no histórico de auditoria com seu nome, data/hora e motivo.</p>
            </div>
          </div>

          {/* Status atual */}
          <div className="p-3 rounded-xl bg-muted/40 border text-sm">
            <p className="text-xs text-muted-foreground mb-1">Status atual</p>
            <p className="font-semibold">{statusAtualLabel}</p>
          </div>

          {/* Novo status */}
          <div>
            <Label className="text-xs font-semibold">Novo Status *</Label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o novo status..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions
                  .filter(s => s.value !== statusAtual)
                  .map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div>
            <Label className="text-xs font-semibold">Motivo da Alteração *</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Motorista marcou entrega incorretamente. Status revertido para corrigir a operação."
            />
          </div>

          {/* Preview do registro */}
          {novoStatus && motivo && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-1">
              <p className="font-semibold text-blue-800">📋 Registro que será salvo no histórico:</p>
              <p><span className="text-muted-foreground">Status:</span> {statusAtualLabel} → {statusOptions.find(s => s.value === novoStatus)?.label}</p>
              <p><span className="text-muted-foreground">Por:</span> {currentUser?.full_name || currentUser?.email}</p>
              <p><span className="text-muted-foreground">Em:</span> {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
              <p><span className="text-muted-foreground">Motivo:</span> {motivo}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            disabled={saving || !novoStatus || !motivo.trim()}
            className="bg-amber-600 hover:bg-amber-700 gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            {saving ? "Salvando..." : "Confirmar Alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}