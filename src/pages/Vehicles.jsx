import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Car, Fuel, Wrench, Trash2, Pencil, TrendingDown, ChevronDown, ChevronUp, Search, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const TIPO_LABELS = { caminhao: "Caminhão", van: "Van", carro: "Carro", moto: "Moto", outro: "Outro" };
const STATUS_COLORS = { ativo: "bg-emerald-100 text-emerald-700", inativo: "bg-muted text-muted-foreground", manutencao: "bg-amber-100 text-amber-700" };
const STATUS_LABELS = { ativo: "Ativo", inativo: "Inativo", manutencao: "Em Manutenção" };
export const EXPENSE_TYPES = { combustivel: "Combustível", manutencao: "Manutenção", seguro: "Seguro", ipva: "IPVA", lavagem: "Lavagem", pneu: "Pneu", outro: "Outro" };
const EXPENSE_ICONS = { combustivel: Fuel, manutencao: Wrench };

const emptyVehicle = () => ({ nome: "", placa: "", modelo: "", marca: "", ano: new Date().getFullYear(), cor: "", tipo: "caminhao", motorista_nome: "", km_atual: 0, status: "ativo", observacoes: "" });
const emptyExpense = (vehicle_id = "", vehicle_placa = "", vehicle_modelo = "") => ({
  vehicle_id, vehicle_placa, vehicle_modelo, tipo: "combustivel", descricao: "", valor: 0,
  data: format(new Date(), "yyyy-MM-dd"), km: 0, fornecedor: "", observacoes: ""
});

