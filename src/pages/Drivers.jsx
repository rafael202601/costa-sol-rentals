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
import { Plus, Truck, Phone, Car, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { nome: "", email: "", telefone: "", cnh: "", veiculo: "", placa: "", cor: "", status: "ativo", observacoes: "" };

const AUTO_COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#db2777","#0891b2","#65a30d","#ea580c","#4f46e5"];

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [contractsByDriver, setContractsByDriver] = useState({});

  const load = async () => {
    const [drvs, ctrs, oss] = await Promise.all([
      base44.entities.Driver.list("-created_date"),
      base44.entities.Contract.filter({ status: "na_obra" }),
      base44.entities.ServiceOrder.filter({ status: "em_transito" }),
    ]);
    setDrivers(drvs);
    const map = {};
    [...ctrs, ...oss].forEach((item) => {
      const m = item.motorista_entrega || item.motorista_recolhimento;
      if (m) { if (!map[m]) map[m] = []; map[m].push(item); }
    });
    setContractsByDriver(map);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setDialog(true); };
  const openEdit = (d) => { setForm({ ...EMPTY, ...d }); setEditId(d.id); setDialog(true); };
  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    if (editId) {
      await base44.entities.Driver.update(editId, form);
      toast.success("Motorista atualizado!");
    } else {
      await base44.entities.Driver.create(form);
      toast.success("Motorista cadastrado!");
    }
    setSaving(false);
    setDialog(false);
    load();
  };

  const toggleStatus = async (d) => {
    await base44.entities.Driver.update(d.id, { status: d.status === "ativo" ? "inativo" : "ativo" });
    load();
  };

  return (
    <div>
      <PageHeader title="Motoristas" subtitle="Gestão de motoristas e frota">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Motorista</Button>
      </PageHeader>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((d) => {
          const ativos = contractsByDriver[d.nome]?.length || 0;
          return (
            <Card key={d.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.status === "ativo" ? "bg-primary/10" : "bg-muted"}`}>
                      <Truck className={`w-5 h-5 ${d.status === "ativo" ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{d.nome}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${d.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {d.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(d)}>
                      {d.status === "ativo" ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {d.telefone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{d.telefone}</p>}
                  {d.veiculo && <p className="flex items-center gap-1.5"><Car className="w-3 h-3" />{d.veiculo} {d.placa && `— ${d.placa}`}</p>}
                  {ativos > 0 && <p className="text-primary font-semibold">{ativos} entrega(s) ativa(s)</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {drivers.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto opacity-20 mb-3" />
            <p className="font-semibold">Nenhum motorista cadastrado</p>
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Editar" : "Novo"} Motorista</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={(e) => update("nome", e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">E-mail (login do motorista)</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} className="mt-1" placeholder="motorista@empresa.com" />
              <p className="text-[10px] text-muted-foreground mt-1">
                O motorista deve usar este e-mail para acessar o sistema com perfil <strong>motorista</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">CNH</Label><Input value={form.cnh} onChange={(e) => update("cnh", e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Veículo</Label><Input value={form.veiculo} onChange={(e) => update("veiculo", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Placa</Label><Input value={form.placa} onChange={(e) => update("placa", e.target.value)} className="mt-1" /></div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cor no Quadro Logístico</Label>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {AUTO_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => update("cor", c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.cor || "#2563eb"} onChange={(e) => update("cor", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" title="Cor personalizada" />
                {form.cor && <span className="text-xs font-mono text-muted-foreground">{form.cor}</span>}
              </div>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={2} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}