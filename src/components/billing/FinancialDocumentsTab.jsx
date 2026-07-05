import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, Eye, FileText, AlertCircle, CheckCircle2, Clock, XCircle, Plus, Trash2 } from "lucide-react";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
import { toast } from "sonner";

const TIPOS_DOC = [
  { value: "boleto", label: "Boleto Bancário" },
  { value: "nf", label: "Nota Fiscal (NF)" },
  { value: "nfe", label: "Nota Fiscal Eletrônica (NFe)" },
  { value: "outros", label: "Outros" },
];

const STATUS_DOC = [
  { value: "pendente", label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  { value: "pago", label: "Pago", cls: "bg-emerald-100 text-emerald-700" },
  { value: "vencido", label: "Vencido", cls: "bg-red-100 text-red-700" },
  { value: "cancelado", label: "Cancelado", cls: "bg-slate-100 text-slate-600" },
];

function getStatusDoc(doc) {
  if (doc.status === "pago") return "pago";
  if (doc.status === "cancelado") return "cancelado";
  if (doc.tipo === "boleto" && doc.data_vencimento) {
    const venc = new Date(doc.data_vencimento);
    if (isBefore(venc, startOfToday())) return "vencido";
  }
  return doc.status || "pendente";
}

const EMPTY_DOC = {
  tipo: "",
  numero: "",
  data_vencimento: "",
  data_emissao: "",
  valor: "",
  observacao: "",
  arquivo_url: "",
  arquivo_nome: "",
  status: "pendente",
};

export default function FinancialDocumentsTab({ note, onUpdated }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_DOC });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  const docs = (note.documentos_financeiros || []).map((d) => ({
    ...d,
    _statusCalc: getStatusDoc(d),
  }));

  const filtered = docs.filter((d) => {
    if (filterTipo !== "todos" && d.tipo !== filterTipo) return false;
    if (filterStatus !== "todos" && d._statusCalc !== filterStatus) return false;
    return true;
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update("arquivo_url", file_url);
    update("arquivo_nome", file.name);
    setUploading(false);
    e.target.value = "";
    toast.success("Arquivo enviado!");
  };

  const validar = () => {
    if (!form.tipo) { toast.error("Selecione o tipo do documento"); return false; }
    if (!form.numero) { toast.error("Informe o número do documento"); return false; }
    if (form.tipo === "boleto" && !form.data_vencimento) {
      toast.error("Data de vencimento é obrigatória para boleto");
      return false;
    }
    return true;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSaving(true);
    const me = await base44.auth.me().catch(() => null);
    const novoDoc = {
      ...form,
      valor: form.valor ? parseFloat(form.valor) : null,
      criado_por: me?.email || me?.full_name || "",
      criado_em: new Date().toISOString(),
    };
    const docsAtualizados = [...(note.documentos_financeiros || []), novoDoc];
    const updated = await base44.entities.BillingNote.update(note.id, { documentos_financeiros: docsAtualizados });
    toast.success("Documento salvo!");
    setSaving(false);
    setShowForm(false);
    setForm({ ...EMPTY_DOC });
    onUpdated(updated);
  };

  const handleMarcarPago = async (idx) => {
    const docsAtualizados = [...(note.documentos_financeiros || [])];
    docsAtualizados[idx] = { ...docsAtualizados[idx], status: "pago" };
    const updated = await base44.entities.BillingNote.update(note.id, { documentos_financeiros: docsAtualizados });
    toast.success("Documento marcado como pago!");
    onUpdated(updated);
  };

  const handleRemover = async (idx) => {
    if (!window.confirm("Remover este documento?")) return;
    const docsAtualizados = (note.documentos_financeiros || []).filter((_, i) => i !== idx);
    const updated = await base44.entities.BillingNote.update(note.id, { documentos_financeiros: docsAtualizados });
    toast.success("Documento removido");
    onUpdated(updated);
  };

  const statusCfg = (s) => STATUS_DOC.find((x) => x.value === s) || STATUS_DOC[0];
  const tipoCfg = (t) => TIPOS_DOC.find((x) => x.value === t)?.label || t;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_DOC.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Todos status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS_DOC.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setShowForm(true); setForm({ ...EMPTY_DOC }); }} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Novo Documento
          </Button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
          <p className="text-sm font-semibold">Adicionar Documento Financeiro</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOC.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Número do Documento *</Label>
              <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} className="mt-1 h-9 text-sm" placeholder="Ex: 000123" />
            </div>

            {form.tipo === "boleto" && (
              <div>
                <Label className="text-xs">Data de Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => update("data_vencimento", e.target.value)} className="mt-1 h-9 text-sm" />
              </div>
            )}
            <div>
              <Label className="text-xs">Data de Emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => update("data_emissao", e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => update("valor", e.target.value)} className="mt-1 h-9 text-sm" placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_DOC.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Observação</Label>
              <Textarea value={form.observacao} onChange={(e) => update("observacao", e.target.value)} rows={2} className="mt-1 text-sm" placeholder="Opcional..." />
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Arquivo (PDF, imagem)</Label>
              <div className="mt-1 flex items-center gap-2">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/40 text-xs text-muted-foreground transition-colors bg-white">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Enviando..." : form.arquivo_nome || "Selecionar arquivo"}
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleUpload} disabled={uploading} />
                </label>
                {form.arquivo_url && (
                  <a href={form.arquivo_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"><Eye className="w-3.5 h-3.5" /> Ver</Button>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSalvar} disabled={saving} size="sm" className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Salvar Documento"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {docs.length === 0 ? "Nenhum documento financeiro anexado" : "Nenhum documento encontrado com os filtros selecionados"}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((doc, idx) => {
          const realIdx = (note.documentos_financeiros || []).findIndex((d) => d === docs.find((x) => x === doc));
          const status = doc._statusCalc;
          const scfg = statusCfg(status);
          return (
            <div key={idx} className="p-3 rounded-xl border bg-white space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{tipoCfg(doc.tipo)}</span>
                      <span className="text-xs text-muted-foreground">#{doc.numero}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${scfg.cls}`}>{scfg.label}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {doc.data_vencimento && (
                        <span className={status === "vencido" ? "text-red-600 font-medium" : ""}>
                          Venc: {format(parseISO(doc.data_vencimento), "dd/MM/yyyy")}
                          {status === "vencido" && " ⚠ Vencido"}
                        </span>
                      )}
                      {doc.data_emissao && <span>Emissão: {format(parseISO(doc.data_emissao), "dd/MM/yyyy")}</span>}
                      {doc.valor && <span>R$ {parseFloat(doc.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    </div>
                    {doc.observacao && <p className="text-xs text-muted-foreground mt-0.5">{doc.observacao}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.arquivo_url && (
                    <>
                      <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                      </a>
                      <a href={doc.arquivo_url} download={doc.arquivo_nome || "documento"} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </>
                  )}
                  {status !== "pago" && status !== "cancelado" && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 gap-1" onClick={() => handleMarcarPago(idx)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:bg-red-50" onClick={() => handleRemover(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}