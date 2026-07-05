import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Truck, CheckCircle2, RotateCcw, ArrowUpFromLine, UserX, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import SignatureDialog from "../SignatureDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_CONFIG = {
  contrato: {
    rascunho:           { label: "Sair para Entrega", next: "em_transito",        icon: Truck,           color: "bg-blue-600 hover:bg-blue-700",      requerAssinatura: false },
    em_transito:        { label: "Confirmar Entrega", next: "na_obra",             icon: CheckCircle2,    color: "bg-emerald-600 hover:bg-emerald-700", requerAssinatura: true  },
    na_obra:            { label: "Solicitar Recolha", next: "aguardando_recolha",  icon: ArrowUpFromLine, color: "bg-amber-600 hover:bg-amber-700",     requerAssinatura: false },
    aguardando_recolha: { label: "Confirmar Recolha", next: "devolvido_parcial",   icon: RotateCcw,       color: "bg-purple-600 hover:bg-purple-700",   requerAssinatura: true  },
    devolvido_parcial:  { label: "Finalizar",         next: "finalizado",          icon: CheckCircle2,    color: "bg-green-600 hover:bg-green-700",     requerAssinatura: false },
  },
  os: {
    pendente:           { label: "Sair para Entrega", next: "em_transito",        icon: Truck,           color: "bg-blue-600 hover:bg-blue-700",      requerAssinatura: false },
    em_transito:        { label: "Confirmar Entrega", next: "entregue",            icon: CheckCircle2,    color: "bg-emerald-600 hover:bg-emerald-700", requerAssinatura: true  },
    entregue:           { label: "Solicitar Recolha", next: "aguardando_recolha",  icon: ArrowUpFromLine, color: "bg-amber-600 hover:bg-amber-700",     requerAssinatura: false },
    aguardando_recolha: { label: "Confirmar Recolha", next: "recolhida",           icon: RotateCcw,       color: "bg-purple-600 hover:bg-purple-700",   requerAssinatura: true  },
  },
};

