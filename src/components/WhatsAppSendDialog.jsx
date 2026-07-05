/**
 * WhatsAppSendDialog — componente reutilizável para envio de PDF via WhatsApp Web ou API
 * Suporta: PDF normal, PDF quitado, envio via WhatsApp Web, envio via API
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, FileDown, Send, Smartphone, Globe, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

/**
 * Props:
 * - open: bool
 * - onOpenChange: fn
 * - phone: string — telefone do cliente (sem formatação)
 * - clientNome: string
 * - docTipo: "contrato" | "os"
 * - docNumero: string
 * - docId: string
 * - valorTotal: number
 * - valorPago: number
 * - statusFinanceiro: string
 * - formaPagamento: string
 * - settings: object — CompanySettings
 * - onGeneratePDF: fn(tipo: "normal"|"quitado") => jsPDF doc
 * - currentUser: object
 */
export default function WhatsAppSendDialog({
  open, onOpenChange,
  phone, clientNome,
  docTipo = "contrato", docNumero, docId,
  valorTotal, valorPago, statusFinanceiro, formaPagamento,
  settings, onGeneratePDF, currentUser,
}) {
  const [step, setStep] = useState("choose"); // choose | sending
  const [pdfTipo, setPdfTipo] = useState("normal");
  const [sendMode, setSendMode] = useState("web"); // "web" | "api"
  const [msgText, setMsgText] = useState("");
  const [pdfReady, setPdfReady] = useState(false);

  const whatsApiUrl = settings?.whatsapp_api_url || "";
  const whatsApiToken = settings?.whatsapp_api_token || "";
  const whatsApiRemetente = settings?.whatsapp_api_remetente || "";
  const hasApi = !!(whatsApiUrl && whatsApiToken);

  const isPago = statusFinanceiro === "pago" || pdfTipo === "quitado";

  const buildDefaultMsg = () => {
    const empresa = settings?.nome_fantasia || settings?.nome_social || "";
    const tipo = docTipo === "contrato" ? "contrato" : "OS";
    if (pdfTipo === "quitado") {
      return `Olá ${clientNome}, segue o documento de QUITAÇÃO do ${tipo} nº ${docNumero}. Valor quitado: R$ ${(valorPago || valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ${empresa}.`;
    }
    // Use settings template if available
    const template = docTipo === "contrato"
      ? (settings?.mensagem_whatsapp_contrato || "")
      : (settings?.mensagem_whatsapp_os || "");
    if (template) {
      return template
        .replace("{{nome_cliente}}", clientNome || "")
        .replace("{{numero_contrato}}", docNumero || "")
        .replace("{{nome_empresa}}", empresa)
        .replace("{{valor_total}}", `R$ ${(valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    }
    return `Olá ${clientNome}, segue o ${tipo} nº ${docNumero}. ${empresa}.`;
  };

  const handleOpen = () => {
    setStep("choose");
    setPdfTipo("normal");
    setSendMode(hasApi ? "api" : "web");
    setMsgText(buildDefaultMsg());
    setPdfReady(false);
  };

  // Download PDF
  const downloadPDF = () => {
    const doc = onGeneratePDF(pdfTipo);
    if (!doc) { toast.error("Erro ao gerar PDF"); return; }
    const prefix = pdfTipo === "quitado" ? "quitado" : (docTipo === "contrato" ? "contrato" : "os");
    doc.save(`${prefix}_${docNumero || docId}.pdf`);
    setPdfReady(true);
    toast.success("PDF baixado! Agora anexe ao WhatsApp.");
  };

  // Enviar via WhatsApp Web
  const sendViaWeb = () => {
    const cleanPhone = (phone || "").replace(/\D/g, "");
    if (!cleanPhone) { toast.error("Número do cliente não encontrado"); return; }
    const msg = encodeURIComponent(msgText || buildDefaultMsg());
    const number = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://web.whatsapp.com/send?phone=${number}&text=${msg}`, "_blank");
    logSend("web");
    toast.success("WhatsApp Web aberto! Lembre de anexar o PDF.");
    onOpenChange(false);
  };

  // Enviar via API
  const sendViaApi = async () => {
    if (!hasApi) { toast.error("Configure a API do WhatsApp nas Configurações"); return; }
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const number = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    setStep("sending");

    // Gera e faz upload do PDF
    const doc = onGeneratePDF(pdfTipo);
    if (!doc) { toast.error("Erro ao gerar PDF"); setStep("choose"); return; }

    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], `doc_${docNumero || docId}.pdf`, { type: "application/pdf" });

    let fileUrl = "";
    try {
      const uploaded = await base44.integrations.Core.UploadFile({ file: pdfFile });
      fileUrl = uploaded.file_url;
    } catch (e) {
      toast.error("Erro ao fazer upload do PDF");
      setStep("choose");
      return;
    }

    // Chama a API do WhatsApp
    try {
      const resp = await fetch(whatsApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${whatsApiToken}`,
        },
        body: JSON.stringify({
          phone: number,
          message: msgText || buildDefaultMsg(),
          document: fileUrl,
          filename: `doc_${docNumero || docId}.pdf`,
          sender: whatsApiRemetente || undefined,
        }),
      });
      if (!resp.ok) throw new Error(`API retornou ${resp.status}`);
      logSend("api");
      toast.success("Enviado com sucesso via API do WhatsApp!");
      onOpenChange(false);
    } catch (e) {
      toast.error(`Erro ao enviar via API: ${e.message}`);
    }
    setStep("choose");
  };

  const logSend = async (via) => {
    try {
      await base44.entities.ActivityLog.create({
        usuario: currentUser?.full_name || currentUser?.email || "—",
        acao: `Envio WhatsApp (${via === "api" ? "API" : "Web"}) — ${pdfTipo === "quitado" ? "PDF Quitado" : "PDF Normal"}`,
        modulo: docTipo === "contrato" ? "contrato" : "os",
        referencia_id: docId || "",
        referencia_numero: docNumero || "",
        detalhes: `Enviado para ${clientNome} (${phone}) via ${via}`,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); } else { handleOpen(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            Enviar Documento via WhatsApp
          </DialogTitle>
        </DialogHeader>

        {step === "sending" ? (
          <div className="py-8 text-center">
            <div className="w-10 h-10 border-4 border-muted border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Gerando e enviando PDF via API...</p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Tipo de PDF */}
            <div>
              <Label className="text-xs mb-2 block">Tipo de documento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setPdfTipo("normal"); setMsgText(buildDefaultMsg()); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${pdfTipo === "normal" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileDown className="w-4 h-4 mb-1 text-primary" />
                  <p className="text-xs font-semibold">PDF Normal</p>
                  <p className="text-[10px] text-muted-foreground">Documento padrão</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setPdfTipo("quitado"); setMsgText(buildDefaultMsg()); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${pdfTipo === "quitado" ? "border-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-300"}`}
                >
                  <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-600" />
                  <p className="text-xs font-semibold">PDF Quitado</p>
                  <p className="text-[10px] text-muted-foreground">Marca como QUITADO</p>
                </button>
              </div>
            </div>

            {/* Forma de envio */}
            <div>
              <Label className="text-xs mb-2 block">Canal de envio</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSendMode("web")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${sendMode === "web" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <Globe className="w-4 h-4 mb-1 text-blue-600" />
                  <p className="text-xs font-semibold">WhatsApp Web</p>
                  <p className="text-[10px] text-muted-foreground">Abre no navegador</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode("api")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${sendMode === "api" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"} ${!hasApi ? "opacity-50" : ""}`}
                  disabled={!hasApi}
                >
                  <Smartphone className="w-4 h-4 mb-1 text-emerald-600" />
                  <p className="text-xs font-semibold">API WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">{hasApi ? "Envio automático" : "Não configurada"}</p>
                </button>
              </div>
            </div>

            {/* Mensagem */}
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                className="mt-1 text-sm"
                rows={3}
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
              />
            </div>

            {/* Info para WhatsApp Web */}
            {sendMode === "web" && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1.5">
                <p className="font-semibold">Como funciona (WhatsApp Web):</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Clique em <strong>"Baixar PDF"</strong> para salvar o arquivo</li>
                  <li>Clique em <strong>"Abrir WhatsApp Web"</strong></li>
                  <li>Anexe o PDF baixado manualmente no chat</li>
                </ol>
              </div>
            )}

            {/* Info API */}
            {sendMode === "api" && hasApi && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                ✓ O PDF será gerado, enviado por upload e encaminhado com anexo automaticamente via API.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Cancelar</Button>
          {step !== "sending" && sendMode === "web" && (
            <>
              <Button variant="outline" onClick={downloadPDF} size="sm" className="gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
                {pdfReady ? "Baixar Novamente" : "Baixar PDF"}
              </Button>
              <Button onClick={sendViaWeb} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Send className="w-3.5 h-3.5" /> Abrir WhatsApp Web
              </Button>
            </>
          )}
          {step !== "sending" && sendMode === "api" && (
            <Button onClick={sendViaApi} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={!hasApi}>
              <Send className="w-3.5 h-3.5" /> Enviar via API
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}