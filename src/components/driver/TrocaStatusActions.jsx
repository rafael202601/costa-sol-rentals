import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Truck, CheckCircle2, ArrowLeftRight, UserX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import SignatureDialog from "../SignatureDialog";
import { format } from "date-fns";

/**
 * Ações específicas para TROCAS DE EQUIPAMENTO no painel do motorista.
 * Fluxo: troca_agendada → em_rota_troca → concluida
 *
 * A troca vive em doc.historico_trocas[trocaIdx].
 * Ao concluir: status = "concluida", assinatura salva, notifica pai.
 */
export default function TrocaStatusActions({ parada, driverName, onUpdated }) {
  const [obsDialog, setObsDialog] = useState(false);
  const [obs, setObs] = useState("");
  const [signDialog, setSignDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [semClienteDialog, setSemClienteDialog] = useState(false);
  const [motivo, setMotivo] = useState("");

  const status = parada.trocaStatus || "pendente"; // pendente | em_rota_troca | concluida

  // Próxima ação com base no status atual da troca
  const getConfig = () => {
    if (status === "concluida") return null;
    if (status === "em_rota_troca") {
      return {
        label: "Concluir Troca",
        next: "concluida",
        color: "bg-emerald-600 hover:bg-emerald-700",
        icon: CheckCircle2,
        requerAssinatura: true,
      };
    }
    // pendente ou qualquer outro = pode sair para troca
    return {
      label: "Sair para Troca",
      next: "em_rota_troca",
      color: "bg-orange-600 hover:bg-orange-700",
      icon: Truck,
      requerAssinatura: false,
    };
  };

  const config = getConfig();
  if (!config) {
    return (
      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Troca Concluída
      </span>
    );
  }

  const handleActionClick = () => {
    if (config.requerAssinatura) {
      setSignDialog(true);
    } else {
      setObs("");
      setObsDialog(true);
    }
  };

  const updateTrocaStatus = async (nextStatus, assinaturaUrl = null, observacao = "") => {
    setLoading(true);
    const now = new Date().toISOString();
    const nowFormatted = format(new Date(), "dd/MM/yyyy HH:mm");

    try {
      const entity = parada.docTipo === "contrato"
        ? base44.entities.Contract
        : base44.entities.ServiceOrder;

      const [doc] = await entity.filter({ id: parada.docId });
      if (!doc) throw new Error("Documento não encontrado");

      const historico = [...(doc.historico_trocas || [])];
      const trocaIdx = parada.trocaIdx;

      if (trocaIdx === undefined || trocaIdx === null || trocaIdx < 0 || trocaIdx >= historico.length) {
        throw new Error("Índice de troca inválido");
      }

      const trocaAtualizada = {
        ...historico[trocaIdx],
        status: nextStatus,
      };

      if (nextStatus === "em_rota_troca") {
        trocaAtualizada.data_saida = nowFormatted;
        trocaAtualizada.motorista = driverName || trocaAtualizada.motorista;
      }

      if (nextStatus === "concluida") {
        trocaAtualizada.data_conclusao = nowFormatted;
        trocaAtualizada.motorista = driverName || trocaAtualizada.motorista;
        if (assinaturaUrl) trocaAtualizada.assinatura_url = assinaturaUrl;
        if (observacao) trocaAtualizada.observacao_conclusao = observacao;
      }

      historico[trocaIdx] = trocaAtualizada;

      await entity.update(parada.docId, { historico_trocas: historico });

      // Log de atividade
      try {
        await base44.entities.ActivityLog.create({
          usuario: driverName,
          acao: `Troca ${nextStatus === "em_rota_troca" ? "— Saída para campo" : "— Concluída"}`,
          modulo: parada.docTipo === "contrato" ? "contrato" : "os",
          referencia_id: parada.docId,
          referencia_numero: parada.numero,
          detalhes: `Motorista ${driverName} — troca #${(trocaIdx + 1)} status → ${nextStatus}. Em ${nowFormatted}${observacao ? ". Obs: " + observacao : ""}`,
          data_hora: now,
        });
      } catch (_) {}

      const msg = nextStatus === "em_rota_troca"
        ? "Saída registrada! Boa viagem."
        : "Troca concluída com sucesso!";
      toast.success(msg);
      onUpdated?.();
    } catch (err) {
      toast.error("Erro ao atualizar troca: " + (err?.message || "Tente novamente."));
    } finally {
      setLoading(false);
      setObsDialog(false);
      setSignDialog(false);
      setSemClienteDialog(false);
      setObs("");
      setMotivo("");
    }
  };

  const handleSignConfirm = async (dataUrl) => {
    let assinaturaUrl = dataUrl;
    try {
      const blob = await fetch(dataUrl).then(r => r.blob());
      const file = new File([blob], `assinatura_troca_${parada.docId}_${Date.now()}.png`, { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      assinaturaUrl = file_url;
    } catch (_) {}
    await updateTrocaStatus("concluida", assinaturaUrl, obs);
  };

  const handleSemCliente = async () => {
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    await updateTrocaStatus("concluida", null, `[Cliente ausente] ${motivo}`);
  };

  const Icon = config.icon;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          className={`gap-1.5 text-xs h-8 text-white ${config.color}`}
          onClick={handleActionClick}
          disabled={loading}
        >
          <Icon className="w-3.5 h-3.5" />
          {loading ? "Salvando..." : config.label}
        </Button>
        {config.requerAssinatura && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={() => { setMotivo(""); setSemClienteDialog(true); }}
            disabled={loading}
          >
            <UserX className="w-3 h-3" /> Cliente ausente
          </Button>
        )}
      </div>

      {/* Dialog confirmação (sem assinatura) */}
      <Dialog open={obsDialog} onOpenChange={setObsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-orange-700">
              <ArrowLeftRight className="w-5 h-5" /> Sair para Troca
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirmar saída para realizar a troca?
            </p>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-700 space-y-1">
              <p className="font-semibold">{parada.docTipo === "contrato" ? "Contrato" : "OS"} #{parada.numero}</p>
              <p>Cliente: {parada.clienteNome}</p>
              {parada.endereco && <p>📍 {parada.endereco}</p>}
              {(parada.trocaMotivo) && <p>Motivo: {parada.trocaMotivo}</p>}
            </div>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Ex: Saindo às 14h com o novo equipamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => updateTrocaStatus("em_rota_troca", null, obs)}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              <Truck className="w-4 h-4" /> Confirmar Saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de assinatura para conclusão */}
      <SignatureDialog
        open={signDialog}
        onOpenChange={setSignDialog}
        onConfirm={handleSignConfirm}
        title={`Assinatura do Cliente — Troca em ${parada.docTipo === "contrato" ? "Contrato" : "OS"} #${parada.numero}`}
      />

      {/* Dialog cliente ausente */}
      <Dialog open={semClienteDialog} onOpenChange={setSemClienteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-amber-700 flex items-center gap-2">
              <UserX className="w-5 h-5" /> Cliente não estava no local
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              A troca será concluída sem assinatura. O motivo ficará registrado no histórico.
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Ex: Cliente não encontrado, portão fechado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemClienteDialog(false)}>Cancelar</Button>
            <Button onClick={handleSemCliente} disabled={loading} className="bg-amber-600 hover:bg-amber-700 gap-2">
              <UserX className="w-4 h-4" /> Concluir sem Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}