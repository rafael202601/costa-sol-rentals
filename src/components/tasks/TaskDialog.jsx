import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIO_CONFIG, STATUS_CONFIG, CATEGORIA_CONFIG } from "./TaskConfig";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Trash2, Send, Paperclip, CheckSquare, Eye, EyeOff, X } from "lucide-react";

export default function TaskDialog({ open, onOpenChange, task, user, onSaved }) {
  const [form, setForm] = useState(task);
  const [saving, setSaving] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ─── Checklist ────────────────────────────────────────────────────────────
  const addCheck = () => {
    if (!newCheck.trim()) return;
    const item = { id: Date.now().toString(), texto: newCheck.trim(), concluido: false };
    f("checklist", [...(form.checklist || []), item]);
    setNewCheck("");
  };

  const toggleCheck = (id) => {
    f("checklist", (form.checklist || []).map(c =>
      c.id === id ? { ...c, concluido: !c.concluido, concluido_em: !c.concluido ? new Date().toISOString() : "" } : c
    ));
  };

  const removeCheck = (id) => {
    f("checklist", (form.checklist || []).filter(c => c.id !== id));
  };

  // ─── Comentários ─────────────────────────────────────────────────────────
  const addComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: Date.now().toString(),
      texto: newComment.trim(),
      usuario_nome: user?.full_name || user?.email || "Usuário",
      usuario_email: user?.email || "",
      data_hora: new Date().toISOString(),
    };
    f("comentarios", [...(form.comentarios || []), comment]);
    setNewComment("");
  };

  const removeComment = (id) => {
    f("comentarios", (form.comentarios || []).filter(c => c.id !== id));
  };

  // ─── Anexos ───────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("anexos", [...(form.anexos || []), { nome: file.name, url: file_url, tipo: file.type }]);
    setUploading(false);
    toast.success("Arquivo anexado!");
  };

  // ─── Responsáveis ────────────────────────────────────────────────────────
  const [newResp, setNewResp] = useState("");
  const addResp = () => {
    if (!newResp.trim()) return;
    f("responsaveis", [...(form.responsaveis || []), { nome: newResp.trim(), email: "" }]);
    setNewResp("");
  };

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.titulo?.trim()) return toast.error("Título é obrigatório");
    setSaving(true);
    const data = {
      ...form,
      usuario_email: user?.email || "",
      usuario_nome: user?.full_name || user?.email || "",
    };
    if (form.id) {
      await base44.entities.Task.update(form.id, data);
      toast.success("Tarefa salva!");
    } else {
      await base44.entities.Task.create(data);
      toast.success("Tarefa criada!");
    }
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  const checkDone = (form.checklist || []).filter(c => c.concluido).length;
  const checkTotal = (form.checklist || []).length;
  const progress = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{form.id ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info">Dados</TabsTrigger>
            <TabsTrigger value="checklist">
              Checklist {checkTotal > 0 && <span className="ml-1 text-[10px] bg-primary text-white rounded-full px-1">{checkDone}/{checkTotal}</span>}
            </TabsTrigger>
            <TabsTrigger value="comentarios">Comentários {(form.comentarios||[]).length > 0 && <span className="ml-1 text-[10px] bg-muted rounded-full px-1">{form.comentarios.length}</span>}</TabsTrigger>
            <TabsTrigger value="anexos">Anexos {(form.anexos||[]).length > 0 && <span className="ml-1 text-[10px] bg-muted rounded-full px-1">{form.anexos.length}</span>}</TabsTrigger>
          </TabsList>

          {/* ─── DADOS ───────────────────────────────────────────────────── */}
          <TabsContent value="info" className="space-y-3 mt-0">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => f("titulo", e.target.value)} className="mt-1" placeholder="Descreva a tarefa..." />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={e => f("descricao", e.target.value)} rows={2} className="mt-1" placeholder="Detalhes..." />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={e => f("observacoes", e.target.value)} rows={2} className="mt-1" placeholder="Notas internas..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={form.data || ""} onChange={e => f("data", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={form.horario || ""} onChange={e => f("horario", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => f("prioridade", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIO_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className={`inline-flex items-center gap-1.5`}>
                          <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => f("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria || "administrativo"} onValueChange={v => f("categoria", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Visibilidade</Label>
                <Select value={form.visibilidade} onValueChange={v => f("visibilidade", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privada"><span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Privada</span></SelectItem>
                    <SelectItem value="compartilhada"><span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Compartilhada</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Responsáveis */}
            <div>
              <Label className="text-xs">Responsáveis</Label>
              <div className="flex gap-2 mt-1">
                <Input value={newResp} onChange={e => setNewResp(e.target.value)} placeholder="Nome do responsável..." className="flex-1" onKeyDown={e => e.key === "Enter" && addResp()} />
                <Button size="sm" variant="outline" onClick={addResp}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.responsaveis || []).map((r, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                    {r.nome}
                    <button onClick={() => f("responsaveis", form.responsaveis.filter((_, j) => j !== i))} className="hover:text-destructive ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ─── CHECKLIST ──────────────────────────────────────────────── */}
          <TabsContent value="checklist" className="mt-0 space-y-3">
            {checkTotal > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{checkDone} de {checkTotal} concluídos</span>
                  <span className="text-xs font-semibold">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {(form.checklist || []).map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                  <Checkbox checked={item.concluido} onCheckedChange={() => toggleCheck(item.id)} />
                  <span className={`flex-1 text-sm ${item.concluido ? "line-through text-muted-foreground" : ""}`}>{item.texto}</span>
                  <button onClick={() => removeCheck(item.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={newCheck}
                onChange={e => setNewCheck(e.target.value)}
                placeholder="Novo item..."
                className="flex-1"
                onKeyDown={e => e.key === "Enter" && addCheck()}
              />
              <Button size="sm" variant="outline" onClick={addCheck}><Plus className="w-4 h-4" /> Adicionar</Button>
            </div>
          </TabsContent>

          {/* ─── COMENTÁRIOS ─────────────────────────────────────────────── */}
          <TabsContent value="comentarios" className="mt-0 space-y-3">
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {(form.comentarios || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum comentário ainda</p>
              )}
              {(form.comentarios || []).map(c => (
                <div key={c.id} className="p-2.5 rounded-xl bg-muted/40 border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-primary">{c.usuario_nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{c.data_hora ? format(new Date(c.data_hora), "dd/MM HH:mm") : ""}</span>
                      {(c.usuario_email === user?.email || user?.role === "admin") && (
                        <button onClick={() => removeComment(c.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                rows={2}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addComment} className="self-end gap-1"><Send className="w-3.5 h-3.5" /></Button>
            </div>
          </TabsContent>

          {/* ─── ANEXOS ──────────────────────────────────────────────────── */}
          <TabsContent value="anexos" className="mt-0 space-y-3">
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
            <Button variant="outline" onClick={() => fileRef.current.click()} disabled={uploading} className="gap-2 w-full">
              <Paperclip className="w-4 h-4" /> {uploading ? "Enviando..." : "Anexar arquivo / foto"}
            </Button>
            <div className="space-y-2">
              {(form.anexos || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo</p>
              )}
              {(form.anexos || []).map((a, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/30">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-primary hover:underline truncate">{a.nome}</a>
                  <button onClick={() => f("anexos", form.anexos.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}