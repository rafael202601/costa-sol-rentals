import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Star, Eye, EyeOff, ImageIcon, Pin, Archive,
  RotateCcw, Bell, Clock, AlertTriangle, Paperclip, X, Search, Filter
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";
import { toast } from "sonner";

const PRIORIDADE_CFG = {
  normal:     { label: "Normal",     cls: "bg-slate-100 text-slate-600" },
  importante: { label: "Importante", cls: "bg-amber-100 text-amber-700" },
  urgente:    { label: "Urgente",    cls: "bg-red-100 text-red-700" },
};

const CATEGORIA_CFG = {
  geral:       { label: "Geral",       cls: "bg-blue-100 text-blue-700" },
  logistica:   { label: "Logística",   cls: "bg-violet-100 text-violet-700" },
  financeiro:  { label: "Financeiro",  cls: "bg-emerald-100 text-emerald-700" },
  manutencao:  { label: "Manutenção",  cls: "bg-orange-100 text-orange-700" },
  rh:          { label: "RH",          cls: "bg-pink-100 text-pink-700" },
  comercial:   { label: "Comercial",   cls: "bg-cyan-100 text-cyan-700" },
};

const STATUS_CFG = {
  agendado:  { label: "Agendado",  cls: "bg-blue-100 text-blue-700" },
  ativo:     { label: "Ativo",     cls: "bg-emerald-100 text-emerald-700" },
  encerrado: { label: "Encerrado", cls: "bg-slate-100 text-slate-600" },
  arquivado: { label: "Arquivado", cls: "bg-gray-100 text-gray-500" },
};

const EMPTY = {
  titulo: "", descricao: "", imagem_url: "", categoria: "geral", prioridade: "normal",
  status: "ativo", data: format(new Date(), "yyyy-MM-dd"), data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_fim: "", hora_publicacao: "", ativo: true, destaque: false, fixado: false,
  exibir_portal: true, setor_destino: "todos", responsavel: "", anexos: [],
};

