import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, Trash2, CheckCircle2, Clock, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateClienteFichaPDF } from "@/lib/generateClienteFichaPDF";

// ─── Componente inline de assinatura ──────────────────────────────────────
function SignaturePad({ onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: ((touch?.clientX ?? e.clientX) - rect.left) * (canvas.width / rect.width),
      y: ((touch?.clientY ?? e.clientY) - rect.top) * (canvas.height / rect.height),
    };
  };

  const onDown = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const onMove = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const onUp = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={560}
          height={160}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">Assine acima com o dedo ou mouse</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">Limpar</Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1 gap-1"><X className="w-3.5 h-3.5" /> Cancelar</Button>
        <Button size="sm" onClick={confirm} className="flex-1 gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmar</Button>
      </div>
    </div>
  );
}

// ─── Dialog principal ──────────────────────────────────────────────────────
export default function FichaCadastralDialog({ open, onOpenChange, client, onClientUpdate }) {
  const [settings, setSettings] = useState(null);
  const [clausula, setClausula] = useState("");
  const [clausulaOption, setClausulaOption] = useState("padrao");
  const [generating, setGenerating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [signMode, setSignMode] = useState(null); // null | "now" | "later"
  const [showPad, setShowPad] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fichas = (client?.documentos || []).filter(d => d.tipo === "ficha_cadastral");

  useEffect(() => {
    if (open) {
      setSignMode(null);
      setShowPad(false);
      setShowPreview(false);
      base44.entities.CompanySettings.list().then(list => {
        const s = list[0] || null;
        setSettings(s);
        // Prioridade: cláusula específica de ficha cadastral → fallback para contrato
        const fichaClausula = s?.clausulas_ficha_cadastral || s?.clausulas_contrato || s?.clausulas_padrao || "";
        setClausula(fichaClausula);
        setClausulaOption(s?.clausulas_ficha_cadastral ? "ficha" : "padrao");
      });
      base44.auth.me().then(u => setCurrentUser(u));
    }
  }, [open]);

  const handleClausulaOption = (val) => {
    setClausulaOption(val);
    if (val === "ficha") setClausula(settings?.clausulas_ficha_cadastral || "");
    else if (val === "padrao") setClausula(settings?.clausulas_contrato || settings?.clausulas_padrao || "");
    else if (val === "os") setClausula(settings?.clausulas_os || "");
    else setClausula("");
  };

  const savePDF = async (signatureDataUrl = null) => {
    setGenerating(true);
    try {
      const doc = generateClienteFichaPDF({ client, settings, clausula, signatureDataUrl });
      const assinado = !!signatureDataUrl;
      const pdfBlob = doc.output("blob");
      const fileName = `Ficha_Cadastral_${(client.nome_razao_social || "cliente").replace(/\s/g, "_")}_${format(new Date(), "yyyy-MM-dd")}${assinado ? "_ASSINADA" : ""}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

      doc.save(fileName);

      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

      const novoDoc = {
        nome: fileName,
        url: file_url,
        tipo: "ficha_cadastral",
        data: new Date().toISOString(),
        usuario: currentUser?.full_name || currentUser?.email || "—",
        status_assinatura: assinado ? "assinado" : "pendente",
      };

      const docsAtuais = client.documentos || [];
      await base44.entities.Client.update(client.id, { documentos: [...docsAtuais, novoDoc] });

      toast.success(assinado ? "Ficha assinada e salva!" : "Ficha gerada — aguardando assinatura");
      if (onClientUpdate) onClientUpdate();
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar ficha: " + err.message);
    } finally {
      setGenerating(false);
      setShowPad(false);
    }
  };

  const handleSignNow = () => {
    setSignMode("now");
    setShowPad(true);
  };

  const handleSignLater = () => {
    setSignMode("later");
    savePDF(null);
  };

  const handleSignatureConfirm = (dataUrl) => {
    setShowPad(false);
    savePDF(dataUrl);
  };

  const handleDelete = async (idx) => {
    const docsAtuais = client.documentos || [];
    const fichaReal = fichas[idx];
    const updated = docsAtuais.filter(d => d !== fichaReal);
    await base44.entities.Client.update(client.id, { documentos: updated });
    toast.success("Ficha removida.");
    if (onClientUpdate) onClientUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <FileText className="w-5 h-5 text-primary" /> Ficha Cadastral
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-muted/40 text-sm">
            <p className="font-semibold">{client?.nome_razao_social}</p>
            <p className="text-xs text-muted-foreground">{client?.cpf_cnpj}</p>
          </div>

          {/* Histórico de fichas geradas */}
          {fichas.length > 0 && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fichas Geradas ({fichas.length})
              </Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {fichas.map((f, idx) => {
                  const assinado = f.status_assinatura === "assinado";
                  return (
                    <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${assinado ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                      {assinado
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${assinado ? "text-emerald-800" : "text-amber-800"}`}>{f.nome}</p>
                        <p className={assinado ? "text-emerald-600" : "text-amber-600"}>
                          {f.data ? format(new Date(f.data), "dd/MM/yyyy HH:mm") : "—"} · {f.usuario || "—"} · {assinado ? "✅ Assinada" : "⏳ Pendente"}
                        </p>
                      </div>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50"><Eye className="w-3 h-3" /></Button>
                      </a>
                      <a href={f.url} download>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-100"><Download className="w-3 h-3" /></Button>
                      </a>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:bg-red-50" onClick={() => handleDelete(idx)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <Label className="text-xs font-semibold">Gerar Nova Ficha</Label>

            <div>
              <Label className="text-xs">Cláusula / Termo</Label>
              <Select value={clausulaOption} onValueChange={handleClausulaOption}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ficha">✅ Ficha Cadastral (configurada em Configurações)</SelectItem>
                  <SelectItem value="padrao">Cláusula padrão (Contratos)</SelectItem>
                  <SelectItem value="os">Cláusula padrão (OS)</SelectItem>
                  <SelectItem value="manual">Digitar manualmente</SelectItem>
                  <SelectItem value="sem">Sem cláusula</SelectItem>
                </SelectContent>
              </Select>
              {clausulaOption === "ficha" && settings?.clausulas_ficha_cadastral && (
                <p className="text-xs text-violet-700 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                  Cláusula carregada automaticamente de Configurações → Cláusulas
                </p>
              )}
              {clausulaOption === "ficha" && !settings?.clausulas_ficha_cadastral && (
                <p className="text-xs text-amber-700 mt-1">
                  ⚠ Nenhuma cláusula de Ficha Cadastral configurada. Vá em Configurações → Cláusulas para definir.
                </p>
              )}
            </div>

            {clausulaOption !== "sem" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Texto da Cláusula (editável)</Label>
                  {clausula && (
                    <button
                      onClick={() => setShowPreview(p => !p)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showPreview ? "Fechar prévia" : "👁 Pré-visualizar"}
                    </button>
                  )}
                </div>
                {showPreview && clausula ? (
                  <div className="mt-1 p-3 rounded-xl border bg-slate-50 text-xs whitespace-pre-wrap font-mono max-h-40 overflow-y-auto text-foreground">
                    {clausula}
                  </div>
                ) : (
                  <Textarea
                    value={clausula}
                    onChange={e => setClausula(e.target.value)}
                    rows={4}
                    className="mt-1 text-sm"
                    placeholder="Ex: Declaro que as informações acima são verdadeiras..."
                  />
                )}
              </div>
            )}

            {/* Pad de assinatura inline */}
            {showPad && signMode === "now" && (
              <div className="border rounded-xl p-3 bg-slate-50">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Assinatura do Cliente</p>
                <SignaturePad
                  onConfirm={handleSignatureConfirm}
                  onCancel={() => { setShowPad(false); setSignMode(null); }}
                />
              </div>
            )}

            {!showPad && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                ℹ O PDF será gerado, baixado e salvo automaticamente nos anexos do cliente.
              </div>
            )}
          </div>
        </div>

        {!showPad && (
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button variant="outline" onClick={handleSignLater} disabled={generating} className="gap-2">
              <Clock className="w-4 h-4" /> {generating && signMode === "later" ? "Gerando..." : "Assinar Depois"}
            </Button>
            <Button onClick={handleSignNow} disabled={generating} className="gap-2">
              <PenLine className="w-4 h-4" /> Assinar Agora
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}