export default function DriverStatusActions({ parada, driverName, onUpdated }) {
  const [obsDialog, setObsDialog] = useState(false);
  const [obs, setObs] = useState("");
  const [signDialog, setSignDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [semClienteDialog, setSemClienteDialog] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [naoConcluido, setNaoConcluido] = useState(false);
  const [motivoNaoConcluido, setMotivoNaoConcluido] = useState("");

  const tipo = parada.docTipo; // "contrato" | "os"
  const currentStatus = parada.currentStatus;
  const config = STATUS_CONFIG[tipo]?.[currentStatus];

  if (!config) return null;

  const handleActionClick = () => {
    setPendingStatus(config.next);
    if (config.requerAssinatura) {
      setSignDialog(true);
    } else {
      setObs("");
      setObsDialog(true);
    }
  };

  const handleSemCliente = () => {
    setPendingStatus(config.next);
    setMotivo("");
    setSemClienteDialog(true);
  };

  const applyAssinaturaPendente = async () => {
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    setLoading(true);
    const target = pendingStatus || config.next;
    const now = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const nowFormattedBR = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).replace(",", " às");

    const isEntregaStatus = target === "na_obra" || target === "entregue";
    const isRecolhaStatus = target === "devolvido_parcial" || target === "recolhida";

    const updates = {
      status: target,
      assinatura_pendente: true,
      assinatura_pendente_motivo: motivo,
      assinatura_pendente_data: nowFormatted,
      assinatura_pendente_motorista: driverName,
      ...(isEntregaStatus && { data_entrega_real: nowFormattedBR, data_entrega_real_iso: now, motorista_entrega_confirmado: driverName }),
      ...(isRecolhaStatus && { data_recolha_real: nowFormattedBR, data_recolha_real_iso: now, motorista_recolha_confirmado: driverName }),
    };

    try {
      if (tipo === "contrato") {
        await base44.entities.Contract.update(parada.docId, updates);
      } else {
        await base44.entities.ServiceOrder.update(parada.docId, updates);
      }
    } catch (err) {
      console.error("[DriverStatusActions] ERRO ao salvar assinatura pendente:", err);
      const msg = err?.response?.data?.message || err?.message || "Erro desconhecido";
      setLoading(false);
      toast.error(`Erro ao salvar: ${msg}`);
      return;
    }

    try {
      await base44.entities.ActivityLog.create({
        usuario: driverName,
        acao: `Status: ${target} (assinatura pendente — cliente ausente)`,
        modulo: tipo === "contrato" ? "contrato" : "os",
        referencia_id: parada.docId,
        referencia_numero: parada.numero,
        detalhes: `Motorista ${driverName} — cliente não estava no local. Motivo: ${motivo}. Em ${nowFormatted}`,
        data_hora: now,
      });
    } catch (_) { /* log pode falhar silenciosamente */ }

    setLoading(false);
    setSemClienteDialog(false);
    setMotivo("");
    toast.success("Status atualizado. Assinatura marcada como pendente.");
    onUpdated?.();
  };

  const applyStatusUpdate = async (dataUrl = null, observacao = "") => {
    setLoading(true);
    const target = pendingStatus || config.next;
    const now = new Date().toISOString();
    // Timestamp real no fuso Brasil
    const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const nowFormattedBR = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).replace(",", " às");

    const updates = { status: target };

    // Registra timestamp real da entrega ou da recolha
    const isEntregaStatus = target === "na_obra" || target === "entregue";
    const isRecolhaStatus = target === "devolvido_parcial" || target === "recolhida" || target === "aguardando_recolha";

    if (isEntregaStatus) {
      updates.data_entrega_real = nowFormattedBR;
      updates.data_entrega_real_iso = now;
      updates.motorista_entrega_confirmado = driverName;
    }
    if (isRecolhaStatus && target !== "aguardando_recolha") {
      updates.data_recolha_real = nowFormattedBR;
      updates.data_recolha_real_iso = now;
      updates.motorista_recolha_confirmado = driverName;
    }

    if (dataUrl) {
      // Upload da assinatura como arquivo para evitar problema de tamanho (base64 grande pode ser rejeitado)
      let assinaturaUrl = dataUrl;
      try {
        console.log("[Assinatura] Iniciando upload. Tamanho base64:", dataUrl.length, "chars");
        const blob = await fetch(dataUrl).then(r => r.blob());
        const file = new File([blob], `assinatura_${parada.docId}_${Date.now()}.png`, { type: "image/png" });
        console.log("[Assinatura] Arquivo gerado:", file.size, "bytes");
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        assinaturaUrl = file_url;
        console.log("[Assinatura] Upload concluído. URL:", file_url);
      } catch (uploadErr) {
        console.warn("[Assinatura] Upload falhou, usando base64 diretamente:", uploadErr?.message);
        // Continua com base64 se upload falhar
      }

      if (isEntregaStatus) {
        updates.assinatura_data = nowFormatted;
        updates.assinatura_entrega_url = assinaturaUrl;
        updates.assinatura_entrega_motorista = driverName;
        updates.assinatura_entrega_data = now;
        updates.assinatura_origem = "painel_motorista";
      } else {
        updates.assinatura_devolucao_url = assinaturaUrl;
        updates.assinatura_devolucao_motorista = driverName;
        updates.assinatura_devolucao_data = now;
        updates.assinatura_origem_devolucao = "painel_motorista";
      }
    }

    if (observacao) updates.observacoes = observacao;

    console.log("[DriverStatusActions] Salvando update:", tipo, parada.docId, "status →", target, "campos:", Object.keys(updates));

    try {
      if (tipo === "contrato") {
        await base44.entities.Contract.update(parada.docId, updates);
      } else {
        await base44.entities.ServiceOrder.update(parada.docId, updates);
      }
      console.log("[DriverStatusActions] Update salvo com sucesso!");
    } catch (updateErr) {
      console.error("[DriverStatusActions] ERRO ao salvar update:", updateErr);
      const msg = updateErr?.response?.data?.message || updateErr?.message || "Erro desconhecido";
      setLoading(false);
      toast.error(`Erro ao salvar: ${msg}. Verifique permissões ou tente novamente.`);
      return;
    }

    // Log de atividade — não bloqueia mesmo se falhar
    try {
      await base44.entities.ActivityLog.create({
        usuario: driverName,
        acao: tipo === "contrato" ? `Status atualizado: ${target}` : `OS status: ${target}`,
        modulo: tipo === "contrato" ? "contrato" : "os",
        referencia_id: parada.docId,
        referencia_numero: parada.numero,
        detalhes: `Motorista ${driverName} atualizou em ${nowFormatted}${observacao ? ". Obs: " + observacao : ""}`,
        data_hora: now,
      });
    } catch (_) { /* log pode falhar silenciosamente */ }

    setLoading(false);
    setObsDialog(false);
    setSignDialog(false);
    setObs("");
    toast.success("Status atualizado com sucesso!");
    onUpdated?.();
  };

  const handleNaoConcluido = async () => {
    if (!motivoNaoConcluido.trim()) { toast.error("Informe o motivo"); return; }
    setLoading(true);
    const now = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString("pt-BR");

    // Status de retorno: rascunho (contrato) ou pendente (OS)
    const statusRetorno = tipo === "contrato" ? "rascunho" : "pendente";

    // Monta registro da tentativa
    const tentativa = {
      data: nowFormatted,
      motorista: driverName,
      motivo: motivoNaoConcluido,
      tipo_operacao: parada.tipo === "recolha" ? "recolha" : "entrega",
      status: "nao_concluido",
    };

    const updates = {
      status: statusRetorno,
      motorista_entrega: "",
      motorista_recolha: "",
    };

    try {
      if (tipo === "contrato") {
        const [doc] = await base44.entities.Contract.filter({ id: parada.docId });
        const historico = [...(doc?.historico_tentativas || []), tentativa];
        await base44.entities.Contract.update(parada.docId, {
          ...updates,
          historico_tentativas: historico,
        });
      } else {
        const [doc] = await base44.entities.ServiceOrder.filter({ id: parada.docId });
        const historico = [...(doc?.historico_tentativas || []), tentativa];
        await base44.entities.ServiceOrder.update(parada.docId, {
          ...updates,
          historico_tentativas: historico,
        });
      }

      await base44.entities.ActivityLog.create({
        usuario: driverName,
        acao: `Não Concluído — ${parada.tipo === "recolha" ? "Recolha" : "Entrega"}`,
        modulo: tipo === "contrato" ? "contrato" : "os",
        referencia_id: parada.docId,
        referencia_numero: parada.numero,
        detalhes: `Motorista ${driverName} — não concluiu em ${nowFormatted}. Motivo: ${motivoNaoConcluido}. Contrato voltou para ${statusRetorno}.`,
        data_hora: now,
      }).catch(() => {});

      toast.success("Registrado como não concluído. Contrato retornou para programação.");
      setNaoConcluido(false);
      setMotivoNaoConcluido("");
      onUpdated?.();
    } catch (err) {
      toast.error("Erro ao registrar: " + (err?.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
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
            onClick={handleSemCliente}
            disabled={loading}
          >
            <UserX className="w-3 h-3" /> Cliente ausente
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7 text-red-700 border-red-300 hover:bg-red-50"
          onClick={() => { setMotivoNaoConcluido(""); setNaoConcluido(true); }}
          disabled={loading}
        >
          <XCircle className="w-3 h-3" /> Não Concluído
        </Button>
      </div>

      {/* Dialog de confirmação simples (sem assinatura) */}
      <Dialog open={obsDialog} onOpenChange={setObsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirmar Ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirmar: <strong>{config.label}</strong>?
            </p>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Ex: Tudo em ordem..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsDialog(false)}>Cancelar</Button>
            <Button onClick={() => applyStatusUpdate(null, obs)} disabled={loading}>
              {loading ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de assinatura do cliente */}
      <SignatureDialog
        open={signDialog}
        onOpenChange={setSignDialog}
        onConfirm={(dataUrl) => applyStatusUpdate(dataUrl, obs)}
        title={`Assinatura do Cliente — ${parada.docTipo === "contrato" ? "Contrato" : "OS"} #${parada.numero}`}
      />

      {/* Dialog — cliente ausente / assinatura pendente */}
      <Dialog open={semClienteDialog} onOpenChange={setSemClienteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-amber-700 flex items-center gap-2">
              <UserX className="w-5 h-5" /> Cliente não estava no local
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              O status será avançado e a assinatura ficará <strong>pendente</strong> para ser coletada posteriormente.
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Ex: Cliente não encontrado no local, portão fechado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemClienteDialog(false)}>Cancelar</Button>
            <Button onClick={applyAssinaturaPendente} disabled={loading} className="bg-amber-600 hover:bg-amber-700 gap-2">
              <UserX className="w-4 h-4" /> Confirmar sem Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Não Concluído */}
      <Dialog open={naoConcluido} onOpenChange={setNaoConcluido}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-red-700 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Registrar como Não Concluído
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
              <p className="font-semibold">⚠️ O que acontece ao confirmar:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>O contrato/OS <strong>voltará para Lançado</strong></li>
                <li>Sairá da rota atual</li>
                <li>Aguardará novo agendamento pela logística</li>
                <li>A tentativa ficará registrada no histórico</li>
              </ul>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
              <span className="font-medium">{parada.docTipo === "contrato" ? "Contrato" : "OS"} #{parada.numero}</span>
              {" — "}{parada.clienteNome}
            </div>
            <div>
              <Label className="text-xs font-semibold text-red-700">Motivo obrigatório *</Label>
              <Select onValueChange={v => setMotivoNaoConcluido(v)} value={motivoNaoConcluido}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cliente ausente">Cliente ausente</SelectItem>
                  <SelectItem value="Endereço fechado">Endereço fechado</SelectItem>
                  <SelectItem value="Local inacessível">Local inacessível</SelectItem>
                  <SelectItem value="Cliente pediu reagendamento">Cliente pediu reagendamento</SelectItem>
                  <SelectItem value="Chuva / condições climáticas">Chuva / condições climáticas</SelectItem>
                  <SelectItem value="Problema operacional">Problema operacional</SelectItem>
                  <SelectItem value="Falta de pagamento">Falta de pagamento</SelectItem>
                  <SelectItem value="Sem responsável no local">Sem responsável no local</SelectItem>
                  <SelectItem value="Outro">Outro (descreva abaixo)</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={motivoNaoConcluido.startsWith("Outro") || !["Cliente ausente","Endereço fechado","Local inacessível","Cliente pediu reagendamento","Chuva / condições climáticas","Problema operacional","Falta de pagamento","Sem responsável no local",""].includes(motivoNaoConcluido) ? motivoNaoConcluido : ""}
                onChange={e => setMotivoNaoConcluido(e.target.value)}
                rows={2}
                className="mt-2"
                placeholder="Descreva o motivo ou detalhes adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaoConcluido(false)}>Cancelar</Button>
            <Button
              onClick={handleNaoConcluido}
              disabled={loading || !motivoNaoConcluido.trim()}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <XCircle className="w-4 h-4" /> {loading ? "Salvando..." : "Confirmar Não Concluído"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}