// Calcula status automático baseado nas datas
function computeStatus(item) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  if (item.data_inicio && item.data_inicio > hoje) return "agendado";
  if (item.data_fim && item.data_fim < hoje) return "encerrado";
  if (!item.ativo) return "arquivado";
  return "ativo";
}

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [tab, setTab] = useState("ativos");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const [filterPrio, setFilterPrio] = useState("todos");
  const imgRef = useRef();
  const anexoRef = useRef();

  const load = async () => {
    const d = await base44.entities.Announcement.list("-data");
    setItems(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const openNew = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const openEdit = (item) => { setForm({ ...EMPTY, ...item }); setEditing(item.id); setOpen(true); };

  const handleSave = async () => {
    if (!form.titulo) { toast.error("Informe o título"); return; }
    if (!form.data) { toast.error("Informe a data"); return; }
    const status = computeStatus(form);
    const data = { ...form, status };
    if (editing) {
      await base44.entities.Announcement.update(editing, data);
      toast.success("Anúncio atualizado!");
    } else {
      await base44.entities.Announcement.create(data);
      toast.success("Anúncio criado!");
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Announcement.delete(id);
    toast.success("Excluído.");
    load();
  };

  const handleArchive = async (item) => {
    await base44.entities.Announcement.update(item.id, { ativo: false, status: "arquivado" });
    toast.success("Anúncio arquivado.");
    load();
  };

  const handleReactivate = async (item) => {
    const status = item.data_fim && item.data_fim < format(new Date(), "yyyy-MM-dd") ? "ativo" : computeStatus({ ...item, ativo: true, data_fim: "" });
    await base44.entities.Announcement.update(item.id, { ativo: true, status, data_fim: "" });
    toast.success("Anúncio reativado!");
    load();
  };

  const handleTogglePin = async (item) => {
    await base44.entities.Announcement.update(item.id, { fixado: !item.fixado });
    load();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    up("imagem_url", file_url);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const handleAnexoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingAnexo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    up("anexos", [...(form.anexos || []), { nome: file.name, url: file_url, tipo: file.type }]);
    setUploadingAnexo(false);
    toast.success("Anexo adicionado!");
  };

  // Filtros
  const applyFilters = (list) => list.filter(item => {
    const q = search.toLowerCase();
    const matchQ = !q || item.titulo?.toLowerCase().includes(q) || item.descricao?.toLowerCase().includes(q);
    const matchC = filterCat === "todos" || item.categoria === filterCat;
    const matchP = filterPrio === "todos" || item.prioridade === filterPrio;
    return matchQ && matchC && matchP;
  });

  const ativos = applyFilters(items.filter(i => i.status === "ativo" || i.status === "agendado"))
    .sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));
  const arquivados = applyFilters(items.filter(i => i.status === "encerrado" || i.status === "arquivado"));

  return (
    <div>
      <PageHeader title="Anúncios e Comunicados" subtitle="Central de comunicação interna">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Anúncio</Button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Ativos", value: items.filter(i => i.status === "ativo").length, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Agendados", value: items.filter(i => i.status === "agendado").length, cls: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Fixados", value: items.filter(i => i.fixado).length, cls: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Arquivados", value: items.filter(i => i.status === "encerrado" || i.status === "arquivado").length, cls: "bg-slate-50 border-slate-200 text-slate-600" },
        ].map(m => (
          <div key={m.label} className={`rounded-2xl border p-3 ${m.cls}`}>
            <p className="text-xs opacity-70">{m.label}</p>
            <p className="text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar anúncios..." className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(CATEGORIA_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrio} onValueChange={setFilterPrio}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(PRIORIDADE_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="ativos">Ativos / Agendados <span className="ml-1.5 text-[10px] bg-primary text-white rounded-full px-1.5">{ativos.length}</span></TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">{arquivados.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          : ativos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum anúncio ativo</p>
            </div>
          ) : (
            <AnnouncementGrid items={ativos} onEdit={openEdit} onDelete={handleDelete} onArchive={handleArchive} onPin={handleTogglePin} />
          )}
        </TabsContent>

        <TabsContent value="arquivados">
          {arquivados.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><p>Nenhum anúncio arquivado</p></div>
          ) : (
            <AnnouncementGrid items={arquivados} onEdit={openEdit} onDelete={handleDelete} onReactivate={handleReactivate} isArchived />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Anúncio" : "Novo Anúncio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Imagem */}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {form.imagem_url ? (
              <div className="relative">
                <img src={form.imagem_url} alt="" className="w-full h-36 object-cover rounded-xl border" />
                <button onClick={() => up("imagem_url", "")} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-black/70"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => imgRef.current.click()} className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-muted/30 transition-colors">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{uploading ? "Enviando..." : "Adicionar imagem de capa"}</span>
              </button>
            )}

            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => up("titulo", e.target.value)} className="mt-1" placeholder="Título do anúncio..." />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={e => up("descricao", e.target.value)} rows={4} className="mt-1" placeholder="Conteúdo do anúncio..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => up("categoria", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIA_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => up("prioridade", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORIDADE_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Setor Destinatário</Label>
                <Select value={form.setor_destino} onValueChange={v => up("setor_destino", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["todos","Todos"],["logistica","Logística"],["motoristas","Motoristas"],["financeiro","Financeiro"],["administrativo","Administrativo"],["operacional","Operacional"]].map(([k,l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel || ""} onChange={e => up("responsavel", e.target.value)} className="mt-1" placeholder="Nome do responsável..." />
              </div>
              <div>
                <Label className="text-xs">Data de Início (publicação)</Label>
                <Input type="date" value={form.data_inicio || ""} onChange={e => up("data_inicio", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data de Término (encerramento)</Label>
                <Input type="date" value={form.data_fim || ""} onChange={e => up("data_fim", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Hora de Publicação</Label>
                <Input type="time" value={form.hora_publicacao || ""} onChange={e => up("hora_publicacao", e.target.value)} className="mt-1" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Label className="text-xs">Data do Anúncio *</Label>
                <Input type="date" value={form.data || ""} onChange={e => up("data", e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Switches */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {[["ativo","Ativo"],["destaque","Destaque ⭐"],["fixado","Fixar no topo 📌"],["exibir_portal","Exibir no Portal"]].map(([k,l]) => (
                <div key={k} className="flex items-center justify-between p-2 rounded-lg border">
                  <Label className="text-xs cursor-pointer">{l}</Label>
                  <Switch checked={!!form[k]} onCheckedChange={v => up(k, v)} />
                </div>
              ))}
            </div>

            {/* Anexos */}
            <div>
              <Label className="text-xs">Anexos</Label>
              <input ref={anexoRef} type="file" className="hidden" onChange={handleAnexoUpload} accept="image/*,.pdf,.doc,.docx" />
              <button onClick={() => anexoRef.current.click()} disabled={uploadingAnexo} className="mt-1 flex items-center gap-2 text-xs text-primary border border-dashed border-primary/40 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors">
                <Paperclip className="w-3.5 h-3.5" /> {uploadingAnexo ? "Enviando..." : "Adicionar anexo"}
              </button>
              <div className="mt-2 space-y-1">
                {(form.anexos || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded border">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-primary hover:underline truncate">{a.nome}</a>
                    <button onClick={() => up("anexos", form.anexos.filter((_,j) => j!==i))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementGrid({ items, onEdit, onDelete, onArchive, onReactivate, onPin, isArchived = false }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => {
        const pc = PRIORIDADE_CFG[item.prioridade] || PRIORIDADE_CFG.normal;
        const cc = CATEGORIA_CFG[item.categoria] || CATEGORIA_CFG.geral;
        const sc = STATUS_CFG[item.status] || STATUS_CFG.ativo;
        return (
          <Card key={item.id} className={`border-0 shadow-sm overflow-hidden ${item.prioridade === "urgente" ? "ring-2 ring-red-200" : ""} ${item.fixado ? "ring-2 ring-amber-200" : ""}`}>
            {item.imagem_url ? (
              <img src={item.imagem_url} alt={item.titulo} className="w-full h-32 object-cover" />
            ) : (
              <div className={`w-full h-14 flex items-center px-4 ${item.prioridade === "urgente" ? "bg-red-50" : item.prioridade === "importante" ? "bg-amber-50" : "bg-muted/30"}`}>
                <Bell className={`w-5 h-5 ${item.prioridade === "urgente" ? "text-red-400" : item.prioridade === "importante" ? "text-amber-400" : "text-muted-foreground"}`} />
              </div>
            )}
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {item.fixado && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"><Pin className="w-2.5 h-2.5" /> Fixado</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pc.cls}`}>{pc.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cc.cls}`}>{cc.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
              </div>
              <p className="font-semibold text-sm leading-tight truncate">{item.titulo}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {item.data_inicio ? format(parseISO(item.data_inicio), "dd/MM/yyyy") : item.data ? format(parseISO(item.data), "dd/MM/yyyy") : "—"}
                {item.data_fim ? ` → ${format(parseISO(item.data_fim), "dd/MM/yyyy")}` : ""}
              </p>
              {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
              {item.setor_destino && item.setor_destino !== "todos" && (
                <p className="text-[10px] text-muted-foreground mt-1">👥 {item.setor_destino}</p>
              )}
              {(item.anexos || []).length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Paperclip className="w-3 h-3" /> {item.anexos.length} anexo(s)</p>
              )}
              <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t">
                {!isArchived && onPin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(item)} title="Fixar/Desafixar">
                    <Pin className={`w-3.5 h-3.5 ${item.fixado ? "text-amber-500" : "text-muted-foreground"}`} />
                  </Button>
                )}
                {!isArchived && onArchive && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-slate-700" onClick={() => onArchive(item)} title="Arquivar">
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isArchived && onReactivate && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-emerald-600 hover:text-emerald-700 text-xs" onClick={() => onReactivate(item)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Reativar
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}