// Card de despesa expandível
function ExpenseCard({ e, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = EXPENSE_ICONS[e.tipo] || Wrench;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Linha principal */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{EXPENSE_TYPES[e.tipo]}</span>
              <span className="text-xs text-muted-foreground font-mono">{e.vehicle_placa}</span>
              <span className="text-xs text-muted-foreground">{e.vehicle_modelo}</span>
            </div>
            {/* Linha secundária */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
              {e.data && <span>📅 {format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy")}</span>}
              {e.km > 0 && <span>🛣️ {e.km.toLocaleString("pt-BR")} km</span>}
              {e.fornecedor && <span>🏪 {e.fornecedor}</span>}
            </div>
            {/* Detalhe expandido */}
            {expanded && (
              <div className="mt-2 space-y-1 text-xs border-t pt-2">
                {e.descricao && <p><span className="font-medium">Descrição:</span> {e.descricao}</p>}
                {e.observacoes && <p className="text-muted-foreground"><span className="font-medium text-foreground">Obs:</span> {e.observacoes}</p>}
              </div>
            )}
            {/* Botão expandir */}
            {(e.descricao || e.observacoes) && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-1.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Menos detalhes" : "Ver detalhes"}
              </button>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <p className="font-bold text-destructive">R$ {(e.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(e.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editExpenseDialog, setEditExpenseDialog] = useState(false);
  const [form, setForm] = useState(emptyVehicle());
  const [expForm, setExpForm] = useState(emptyExpense());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Filtros despesas
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterKmMin, setFilterKmMin] = useState("");
  const [filterKmMax, setFilterKmMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const load = () => {
    Promise.all([
      base44.entities.Vehicle.list("-created_date"),
      base44.entities.VehicleExpense.list("-data", 500),
      base44.auth.me(),
    ]).then(([v, e, u]) => {
      setVehicles(v);
      setExpenses(e);
      setCurrentUser(u);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "Admin";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <Car className="w-12 h-12 opacity-30" />
      <p className="font-semibold text-lg">Acesso Restrito</p>
      <p className="text-sm">Apenas Administradores podem gerenciar veículos.</p>
    </div>
  );

  const openNewVehicle = () => { setForm(emptyVehicle()); setEditId(null); setVehicleDialog(true); };
  const openEditVehicle = (v) => { setForm({ ...v }); setEditId(v.id); setVehicleDialog(true); };
  const openNewExpense = (v) => { setExpForm(emptyExpense(v.id, v.placa, v.modelo)); setSelectedVehicle(v); setExpenseDialog(true); };

  const saveVehicle = async () => {
    if (!form.placa || !form.modelo) { toast.error("Placa e modelo obrigatórios"); return; }
    setSaving(true);
    if (editId) {
      await base44.entities.Vehicle.update(editId, form);
      toast.success("Veículo atualizado!");
    } else {
      await base44.entities.Vehicle.create(form);
      toast.success("Veículo cadastrado!");
    }
    setVehicleDialog(false);
    setSaving(false);
    load();
  };

  const saveExpense = async () => {
    if (!expForm.valor || expForm.valor <= 0) { toast.error("Valor obrigatório e maior que zero"); return; }
    if (!expForm.tipo) { toast.error("Tipo obrigatório"); return; }
    if (expForm.km < 0) { toast.error("KM não pode ser negativo"); return; }
    setSaving(true);
    await base44.entities.VehicleExpense.create(expForm);
    if (expForm.km > 0 && selectedVehicle) {
      await base44.entities.Vehicle.update(selectedVehicle.id, { km_atual: expForm.km });
    }
    toast.success("Despesa registrada!");
    setExpenseDialog(false);
    setSaving(false);
    load();
  };

  const deleteExpense = async (id) => {
    if (!confirm("Remover esta despesa?")) return;
    await base44.entities.VehicleExpense.delete(id);
    toast.success("Despesa removida!");
    load();
  };

  const totalExpenses = (vehicleId) => expenses.filter(e => e.vehicle_id === vehicleId).reduce((s, e) => s + (e.valor || 0), 0);

  const hasActiveFilters = filterTipo !== "todos" || filterFornecedor || filterDateFrom || filterDateTo || filterKmMin || filterKmMax;

  const clearFilters = () => {
    setFilterTipo("todos"); setFilterFornecedor(""); setFilterDateFrom("");
    setFilterDateTo(""); setFilterKmMin(""); setFilterKmMax("");
  };

  const filteredExpenses = expenses.filter(e => {
    if (filterTipo !== "todos" && e.tipo !== filterTipo) return false;
    if (filterFornecedor && !(e.fornecedor || "").toLowerCase().includes(filterFornecedor.toLowerCase())) return false;
    if (filterDateFrom && e.data && e.data < filterDateFrom) return false;
    if (filterDateTo && e.data && e.data > filterDateTo) return false;
    if (filterKmMin && (e.km || 0) < Number(filterKmMin)) return false;
    if (filterKmMax && (e.km || 0) > Number(filterKmMax)) return false;
    return true;
  });

  const totalFiltrado = filteredExpenses.reduce((s, e) => s + (e.valor || 0), 0);

  return (
    <div>
      <PageHeader title="Gestão de Veículos" subtitle={`${vehicles.length} veículo(s) cadastrado(s)`}>
        <Button onClick={openNewVehicle} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Veículo
        </Button>
      </PageHeader>

      <Tabs defaultValue="veiculos">
        <TabsList className="mb-6">
          <TabsTrigger value="veiculos">Veículos ({vehicles.length})</TabsTrigger>
          <TabsTrigger value="despesas">Todas as Despesas ({expenses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="veiculos">
          {vehicles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="font-semibold">Nenhum veículo cadastrado</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v) => {
                const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
                const totalGasto = totalExpenses(v.id);
                return (
                  <Card key={v.id} className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg font-heading">{v.nome || v.placa}</p>
                          <p className="text-sm text-muted-foreground font-mono">{v.placa}</p>
                          <p className="text-xs text-muted-foreground">{v.marca} {v.modelo} {v.ano ? `(${v.ano})` : ""}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditVehicle(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status]}`}>{STATUS_LABELS[v.status]}</span>
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TIPO_LABELS[v.tipo]}</span>
                        {v.cor && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{v.cor}</span>}
                      </div>
                      {v.motorista_nome && <p className="text-xs text-muted-foreground mb-1">👤 {v.motorista_nome}</p>}
                      {v.km_atual > 0 && <p className="text-xs text-muted-foreground mb-2">🛣️ {v.km_atual.toLocaleString("pt-BR")} km</p>}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingDown className="w-3 h-3" />
                          <span>{vExpenses.length} despesa(s) — R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openNewExpense(v)} className="gap-1 text-xs h-7">
                          <Plus className="w-3 h-3" /> Despesa
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="despesas">
          {/* Barra de filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor..."
                className="pl-9 bg-card border-0 shadow-sm"
                value={filterFornecedor}
                onChange={e => setFilterFornecedor(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className={cn("gap-2 shrink-0", hasActiveFilters && "border-primary text-primary")}
              onClick={() => setShowFilters(v => !v)}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
            </Button>
          </div>

          {showFilters && (
            <div className="bg-card border-0 shadow-sm rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(EXPENSE_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data (de)</p>
                  <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data (até)</p>
                  <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">KM mín.</p>
                  <Input type="number" value={filterKmMin} onChange={e => setFilterKmMin(e.target.value)} className="h-8 text-xs" placeholder="0" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">KM máx.</p>
                  <Input type="number" value={filterKmMax} onChange={e => setFilterKmMax(e.target.value)} className="h-8 text-xs" placeholder="sem limite" />
                </div>
                <div className="flex items-end">
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-xs text-destructive hover:underline flex items-center gap-1 h-8">
                      <X className="w-3 h-3" /> Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Totalizador */}
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} despesa(s) encontrada(s)</p>
            <p className="text-sm font-bold text-destructive">
              Total: R$ {totalFiltrado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-2">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><p>Nenhuma despesa encontrada</p></div>
            ) : (
              filteredExpenses.map((e) => (
                <ExpenseCard key={e.id} e={e} onDelete={deleteExpense} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Vehicle Dialog */}
      <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs">Nome do Veículo (Identificação Principal)</Label>
              <Input className="mt-1" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Caminhão Azul, Van da Tarde..." />
            </div>
            <div>
              <Label className="text-xs">Placa *</Label>
              <Input className="mt-1 uppercase" value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1234" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIPO_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Marca</Label>
              <Input className="mt-1" value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Modelo *</Label>
              <Input className="mt-1" value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input type="number" className="mt-1" value={form.ano} onChange={e => setForm(p => ({ ...p, ano: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Input className="mt-1" value={form.cor} onChange={e => setForm(p => ({ ...p, cor: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">KM Atual</Label>
              <Input type="number" className="mt-1" value={form.km_atual} onChange={e => setForm(p => ({ ...p, km_atual: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="manutencao">Em Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Motorista Responsável</Label>
              <Input className="mt-1" value={form.motorista_nome} onChange={e => setForm(p => ({ ...p, motorista_nome: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea className="mt-1" rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleDialog(false)}>Cancelar</Button>
            <Button onClick={saveVehicle} disabled={saving}>{saving ? "Salvando..." : editId ? "Atualizar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova Despesa — {selectedVehicle?.placa} {selectedVehicle?.modelo}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={expForm.tipo} onValueChange={v => setExpForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EXPENSE_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" className="mt-1" value={expForm.data} onChange={e => setExpForm(p => ({ ...p, data: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" className="mt-1" value={expForm.valor} onChange={e => setExpForm(p => ({ ...p, valor: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">KM no momento</Label>
              <Input type="number" min="0" className="mt-1" value={expForm.km} onChange={e => setExpForm(p => ({ ...p, km: Number(e.target.value) }))} />
              <p className="text-[10px] text-muted-foreground mt-0.5">Ex: 125430</p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input className="mt-1" placeholder="Ex: Troca de óleo, Abastecimento diesel..." value={expForm.descricao} onChange={e => setExpForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Fornecedor/Posto</Label>
              <Input className="mt-1" placeholder="Ex: Posto Shell, Oficina João..." value={expForm.fornecedor} onChange={e => setExpForm(p => ({ ...p, fornecedor: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea className="mt-1" rows={2} placeholder="Informações adicionais..." value={expForm.observacoes} onChange={e => setExpForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>Cancelar</Button>
            <Button onClick={saveExpense} disabled={saving}>{saving ? "Salvando..." : "Registrar Despesa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}