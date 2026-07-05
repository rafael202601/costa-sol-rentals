import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, ShoppingCart, Check, X, Download, Pencil, Calendar, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { generateSalePDF } from "../lib/generateSalePDF";
import { format, subDays, startOfMonth } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "personalizado", label: "Período personalizado" },
];

function getPeriodDates(period) {
  const t = today();
  if (period === "hoje") return { from: t, to: t };
  if (period === "ontem") { const d = format(subDays(new Date(), 1), "yyyy-MM-dd"); return { from: d, to: d }; }
  if (period === "7dias") return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: t };
  if (period === "30dias") return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: t };
  if (period === "mes") return { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: t };
  return null;
}

const STATUS_COLOR = {
  aguardando_aprovacao: "bg-amber-100 text-amber-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-700",
};
const STATUS_LABEL = {
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  cancelado: "Cancelado",
};
const PGTO_COLOR = {
  pago: "bg-emerald-100 text-emerald-700",
  parcial: "bg-blue-100 text-blue-700",
  nao_pago: "bg-red-100 text-red-700",
  pendente: "bg-muted text-muted-foreground",
};
const PGTO_LABEL = {
  pago: "Pago",
  parcial: "Parcial",
  nao_pago: "Não Pago",
  pendente: "Pendente",
};
const FORMA_LABEL = {
  dinheiro: "Dinheiro", pix: "PIX",
  cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito", boleto: "Boleto",
  a_prazo: "A Prazo / Fiado"
};

const EMPTY_SALE = {
  client_id: "", client_nome: "", client_cpf_cnpj: "",
  itens: [], subtotal: 0, desconto_tipo: "reais", desconto_valor: 0,
  total: 0, forma_pagamento: "pix", valor_pago: 0, saldo_pendente: 0, troco: 0,
  observacoes: "", status: "aguardando_aprovacao", status_pagamento: "pendente"
};

