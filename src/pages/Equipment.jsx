import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Pencil, Trash2, Search, Upload, ImageIcon, Link as LinkIcon, Wrench, Hash, ScanBarcode } from "lucide-react";
import SerialManager from "../components/equipment/SerialManager";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL_TIPOS = [
  { value: "andaime_tubular", label: "Andaime Tubular", color: "bg-emerald-100 text-emerald-700" },
  { value: "andaime_fachadeiro", label: "Andaime Fachadeiro", color: "bg-blue-100 text-blue-700" },
  { value: "grade", label: "Grade", color: "bg-purple-100 text-purple-700" },
  { value: "cacamba", label: "Caçamba", color: "bg-amber-100 text-amber-700" },
  { value: "escora", label: "Escora", color: "bg-orange-100 text-orange-700" },
  { value: "equipamento", label: "Equipamento", color: "bg-slate-100 text-slate-600" },
  { value: "outro", label: "Outro", color: "bg-gray-100 text-gray-600" },
];

const tipoColor = (v) => ALL_TIPOS.find(t => t.value === v)?.color || "bg-slate-100 text-slate-600";
const tipoLabel = (v) => ALL_TIPOS.find(t => t.value === v)?.label || v || "—";

// Normaliza tipos: aceita string (legado) ou array
function normalizeTipos(item) {
  if (Array.isArray(item.tipos)) return item.tipos;
  if (item.tipo) {
    const v = item.tipo === "andaime" ? "andaime_tubular" : item.tipo;
    return [v];
  }
  return ["equipamento"];
}

const statusConfig = {
  disponivel: { label: "Disponível", className: "bg-emerald-100 text-emerald-700" },
  alugado: { label: "Alugado", className: "bg-blue-100 text-blue-700" },
  manutencao: { label: "Manutenção", className: "bg-amber-100 text-amber-700" },
};

const emptyForm = {
  nome: "", marca: "", modelo: "", tipos: ["equipamento"], voltagem: "nao_aplicavel",
  codigo: "", foto_url: "", link_externo: "", quantidade_total: 1, quantidade_disponivel: 1,
  quantidade_manutencao: 0, status_item: "disponivel", valor_diario: 0, valor_mensal: 0,
  valor_indenizacao: 0, descricao: "", ativo: true,
  aplica_valor_minimo: true, dias_minimos_proprio: 0,
  aplica_desconto_automatico: false,
  controle_individual: false,
  numeracoes: [],
};

