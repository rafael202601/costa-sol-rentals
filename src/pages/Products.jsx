import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Package, AlertTriangle, Barcode, ScanLine } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  nome: "", codigo: "", codigo_barras: "", categoria: "", marca: "", modelo: "",
  custo: 0, margem: 0,
  valor_venda: 0, estoque_atual: 0, estoque_minimo: 0,
  unidade: "un", descricao: "", ativo: true
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const barcodeInputRef = useState(null);

  // Suporte a leitor USB/Bluetooth (age como teclado — Enter ao final)
  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter" && form.codigo_barras) {
      const found = products.find(p => p.codigo_barras === form.codigo_barras || p.codigo === form.codigo_barras);
      if (found) { openEdit(found); toast.success(`Produto encontrado: ${found.nome}`); }
      else toast.warning("Nenhum produto com este código de barras");
    }
  };

  const load = () => base44.entities.Product.list("-created_date").then(setProducts);
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    `${p.nome} ${p.codigo} ${p.codigo_barras || ""} ${p.categoria}`.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p }); setEditId(p.id); setOpen(true); };

  const handleSave = async () => {
    if (!form.nome) return toast.error("Nome é obrigatório");
    setSaving(true);
    if (editId) {
      await base44.entities.Product.update(editId, form);
      toast.success("Produto atualizado!");
    } else {
      await base44.entities.Product.create(form);
      toast.success("Produto criado!");
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  return (
    <div>
      <PageHeader title="Produtos" subtitle="Cadastro de produtos para venda balcão">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Novo Produto</Button>
      </PageHeader>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, código ou cód. barras..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative w-52">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Ler código de barras..."
            value={form.codigo_barras || ""}
            onChange={e => f("codigo_barras", e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
            title="Cole ou leia o código de barras — pressione Enter para buscar"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className={`border-0 shadow-sm ${!p.ativo ? "opacity-60" : ""}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{p.nome}</p>
                  {p.codigo && <p className="text-xs text-muted-foreground">Cód: {p.codigo}</p>}
                  {p.codigo_barras && <p className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Barcode className="w-3 h-3" />{p.codigo_barras}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.categoria && <Badge variant="outline" className="text-xs">{p.categoria}</Badge>}
                <Badge variant="outline" className="text-xs">{p.unidade || "un"}</Badge>
                {!p.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={`text-sm font-medium ${p.estoque_atual <= (p.estoque_minimo || 0) ? "text-red-500" : ""}`}>
                    {p.estoque_atual ?? 0} {p.unidade || "un"}
                  </span>
                  {p.estoque_atual <= (p.estoque_minimo || 0) && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary text-sm block">
                    R$ {Number(p.valor_venda || 0).toFixed(2)}
                  </span>
                  {p.custo > 0 && (
                    <span className="text-[10px] text-emerald-600">
                      Lucro: R$ {(p.valor_venda - p.custo).toFixed(2)} ({p.margem ? p.margem.toFixed(1) : "—"}%)
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => f("nome", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Código Interno</Label>
                <Input value={form.codigo} onChange={e => f("codigo", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Barcode className="w-3 h-3" /> Código de Barras (EAN/UPC/Code128)</Label>
                <Input
                  value={form.codigo_barras || ""}
                  onChange={e => f("codigo_barras", e.target.value)}
                  className="mt-1 font-mono"
                  placeholder="Cole ou use leitor..."
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Input value={form.categoria} onChange={e => f("categoria", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Marca</Label>
                <Input value={form.marca} onChange={e => f("marca", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Input value={form.modelo} onChange={e => f("modelo", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Custo (R$)</Label>
                <Input type="number" step="0.01" value={form.custo || 0}
                  onChange={e => {
                    const custo = Number(e.target.value);
                    const margem = form.margem || 0;
                    const valor_venda = margem > 0 ? custo + custo * margem / 100 : form.valor_venda;
                    setForm(p => ({ ...p, custo, valor_venda: margem > 0 ? Number(valor_venda.toFixed(2)) : p.valor_venda }));
                  }} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Margem (%)</Label>
                <Input type="number" step="0.1" value={form.margem || 0}
                  onChange={e => {
                    const margem = Number(e.target.value);
                    const custo = form.custo || 0;
                    const valor_venda = custo > 0 ? custo + custo * margem / 100 : form.valor_venda;
                    setForm(p => ({ ...p, margem, valor_venda: custo > 0 ? Number(valor_venda.toFixed(2)) : p.valor_venda }));
                  }} className="mt-1" />
                {(form.custo > 0 || form.margem > 0) && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Lucro unit.: R$ {((form.valor_venda || 0) - (form.custo || 0)).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Valor de Venda (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_venda}
                  onChange={e => {
                    const valor_venda = Number(e.target.value);
                    const custo = form.custo || 0;
                    const margem = custo > 0 ? ((valor_venda - custo) / custo) * 100 : form.margem;
                    setForm(p => ({ ...p, valor_venda, margem: Number(margem.toFixed(2)) }));
                  }} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unidade} onValueChange={v => f("unidade", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["un","m²","m","kg","l","cx","pç","par"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estoque Atual</Label>
                <Input type="number" value={form.estoque_atual} onChange={e => f("estoque_atual", Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Estoque Mínimo</Label>
                <Input type="number" value={form.estoque_minimo} onChange={e => f("estoque_minimo", Number(e.target.value))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.descricao} onChange={e => f("descricao", e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
              <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                <Label className="text-sm">Produto ativo</Label>
                <Switch checked={!!form.ativo} onCheckedChange={v => f("ativo", v)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}