// Campos de busca de cliente
const SEARCH_FIELDS = [
  { value: "todos", label: "Todos" },
  { value: "nome_razao_social", label: "Nome" },
  { value: "cpf_cnpj", label: "CPF/CNPJ" },
  { value: "codigo_cliente", label: "Código" },
  { value: "external_id", label: "ID Externo" },
  { value: "telefone1", label: "Telefone" },
  { value: "endereco_entrega_cidade", label: "Cidade" },
];

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [company, setCompany] = useState({});
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_SALE);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [showProdResults, setShowProdResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [period, setPeriod] = useState("hoje");
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());

  // Client search state
  const [clientSearch, setClientSearch] = useState("");
  const [clientField, setClientField] = useState("todos");
  const [clientResults, setClientResults] = useState([]);
  const [showClientResults, setShowClientResults] = useState(false);
  const [clientSearching, setClientSearching] = useState(false);
  const clientSearchTimeout = useRef(null);
  const clientDropdownRef = useRef(null);

  const loadSales = useCallback(async (p = period, cf = customFrom, ct = customTo) => {
    setLoading(true);
    const dates = p === "personalizado" ? { from: cf, to: ct } : getPeriodDates(p);
    // Fetch all and filter client-side by date (created_date)
    const all = await base44.entities.Sale.list("-created_date", 500);
    const filtered = dates ? all.filter(s => {
      const d = (s.created_date || "").slice(0, 10);
      return d >= dates.from && d <= dates.to;
    }) : all;
    setSales(filtered);
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    loadSales();
    base44.entities.Product.filter({ ativo: true }).then(setProducts);
    base44.entities.CompanySettings.list().then(l => setCompany(l[0] || {}));
  }, []);

  const handlePeriodChange = (val) => {
    setPeriod(val);
    if (val !== "personalizado") loadSales(val, customFrom, customTo);
  };

  const handleCustomSearch = () => loadSales("personalizado", customFrom, customTo);

  // Click outside to close client results
  useEffect(() => {
    const handler = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Client search with debounce — uses fast mode in searchClients backend
  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      setShowClientResults(false);
      return;
    }
    clearTimeout(clientSearchTimeout.current);
    clientSearchTimeout.current = setTimeout(async () => {
      setClientSearching(true);
      try {
        const res = await base44.functions.invoke("searchClients", {
          fast: true,
          query: clientSearch,
          field: clientField,
          limit: 20,
        });
        const list = res?.data?.clients || [];
        setClientResults(list);
        setShowClientResults(true);
      } catch {
        setClientResults([]);
      }
      setClientSearching(false);
    }, 300);
  }, [clientSearch, clientField]);

  const selectClient = (c) => {
    setForm(p => ({
      ...p,
      client_id: c.id,
      client_nome: c.nome_razao_social || "",
      client_cpf_cnpj: c.cpf_cnpj || "",
    }));
    setClientSearch(c.nome_razao_social || "");
    setShowClientResults(false);
  };

  const clearClient = () => {
    setForm(p => ({ ...p, client_id: "", client_nome: "", client_cpf_cnpj: "" }));
    setClientSearch("");
  };

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const calcTotals = (itens, descontoTipo, descontoValor) => {
    const sub = itens.reduce((s, i) => s + (i.total || 0), 0);
    const desc = descontoTipo === "percentual" ? sub * (descontoValor / 100) : descontoValor;
    return { subtotal: sub, total: Math.max(0, sub - desc) };
  };

  const addItem = (prod) => {
    const item = {
      produto_id: prod.id, produto_nome: prod.nome,
      codigo: prod.codigo, quantidade: 1,
      valor_unitario: prod.valor_venda,
      custo_unitario: prod.custo || 0,
      total: prod.valor_venda,
      lucro: prod.valor_venda - (prod.custo || 0),
    };
    const itens = [...form.itens, item];
    const { subtotal, total } = calcTotals(itens, form.desconto_tipo, form.desconto_valor);
    setForm(p => ({ ...p, itens, subtotal, total }));
    setProdSearch(""); setShowProdResults(false);
  };

  const updateItem = (i, field, val) => {
    const itens = form.itens.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      if (field === "quantidade" || field === "valor_unitario") {
        updated.total = updated.quantidade * updated.valor_unitario;
        updated.lucro = updated.total - (updated.custo_unitario || 0) * updated.quantidade;
      }
      return updated;
    });
    const { subtotal, total } = calcTotals(itens, form.desconto_tipo, form.desconto_valor);
    setForm(p => ({ ...p, itens, subtotal, total }));
  };

  const removeItem = (i) => {
    const itens = form.itens.filter((_, idx) => idx !== i);
    const { subtotal, total } = calcTotals(itens, form.desconto_tipo, form.desconto_valor);
    setForm(p => ({ ...p, itens, subtotal, total }));
  };

  const updateDesconto = (tipo, valor) => {
    const { subtotal, total } = calcTotals(form.itens, tipo, valor);
    setForm(p => ({ ...p, desconto_tipo: tipo, desconto_valor: valor, subtotal, total }));
  };

  const updatePago = (val) => {
    const troco = form.forma_pagamento === "dinheiro" ? Math.max(0, val - form.total) : 0;
    setForm(p => ({ ...p, valor_pago: val, troco }));
  };

  const getNextNumber = async () => {
    const all = await base44.entities.Sale.list("-created_date", 1);
    if (all.length === 0) return "V-0001";
    const last = all[0].numero || "V-0000";
    const num = parseInt(last.replace(/\D/g, "")) + 1;
    return `V-${String(num).padStart(4, "0")}`;
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_SALE);
    setClientSearch("");
    setOpen(true);
  };

  const openEdit = (sale) => {
    setEditingId(sale.id);
    setForm({ ...sale });
    setClientSearch(sale.client_nome || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.client_nome) return toast.error("Informe o cliente");
    if (form.itens.length === 0) return toast.error("Adicione ao menos um produto");
    setSaving(true);
    const user = await base44.auth.me();

    if (editingId) {
      // Editing existing pending sale
      await base44.entities.Sale.update(editingId, {
        ...form,
        editado_por: user?.email || "",
      });
      toast.success("Venda atualizada!");
    } else {
      const numero = await getNextNumber();
      const saleData = { ...form, numero, criado_por: user?.email || "" };
      await base44.entities.Sale.create(saleData);
      toast.success("Venda registrada! Aguardando aprovação financeira.");
    }

    setSaving(false);
    setOpen(false);
    setForm(EMPTY_SALE);
    setEditingId(null);
    loadSales();
  };

  const handleApprove = async (sale) => {
    const hoje = new Date().toISOString().split("T")[0];

    // Baixar estoque
    for (const item of sale.itens || []) {
      if (item.produto_id) {
        const prods = await base44.entities.Product.filter({ id: item.produto_id });
        if (prods.length > 0) {
          const p = prods[0];
          await base44.entities.Product.update(p.id, {
            estoque_atual: Math.max(0, (p.estoque_atual || 0) - (item.quantidade || 1))
          });
        }
      }
    }

    const totalVenda = sale.total || 0;
    const valorPagoAgora = sale.valor_pago || 0;
    const saldoPendente = Math.max(0, totalVenda - valorPagoAgora);

    // Determina status de pagamento
    let statusPagamento = "nao_pago";
    if (saldoPendente <= 0) statusPagamento = "pago";
    else if (valorPagoAgora > 0) statusPagamento = "parcial";

    await base44.entities.Sale.update(sale.id, {
      status: "aprovado",
      status_pagamento: statusPagamento,
      saldo_pendente: saldoPendente,
      data_aprovacao: hoje,
    });

    const agora = new Date();
    const horaAgora = format(agora, "HH:mm");

    // Lançar no caixa somente o valor efetivamente recebido
    if (valorPagoAgora > 0) {
      await base44.entities.CashEntry.create({
        tipo: "receita",
        categoria: "Venda Balcão",
        descricao: `Venda nº ${sale.numero} — ${sale.client_nome}`,
        valor: valorPagoAgora,
        forma_pagamento: sale.forma_pagamento,
        data: hoje,
        hora: horaAgora,
        origem: "venda",
        origem_id: sale.id,
        origem_numero: sale.numero,
        client_nome: sale.client_nome,
        status: "confirmado",
      });
    }

    // Se há saldo pendente, criar conta a receber e marcar pendência no cliente
    if (saldoPendente > 0 && sale.client_id) {
      await base44.entities.CashEntry.create({
        tipo: "receita",
        categoria: "Conta a Receber — Venda",
        descricao: `Saldo Venda nº ${sale.numero} — ${sale.client_nome}`,
        valor: saldoPendente,
        forma_pagamento: sale.forma_pagamento,
        data: hoje,
        hora: horaAgora,
        origem: "venda",
        origem_id: sale.id,
        origem_numero: sale.numero,
        client_nome: sale.client_nome,
        status: "pendente",
      });
      await base44.entities.Client.update(sale.client_id, { pendencia_financeira: true });
    }

    const msg = saldoPendente > 0
      ? `Venda aprovada! Saldo de R$ ${saldoPendente.toFixed(2)} lançado como conta a receber.`
      : "Venda aprovada! Estoque baixado e lançada no caixa.";
    toast.success(msg);
    loadSales();
  };

  const handleCancel = async (sale) => {
    await base44.entities.Sale.update(sale.id, { status: "cancelado" });
    toast.success("Venda cancelada.");
    loadSales();
  };

  const filteredSales = sales.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (s.client_nome || "").toLowerCase().includes(q) ||
      (s.numero || "").toLowerCase().includes(q) ||
      (s.criado_por || "").toLowerCase().includes(q) ||
      (s.forma_pagamento || "").toLowerCase().includes(q) ||
      (s.itens || []).some(it => (it.produto_nome || "").toLowerCase().includes(q) || (it.codigo || "").toLowerCase().includes(q));
    let matchStatus = true;
    if (filterStatus === "pgto_pago") matchStatus = s.status_pagamento === "pago";
    else if (filterStatus === "pgto_parcial") matchStatus = s.status_pagamento === "parcial";
    else if (filterStatus === "pgto_nao_pago") matchStatus = s.status_pagamento === "nao_pago";
    else matchStatus = filterStatus === "todos" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const prodFiltered = products.filter(p =>
    `${p.nome} ${p.codigo}`.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 8);

  const isApproved = form.status === "aprovado" || form.status === "cancelado";

  return (
    <div>
      <PageHeader title="Vendas — Balcão" subtitle="PDV simples integrado ao financeiro">
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />Nova Venda
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-2">
        {/* Período */}
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-44 bg-card border-0 shadow-sm">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Datas personalizadas */}
        {period === "personalizado" && (
          <div className="flex gap-2 items-center flex-wrap">
            <Input type="date" className="w-36 bg-card border-0 shadow-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" className="w-36 bg-card border-0 shadow-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            <Button size="sm" onClick={handleCustomSearch}>Buscar</Button>
          </div>
        )}

        {/* Busca */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-0 shadow-sm" placeholder="Buscar cliente, nº, produto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Status */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 bg-card border-0 shadow-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="pgto_pago">💚 Pago</SelectItem>
            <SelectItem value="pgto_parcial">🔵 Parcial</SelectItem>
            <SelectItem value="pgto_nao_pago">🔴 Não Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Indicador de período */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">
          {loading ? "Carregando..." : `${filteredSales.length} venda(s) — ${PERIOD_OPTIONS.find(o => o.value === period)?.label || "período selecionado"}`}
        </span>
        {loading && <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin" />}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filteredSales.map(s => {
          const saldoPendente = s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0));
          const statusPgto = s.status_pagamento || (s.status === "aprovado" && saldoPendente <= 0 ? "pago" : "pendente");
          return (
          <Card key={s.id} className={`border-0 shadow-sm ${statusPgto === "nao_pago" && s.status === "aprovado" ? "border-l-4 border-l-red-400" : ""}`}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                  {s.status === "aprovado" && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PGTO_COLOR[statusPgto] || "bg-muted text-muted-foreground"}`}>
                      {PGTO_LABEL[statusPgto] || statusPgto}
                    </span>
                  )}
                  {s.nota_vinculada_numero && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      Nota #{s.nota_vinculada_numero}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{s.client_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {(s.itens || []).length} produto(s) · {FORMA_LABEL[s.forma_pagamento] || s.forma_pagamento}
                  {s.created_date ? ` · ${format(new Date(s.created_date), "dd/MM/yyyy HH:mm")}` : ""}
                </p>
                {statusPgto === "parcial" && saldoPendente > 0 && (
                  <p className="text-xs text-amber-700 font-semibold mt-0.5">
                    ⚠ Saldo pendente: R$ {saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
                {statusPgto === "nao_pago" && s.status === "aprovado" && (
                  <p className="text-xs text-red-600 font-semibold mt-0.5">
                    ⛔ Não pago — R$ {saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em aberto
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-primary text-base">R$ {Number(s.total || 0).toFixed(2)}</span>
                {s.status === "aprovado" && (
                  <Button variant="outline" size="sm" onClick={() => generateSalePDF(s, company)} className="gap-1">
                    <Download className="w-3.5 h-3.5" />PDF
                  </Button>
                )}
                {s.status === "aguardando_aprovacao" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="gap-1">
                      <Pencil className="w-3.5 h-3.5" />Editar
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(s)} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Check className="w-3.5 h-3.5" />Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCancel(s)} className="gap-1 text-red-500 border-red-200 hover:bg-red-50">
                      <X className="w-3.5 h-3.5" />Cancelar
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
        {filteredSales.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma venda encontrada</p>
          </div>
        )}
      </div>

      {/* Modal nova/editar venda */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {editingId ? "Editar Venda" : "Nova Venda — Balcão"}
            </DialogTitle>
          </DialogHeader>

          {isApproved && (
            <div className="p-3 rounded-xl bg-muted border text-xs text-muted-foreground">
              🔒 Esta venda já foi {form.status === "aprovado" ? "aprovada" : "cancelada"} e não pode ser editada.
            </div>
          )}

          <div className="space-y-4">
            {/* Cliente com busca avançada */}
            <div>
              <Label className="text-xs">Cliente *</Label>
              {form.client_id ? (
                <div className="mt-1 flex gap-2 items-center p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="flex-1 text-sm font-medium text-emerald-800">{form.client_nome}</span>
                  {form.client_cpf_cnpj && <span className="text-xs text-emerald-600">{form.client_cpf_cnpj}</span>}
                  {!isApproved && (
                    <button onClick={clearClient} className="p-1 hover:bg-emerald-100 rounded">
                      <X className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}
                </div>
              ) : (
                <div ref={clientDropdownRef} className="mt-1 relative">
                  <div className="flex gap-2">
                    <Select value={clientField} onValueChange={setClientField}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEARCH_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Buscar cliente cadastrado..."
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                        onFocus={() => clientResults.length > 0 && setShowClientResults(true)}
                        disabled={isApproved}
                      />
                    </div>
                  </div>
                  {(showClientResults && clientResults.length > 0) || clientSearching ? (
                    <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                      {clientSearching && (
                        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                          <span className="inline-block w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
                          Buscando...
                        </div>
                      )}
                      {!clientSearching && clientResults.map(c => (
                        <button key={c.id} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 text-sm text-left gap-2"
                          onClick={() => selectClient(c)}>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{c.nome_razao_social}</p>
                            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                              {c.codigo_cliente && <span>Cód: {c.codigo_cliente}</span>}
                              {c.external_id && <span>ID: {c.external_id}</span>}
                              {c.cpf_cnpj && <span>{c.cpf_cnpj}</span>}
                              {c.endereco_entrega_cidade && <span>{c.endereco_entrega_cidade}</span>}
                            </p>
                          </div>
                          {c.bloqueado && <span className="text-xs text-red-500 shrink-0">⛔</span>}
                        </button>
                      ))}
                      {!clientSearching && clientResults.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
                      )}
                    </div>
                  ) : null}
                  {/* Nome manual quando não selecionou cliente */}
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Ou digitar nome manualmente</Label>
                    <Input
                      className="mt-1"
                      placeholder="Nome do cliente (manual)"
                      value={form.client_nome}
                      onChange={e => setForm(p => ({ ...p, client_nome: e.target.value, client_id: "" }))}
                      disabled={isApproved}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">CPF/CNPJ (opcional)</Label>
              <Input value={form.client_cpf_cnpj} onChange={e => f("client_cpf_cnpj", e.target.value)} className="mt-1" disabled={isApproved} />
            </div>

            {/* Busca produto */}
            {!isApproved && (
              <div>
                <Label className="text-xs">Adicionar Produto</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar produto..."
                    value={prodSearch}
                    onChange={e => { setProdSearch(e.target.value); setShowProdResults(true); }}
                    onFocus={() => setShowProdResults(true)}
                  />
                  {showProdResults && prodSearch && prodFiltered.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {prodFiltered.map(p => (
                        <button key={p.id} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 text-sm"
                          onClick={() => addItem(p)}>
                          <span>{p.nome} {p.codigo ? `(${p.codigo})` : ""}</span>
                          <span className="font-semibold text-primary">R$ {Number(p.valor_venda).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Itens */}
            {form.itens.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 p-2 bg-muted/40 text-xs font-semibold">
                  <span>Produto</span><span>Qtd</span><span>Unit.</span><span>Total</span>
                  <span className="text-emerald-700">Lucro</span><span></span>
                </div>
                {form.itens.map((item, i) => {
                  const lucroItem = (item.total || 0) - (item.custo_unitario || 0) * (item.quantidade || 1);
                  return (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 p-2 border-t items-center">
                      <span className="text-sm truncate">{item.produto_nome}</span>
                      <Input type="number" min="1" value={item.quantidade}
                        onChange={e => updateItem(i, "quantidade", Number(e.target.value))}
                        className="h-7 text-xs px-2" disabled={isApproved} />
                      <Input type="number" step="0.01" value={item.valor_unitario}
                        onChange={e => updateItem(i, "valor_unitario", Number(e.target.value))}
                        className="h-7 text-xs px-2" disabled={isApproved} />
                      <span className="text-sm font-medium">R$ {Number(item.total).toFixed(2)}</span>
                      <span className={`text-xs font-medium ${lucroItem >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        R$ {lucroItem.toFixed(2)}
                      </span>
                      {!isApproved && (
                        <button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {form.itens.length > 0 && (
                  <div className="p-2 border-t bg-emerald-50/50 flex justify-end gap-4 text-xs">
                    <span className="text-muted-foreground">Custo total: <strong className="text-amber-700">
                      R$ {form.itens.reduce((s, it) => s + (it.custo_unitario || 0) * (it.quantidade || 1), 0).toFixed(2)}
                    </strong></span>
                    <span className="text-muted-foreground">Lucro total: <strong className="text-emerald-700">
                      R$ {form.itens.reduce((s, it) => s + ((it.total || 0) - (it.custo_unitario || 0) * (it.quantidade || 1)), 0).toFixed(2)}
                    </strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Desconto e totais */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Desconto</Label>
                <div className="flex gap-1 mt-1">
                  <Select value={form.desconto_tipo} onValueChange={v => updateDesconto(v, form.desconto_valor)} disabled={isApproved}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reais">R$</SelectItem>
                      <SelectItem value="percentual">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={form.desconto_valor}
                    onChange={e => updateDesconto(form.desconto_tipo, Number(e.target.value))} disabled={isApproved} />
                </div>
              </div>
              <div className="flex flex-col gap-1 justify-end text-right">
                <p className="text-xs text-muted-foreground">Subtotal: <strong>R$ {Number(form.subtotal || 0).toFixed(2)}</strong></p>
                <p className="text-base font-bold text-primary">Total: R$ {Number(form.total || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => f("forma_pagamento", v)} disabled={isApproved}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="a_prazo">A Prazo / Fiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor Pago Agora (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.valor_pago}
                  onChange={e => updatePago(Number(e.target.value))} className="mt-1" disabled={isApproved}
                  placeholder={`Total: ${Number(form.total || 0).toFixed(2)}`} />
                {form.troco > 0 && form.forma_pagamento === "dinheiro" && (
                  <p className="text-xs text-emerald-600 mt-1 font-semibold">Troco: R$ {Number(form.troco).toFixed(2)}</p>
                )}
                {(() => {
                  const saldo = Math.max(0, (form.total || 0) - (form.valor_pago || 0));
                  return saldo > 0 ? (
                    <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ Saldo pendente: R$ {saldo.toFixed(2)}</p>
                  ) : null;
                })()}
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={e => f("observacoes", e.target.value)} rows={2} className="mt-1 text-sm" disabled={isApproved} />
            </div>

            {!isApproved && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                ⚠️ A venda será enviada para <strong>aprovação no financeiro</strong>. Após aprovação, o estoque é baixado e lançado no caixa.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Fechar</Button>
              {!isApproved && (
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Registrar Venda"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}