// Multi-tipo selector
function TipoSelector({ value = [], onChange }) {
  const toggle = (v) => {
    if (value.includes(v)) {
      if (value.length === 1) return; // mínimo 1
      onChange(value.filter(t => t !== v));
    } else {
      onChange([...value, v]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {ALL_TIPOS.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => toggle(t.value)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
            value.includes(t.value)
              ? cn(t.color, "border-transparent ring-2 ring-primary/40")
              : "bg-background border-border text-muted-foreground hover:border-primary/40"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function Equipment() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [codigoFilter, setCodigoFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    base44.entities.Equipment.list("-created_date", 500).then((data) => {
      setItems(data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((item) => {
    const tipos = normalizeTipos(item);
    const matchSearch = !search || [item.nome, item.marca, item.modelo, item.codigo]
      .filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()));
    const matchCodigo = !codigoFilter || (item.codigo || "").toLowerCase().includes(codigoFilter.toLowerCase());
    const matchStatus = statusFilter === "todos" || item.status_item === statusFilter;
    const matchTipo = tipoFilter === "todos" || tipos.includes(tipoFilter) ||
      (tipoFilter === "andaime_tubular" && item.tipo === "andaime");
    return matchSearch && matchCodigo && matchStatus && matchTipo;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      nome: item.nome || "", marca: item.marca || "", modelo: item.modelo || "",
      tipos: normalizeTipos(item),
      voltagem: item.voltagem || "nao_aplicavel",
      codigo: item.codigo || "", foto_url: item.foto_url || "",
      quantidade_total: item.quantidade_total || 1,
      quantidade_disponivel: item.quantidade_disponivel || 1,
      quantidade_manutencao: item.quantidade_manutencao || 0,
      status_item: item.status_item || "disponivel",
      link_externo: item.link_externo || "",
      valor_diario: item.valor_diario || 0, valor_mensal: item.valor_mensal || 0,
      valor_indenizacao: item.valor_indenizacao || 0,
      descricao: item.descricao || "", ativo: item.ativo !== false,
      aplica_valor_minimo: item.aplica_valor_minimo !== false,
      dias_minimos_proprio: item.dias_minimos_proprio || 0,
      aplica_desconto_automatico: item.aplica_desconto_automatico === true,
      controle_individual: item.controle_individual === true,
      numeracoes: item.numeracoes || [],
    });
    setDialogOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((prev) => ({ ...prev, foto_url: file_url }));
    setUploading(false);
    toast.success("Foto enviada!");
  };

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }

    // Verificar código duplicado
    if (form.codigo) {
      const existing = items.find(i => i.codigo === form.codigo && i.id !== editing?.id);
      if (existing) { toast.error(`Código "${form.codigo}" já está em uso por "${existing.nome}"`); return; }
    }

    // Valida seriais duplicados
    if (form.controle_individual && form.numeracoes?.length > 0) {
      const seriais = form.numeracoes.map(n => n.serial);
      const unicos = new Set(seriais);
      if (unicos.size !== seriais.length) { toast.error("Existem seriais duplicados. Corrija antes de salvar."); return; }
    }

    // Salva tipos como array; mantém 'tipo' como primeiro da lista para compatibilidade
    const dataToSave = { ...form, tipo: form.tipos[0] };

    if (editing) {
      await base44.entities.Equipment.update(editing.id, dataToSave);
      toast.success("Equipamento atualizado");
    } else {
      await base44.entities.Equipment.create(dataToSave);
      toast.success("Equipamento cadastrado");
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este equipamento?")) return;
    await base44.entities.Equipment.delete(id);
    toast.success("Equipamento excluído");
    load();
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const statsSummary = {
    disponivel: items.filter((i) => i.status_item === "disponivel").length,
    alugado: items.filter((i) => i.status_item === "alugado").length,
    manutencao: items.filter((i) => i.status_item === "manutencao").length,
  };

  // Hint: andaime lógico para calculadores
  const hasAndaime = (tipos) => tipos?.some(t => ["andaime_tubular", "andaime_fachadeiro"].includes(t));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Equipamentos" subtitle={`${items.length} cadastrados`}>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Equipamento
        </Button>
      </PageHeader>

      {/* Stock Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(statsSummary).map(([key, count]) => (
          <div key={key} className={cn("rounded-xl p-3 text-center", statusConfig[key]?.className.replace("text-", "bg-").replace("100", "50"))}>
            <p className="text-2xl font-bold font-heading">{count}</p>
            <p className={cn("text-xs font-semibold mt-0.5", statusConfig[key]?.className.split(" ")[1])}>
              {statusConfig[key]?.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, marca ou modelo..."
            className="pl-10 bg-card border-0 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-44">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por código..."
            className="pl-9 bg-card border-0 shadow-sm"
            value={codigoFilter}
            onChange={(e) => setCodigoFilter(e.target.value)}
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-52 bg-card border-0 shadow-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {ALL_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-0 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="alugado">Alugado</SelectItem>
            <SelectItem value="manutencao">Em Manutenção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item) => {
          const tipos = normalizeTipos(item);
          return (
            <Card key={item.id} className="border-0 shadow-sm overflow-hidden hover:shadow-lg transition-all">
              {/* Photo */}
              <div className="relative h-40 bg-muted/50 flex items-center justify-center overflow-hidden">
                {item.foto_url ? (
                  <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                )}
                <div className="absolute top-2 right-2">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", statusConfig[item.status_item || "disponivel"]?.className)}>
                    {statusConfig[item.status_item || "disponivel"]?.label}
                  </span>
                </div>
                {item.codigo && (
                  <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-mono font-bold bg-black/60 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" />{item.codigo}
                    </span>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{item.nome}</h3>
                    {/* Multi-tipo badges */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {tipos.map(t => (
                        <span key={t} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", tipoColor(t))}>
                          {tipoLabel(t)}
                        </span>
                      ))}
                    </div>
                    {(item.marca || item.modelo) && (
                      <span className="text-[10px] text-muted-foreground truncate block mt-0.5">{[item.marca, item.modelo].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                  <div className="flex gap-1 ml-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
                {item.voltagem && item.voltagem !== "nao_aplicavel" && (
                  <span className="inline-block text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground mb-2">
                    {item.voltagem}
                  </span>
                )}
                <div className="space-y-0.5 text-xs text-muted-foreground mt-1">
                  <div className="flex justify-between">
                    <span>Diário</span>
                    <span className="font-medium text-foreground">R$ {(item.valor_diario || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mensal</span>
                    <span className="font-medium text-foreground">R$ {(item.valor_mensal || 0).toFixed(2)}</span>
                  </div>
                  {item.valor_indenizacao > 0 && (
                    <div className="flex justify-between">
                      <span>Indenização</span>
                      <span className="font-medium text-red-600">R$ {(item.valor_indenizacao || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {item.link_externo && (
                    <a href={item.link_externo} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline mt-1">
                      <LinkIcon className="w-3 h-3" /> Ver manual/vídeo
                    </a>
                  )}
                  {(item.quantidade_manutencao || 0) > 0 && (
                    <div className="flex items-center gap-1 text-amber-600 mt-1">
                      <Wrench className="w-3 h-3" /> {item.quantidade_manutencao} em manutenção
                    </div>
                  )}
                  {item.controle_individual && (
                    <div className="flex items-center gap-1 text-violet-600 mt-1">
                      <ScanBarcode className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">
                        {(item.numeracoes || []).length} seriais
                        {" — "}
                        {(item.numeracoes || []).filter(n => n.status === "disponivel").length} disponíveis
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum equipamento encontrado</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Photo Upload */}
            <div>
              <Label className="text-xs mb-2 block">Foto do Equipamento</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden"
              >
                {form.foto_url ? (
                  <img src={form.foto_url} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">{uploading ? "Enviando..." : "Clique para fazer upload"}</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Identification */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Código do Equipamento</Label>
                <Input value={form.codigo} onChange={(e) => update("codigo", e.target.value.toUpperCase())} placeholder="Ex: AND-001" className="mt-1 font-mono" />
                <p className="text-[11px] text-muted-foreground mt-1">Identificador único (letras e números)</p>
              </div>
              <div>
                <Label className="text-xs">Marca</Label>
                <Input value={form.marca} onChange={(e) => update("marca", e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modelo</Label>
                <Input value={form.modelo} onChange={(e) => update("modelo", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Voltagem</Label>
                <Select value={form.voltagem} onValueChange={(v) => update("voltagem", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="110v">110v</SelectItem>
                    <SelectItem value="220v">220v</SelectItem>
                    <SelectItem value="bivolt">Bivolt</SelectItem>
                    <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-tipo */}
            <div>
              <Label className="text-xs">Tipo(s) do Equipamento * <span className="font-normal text-muted-foreground">(selecione um ou mais)</span></Label>
              <TipoSelector value={form.tipos} onChange={(v) => update("tipos", v)} />
              {hasAndaime(form.tipos) && (
                <p className="text-[11px] mt-1.5 text-blue-600">
                  🏗️ Cálculo automático de andaime disponível em Orçamentos e Contratos
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status_item} onValueChange={(v) => update("status_item", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="alugado">Alugado</SelectItem>
                    <SelectItem value="manutencao">Em Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Link Externo (vídeo/manual)</Label>
                <Input type="url" value={form.link_externo} onChange={(e) => update("link_externo", e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Qtd Total</Label>
                <Input type="number" value={form.quantidade_total} onChange={(e) => update("quantidade_total", Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Qtd Disponível</Label>
                <Input type="number" value={form.quantidade_disponivel} onChange={(e) => update("quantidade_disponivel", Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Valor Diário (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_diario} onChange={(e) => update("valor_diario", Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Valor Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_mensal} onChange={(e) => update("valor_mensal", Number(e.target.value))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Valor de Indenização (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_indenizacao} onChange={(e) => update("valor_indenizacao", Number(e.target.value))} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Valor cobrado em caso de perda ou dano total</p>
            </div>

            <div>
              <Label className="text-xs">Qtd em Manutenção</Label>
              <Input type="number" value={form.quantidade_manutencao} onChange={(e) => {
                const qty = Number(e.target.value);
                update("quantidade_manutencao", qty);
                const newDisp = Math.max(0, (form.quantidade_total || 0) - (form.quantidade_alugada || 0) - qty);
                update("quantidade_disponivel", newDisp);
              }} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Subtrai da quantidade disponível automaticamente</p>
            </div>

            {/* Regra de mínimo */}
            <div className="p-3 rounded-xl border-2 border-blue-100 bg-blue-50 space-y-3">
              <p className="text-xs font-semibold text-blue-800">Regra de Cobrança Mínima</p>
              <div className="flex items-center gap-3">
                <Switch checked={form.aplica_valor_minimo} onCheckedChange={(v) => update("aplica_valor_minimo", v)} />
                <div>
                  <p className="text-sm font-medium">
                    {form.aplica_valor_minimo ? "Aplicar cobrança mínima" : "Sem cobrança mínima"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.aplica_valor_minimo
                      ? "Este equipamento segue a regra de dias mínimos configurada"
                      : "Este equipamento será cobrado apenas pelos dias reais de uso"}
                  </p>
                </div>
              </div>
              {form.aplica_valor_minimo && (
                <div>
                  <Label className="text-xs">Dias mínimos para cobrança *</Label>
                  <Input
                    type="number"
                    value={form.dias_minimos_proprio}
                    onChange={(e) => update("dias_minimos_proprio", Number(e.target.value))}
                    className="mt-1 w-40"
                    placeholder="Ex: 3, 5, 10..."
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Quantidade mínima de dias cobrada neste equipamento (independente da configuração global)
                  </p>
                </div>
              )}
            </div>

            {/* Controle individual por numeração */}
            <div className="p-3 rounded-xl border-2 border-violet-100 bg-violet-50 space-y-3">
              <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                <ScanBarcode className="w-3.5 h-3.5" /> Controle Individual por Numeração
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.controle_individual}
                  onCheckedChange={(v) => update("controle_individual", v)}
                />
                <div>
                  <p className="text-sm font-medium">
                    {form.controle_individual ? "Controle individual ativado" : "Sem controle individual"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.controle_individual
                      ? "Cada unidade terá um serial único e rastreamento completo"
                      : "Equipamento controlado apenas por quantidade total"}
                  </p>
                </div>
              </div>
              {form.controle_individual && (
                <div>
                  <p className="text-xs font-medium text-violet-800 mb-2">Numerações/Seriais</p>
                  <SerialManager
                    numeracoes={form.numeracoes || []}
                    onChange={(v) => update("numeracoes", v)}
                    quantidadeTotal={form.quantidade_total || 1}
                  />
                </div>
              )}
            </div>

            {/* Desconto automático */}
            <div className="p-3 rounded-xl border-2 border-emerald-100 bg-emerald-50 space-y-2">
              <p className="text-xs font-semibold text-emerald-800">Desconto Automático por Tempo</p>
              <div className="flex items-center gap-3">
                <Switch checked={form.aplica_desconto_automatico} onCheckedChange={(v) => update("aplica_desconto_automatico", v)} />
                <div>
                  <p className="text-sm font-medium">
                    {form.aplica_desconto_automatico ? "Aplicar desconto automático" : "Sem desconto automático"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.aplica_desconto_automatico
                      ? "Este equipamento receberá desconto conforme as regras de tempo de locação configuradas"
                      : "Este equipamento não receberá desconto automático por tempo"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações Técnicas</Label>
              <Textarea value={form.descricao} onChange={(e) => update("descricao", e.target.value)} rows={3} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}