import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientSearch from "../components/ClientSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, ImageIcon, FileDown, Search, X, ArrowRightCircle, AlertCircle, Calculator, Info, Tag, Calendar } from "lucide-react";
import AndaimeCalculator from "../components/andaime/AndaimeCalculator";
import AndaimeTubularCalculator from "../components/andaime/AndaimeTubularCalculator";
import EquipmentSearch from "../components/equipment/EquipmentSearch";
import { toast } from "sonner";
import { format, parseISO, addDays, isBefore, differenceInDays, startOfDay, endOfDay, startOfMonth, subDays } from "date-fns";
import { generateQuotePDF } from "../lib/generateQuotePDF";
import { useNavigate } from "react-router-dom";
import { calcItemOrcamento, calcTotalOrcamento } from "../lib/quoteCalc";

const EMPTY_QUOTE = {
  numero: "", client_id: "", client_nome: "", endereco_entrega: "",
  data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
  data_validade: format(addDays(new Date(), 7), "yyyy-MM-dd"),
  itens: [], frete: 0, valor_total: 0, observacoes: "", clausulas: "", status: "rascunho",
};

const STATUS_COLOR = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  recusado: "bg-red-100 text-red-700",
  expirado: "bg-slate-100 text-slate-500",
  arquivado: "bg-slate-200 text-slate-400",
};
const STATUS_LABEL = {
  rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado",
  recusado: "Recusado", expirado: "Expirado", arquivado: "Arquivado"
};

const TODAY = format(new Date(), "yyyy-MM-dd");

const QUICK_PERIODS = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "Este mês", value: "month" },
  { label: "Personalizado", value: "custom" },
];

function getPeriodDates(period) {
  const now = new Date();
  if (period === "today") return { from: TODAY, to: TODAY };
  if (period === "yesterday") {
    const y = format(subDays(now, 1), "yyyy-MM-dd");
    return { from: y, to: y };
  }
  if (period === "7d") return { from: format(subDays(now, 6), "yyyy-MM-dd"), to: TODAY };
  if (period === "30d") return { from: format(subDays(now, 29), "yyyy-MM-dd"), to: TODAY };
  if (period === "month") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: TODAY };
  return null;
}

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [settings, setSettings] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(EMPTY_QUOTE);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [quickPeriod, setQuickPeriod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showAndaimeCalc, setShowAndaimeCalc] = useState(false);
  const [showTubularCalc, setShowTubularCalc] = useState(false);

  const debounceRef = useRef(null);

  // Carrega apenas equipamentos e settings no início (não os orçamentos)
  useEffect(() => {
    Promise.all([
      base44.entities.Equipment.list(),
      base44.entities.CompanySettings.list().catch(() => [{}]),
    ]).then(([eqs, [s]]) => {
      setEquipment(eqs);
      if (s) setSettings(s);
    });
  }, []);

  const handleQuickPeriod = (period) => {
    setQuickPeriod(period);
    if (period !== "custom") {
      const dates = getPeriodDates(period);
      if (dates) { setDateFrom(dates.from); setDateTo(dates.to); }
    }
  };

  const doSearch = useCallback(async () => {
    setSearching(true);
    setHasSearched(true);
    const all = await base44.entities.Quote.list("-created_date", 500);

    // Arquivar expirados
    const today = new Date();
    const toArchive = all.filter(q => q.status !== "arquivado" && q.data_validade && isBefore(parseISO(q.data_validade), today));
    if (toArchive.length > 0) {
      await Promise.all(toArchive.map(q => base44.entities.Quote.update(q.id, { status: "arquivado" })));
    }

    // Filtragem local com normalização completa (sem acentos, case-insensitive)
    const norm = (v) => (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const s = norm(search);
    const filtered = all.filter(q => {
      const matchSearch = !s || [q.numero, q.client_nome, q.client_id]
        .filter(Boolean).some(f => norm(f).includes(s));
      const matchStatus = filterStatus === "todos" || q.status === filterStatus;
      let matchDate = true;
      const ref = q.created_date ? q.created_date.substring(0, 10) : null;
      if (dateFrom && ref) matchDate = matchDate && ref >= dateFrom;
      if (dateTo && ref) matchDate = matchDate && ref <= dateTo;
      return matchSearch && matchStatus && matchDate;
    });

    setQuotes(filtered);
    setSearching(false);
  }, [search, filterStatus, dateFrom, dateTo]);

  // Debounce no campo de busca
  const handleSearchInput = (val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length >= 2 || hasSearched) {
      debounceRef.current = setTimeout(() => doSearch(), 400);
    }
  };

  const getDias = () => {
    if (!form.data_inicio || !form.data_fim) return 0;
    return Math.max(0, differenceInDays(parseISO(form.data_fim), parseISO(form.data_inicio)));
  };

  useEffect(() => {
    const dias = getDias();
    const { totalComMinimo } = calcTotalOrcamento({ itens: form.itens, equipamentos: equipment, diasPeriodo: dias, settings });
    const totalFinal = totalComMinimo + (form.frete || 0);
    setForm(p => ({ ...p, valor_total: totalFinal }));
  }, [form.itens, form.frete, form.data_inicio, form.data_fim, equipment, settings]);

  const openNew = () => {
    setForm({ ...EMPTY_QUOTE, clausulas: "" });
    setEditId(null); setDialog(true);
  };

  const openEdit = (q) => {
    setForm({ ...EMPTY_QUOTE, ...q });
    setEditId(q.id); setDialog(true);
  };

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleClientSelect = (client) => {
    const addr = [client.endereco_entrega_rua, client.endereco_entrega_numero, client.endereco_entrega_bairro, client.endereco_entrega_cidade]
      .filter(Boolean).join(", ");
    setForm(p => ({ ...p, client_id: client.id, client_nome: client.nome_razao_social, endereco_entrega: addr || p.endereco_entrega }));
  };

  const applyAndaimeItens = (itensAndaime) => {
    const mapped = itensAndaime.map(i => ({
      equipamento_id: i.equipamento_id, equipamento_nome: i.equipamento_nome,
      quantidade: i.quantidade_retirada || i.quantidade || 1, valor_unitario: i.valor_diario || 0, desconto: 0,
    }));
    setForm(p => ({ ...p, itens: [...(p.itens || []), ...mapped] }));
    setShowAndaimeCalc(false);
    toast.success(`${mapped.length} itens de andaime adicionados!`);
  };

  const applyAndaimeTubularItens = (itensTubular, resumo) => {
    const mapped = itensTubular.map(i => ({
      equipamento_id: i.equipamento_id, equipamento_nome: i.equipamento_nome,
      quantidade: i.quantidade || i.quantidade_retirada || 1,
      valor_unitario: i.valor_diario || i.valor_unitario || 0, desconto: 0, descricao_extra: resumo || "",
    }));
    setForm(p => ({ ...p, itens: [...(p.itens || []), ...mapped] }));
    setShowTubularCalc(false);
    toast.success(`${mapped.length} itens de andaime tubular adicionados!`);
  };

  const removeItem = (i) => setForm(p => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const updateItem = (idx, field, val) => {
    setForm(p => {
      const itens = [...p.itens];
      itens[idx] = { ...itens[idx], [field]: val };
      if (field === "equipamento_id") {
        const eq = equipment.find(e => e.id === val);
        if (eq) { itens[idx].equipamento_nome = eq.nome; itens[idx].valor_unitario = eq.valor_diario || eq.valor_mensal || 0; itens[idx].desconto = 0; }
      }
      return { ...p, itens };
    });
  };

  const handleSave = async () => {
    if (!form.client_nome?.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    let data = { ...form };
    if (!data.numero) {
      const count = quotes.length + 1;
      data.numero = String(2000 + count);
    }
    if (editId) {
      await base44.entities.Quote.update(editId, data);
      toast.success("Orçamento atualizado!");
    } else {
      await base44.entities.Quote.create(data);
      toast.success(`Orçamento #${data.numero} criado!`);
    }
    setSaving(false); setDialog(false);
    if (hasSearched) doSearch();
  };

  const generatePDF = (q) => {
    const doc = generateQuotePDF({ quote: q, client: null, settings, equipment });
    doc.save(`orcamento_${q.numero}.pdf`);
    toast.success("PDF gerado!");
  };

  const convertToContract = (q) => {
    const params = new URLSearchParams({ from_quote: q.id, client_id: q.client_id || "", client_nome: q.client_nome || "" });
    navigate(`/contratos/novo?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch(""); setFilterStatus("todos"); setQuickPeriod(""); setDateFrom(""); setDateTo(""); setQuotes([]); setHasSearched(false);
  };

  const dias = getDias();
  const calcResult = calcTotalOrcamento({ itens: form.itens, equipamentos: equipment, diasPeriodo: dias, settings });
  const valorMinimoContrato = settings?.valor_minimo_contrato || 0;
  const hasFilters = search || filterStatus !== "todos" || dateFrom || dateTo;

  return (
    <div>
      <PageHeader title="Orçamentos" subtitle="Pesquise para visualizar os orçamentos">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Orçamento</Button>
      </PageHeader>

      {/* ÁREA DE PESQUISA */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4 space-y-3">
          {/* Linha 1: busca + status */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => handleSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
                placeholder="Buscar por cliente, código do cliente ou nº orçamento..."
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: períodos rápidos */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground shrink-0">Período:</span>
            {QUICK_PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => handleQuickPeriod(p.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  quickPeriod === p.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary hover:text-primary"
                }`}
              >{p.label}</button>
            ))}
          </div>

          {/* Datas personalizadas */}
          {quickPeriod === "custom" && (
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <p className="text-xs text-muted-foreground mb-1">De</p>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="text-xs text-muted-foreground mb-1">Até</p>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 pt-1">
            <Button onClick={doSearch} disabled={searching} className="gap-2 flex-1 sm:flex-none">
              <Search className="w-4 h-4" />
              {searching ? "Pesquisando..." : "Pesquisar"}
            </Button>
            {hasFilters && (
              <Button variant="outline" onClick={clearFilters} className="gap-1.5 text-xs">
                <X className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RESULTADOS */}
      {!hasSearched && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-base">Pesquise um orçamento para visualizar os resultados</p>
          <p className="text-sm mt-1">Use o campo acima para buscar por cliente, código ou número do orçamento</p>
        </div>
      )}

      {hasSearched && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {searching ? "Buscando..." : `${quotes.length} orçamento(s) encontrado(s)`}
          </p>
          <div className="space-y-3">
            {!searching && quotes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-semibold">Nenhum orçamento encontrado</p>
                <p className="text-sm mt-1">Tente outros termos ou ajuste os filtros</p>
              </div>
            )}
            {quotes.map(q => {
              const daysLeft = q.data_validade ? differenceInDays(parseISO(q.data_validade), new Date()) : null;
              return (
                <Card key={q.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(q)}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Orçamento #{q.numero} — {q.client_nome}</p>
                      <div className="flex flex-wrap gap-1 items-center mt-1">
                        <p className="text-xs text-muted-foreground">
                          Validade: {q.data_validade ? format(parseISO(q.data_validade), "dd/MM/yyyy") : "—"} · {q.itens?.length || 0} item(ns)
                        </p>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && !["arquivado", "aprovado"].includes(q.status) && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Vence em {daysLeft}d</span>
                        )}
                        {q.data_inicio && q.data_fim && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {format(parseISO(q.data_inicio), "dd/MM")} → {format(parseISO(q.data_fim), "dd/MM")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                      <p className="font-bold text-sm">R$ {(q.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={e => { e.stopPropagation(); generatePDF(q); }}>
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </Button>
                      {q.status === "aprovado" && (
                        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={e => { e.stopPropagation(); convertToContract(q); }}>
                          <ArrowRightCircle className="w-3.5 h-3.5" /> Converter
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* DIALOG: CRIAR/EDITAR */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar" : "Novo"} Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Cliente</Label>
                <div className="mt-1"><ClientSearch value={form.client_nome} onSelect={handleClientSelect} placeholder="Buscar cliente cadastrado..." /></div>
                {!form.client_id && (
                  <div className="mt-2">
                    <Input placeholder="Ou digite o nome do cliente manualmente..." value={form.client_nome} onChange={e => update("client_nome", e.target.value)} className="text-sm" />
                  </div>
                )}
                {form.client_nome && <p className="text-xs text-emerald-600 mt-1">✓ {form.client_nome}{form.client_id ? " (cadastrado)" : " (manual)"}</p>}
              </div>
              <div>
                <Label className="text-xs">Endereço de Entrega</Label>
                <Input value={form.endereco_entrega} onChange={e => update("endereco_entrega", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Validade</Label>
                <Input type="date" value={form.data_validade} onChange={e => update("data_validade", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data de Início da Locação</Label>
                <Input type="date" value={form.data_inicio} onChange={e => update("data_inicio", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data de Fim da Locação</Label>
                <Input type="date" value={form.data_fim} onChange={e => update("data_fim", e.target.value)} className="mt-1" />
              </div>
              {dias > 0 && (
                <div className="sm:col-span-2">
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 flex items-center gap-2 flex-wrap">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Período: <strong>{dias} dias</strong> de locação</span>
                    {calcResult.itensPorItens?.some(i => i.minimoAplicado) && (
                      <span className="text-amber-700 font-medium">· Dias mínimos aplicados em alguns itens</span>
                    )}
                    {calcResult.minimoContratoAplicado && (
                      <span className="text-red-700 font-medium">· Valor mínimo de contrato aplicado</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Card className="border-0 bg-muted/30">
              <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-heading">Equipamentos</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowAndaimeCalc(v => !v); setShowTubularCalc(false); }} className="gap-1 text-blue-700 border-blue-200 hover:bg-blue-50">
                    <Calculator className="w-3 h-3" /> Fachadeiro
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowTubularCalc(v => !v); setShowAndaimeCalc(false); }} className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                    <Calculator className="w-3 h-3" /> Tubular
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAndaimeCalc && <AndaimeCalculator equipment={equipment} settings={settings} diasPeriodo={dias} onApply={applyAndaimeItens} />}
                {showTubularCalc && <AndaimeTubularCalculator equipment={equipment} onApply={applyAndaimeTubularItens} />}
                <div>
                  <Label className="text-xs mb-1 block">Adicionar Equipamento</Label>
                  <EquipmentSearch equipment={equipment} settings={settings} onSelect={eq => {
                    setForm(p => ({ ...p, itens: [...(p.itens || []), { equipamento_id: eq.id, equipamento_nome: eq.nome, quantidade: 1, valor_unitario: eq.valor_diario || eq.valor_mensal || 0, desconto: 0 }] }));
                  }} />
                </div>

                {(form.itens || []).map((item, idx) => {
                  const eq = equipment.find(e => e.id === item.equipamento_id);
                  const regrasDesconto = settings?.regras_desconto_tempo || [];
                  const calc = calcItemOrcamento({ item, eq, diasPeriodo: dias, regrasDesconto });
                  return (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-border/40 space-y-2">
                      <div className="grid sm:grid-cols-6 gap-2 items-end">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Equipamento</Label>
                          <div className="mt-1 flex items-center gap-2 p-2 rounded-md border text-sm bg-muted/30">
                            {eq?.foto_url ? <img src={eq.foto_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className="flex-1 truncate font-medium">{item.equipamento_nome || "—"}</span>
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
                          </div>
                          {eq?.marca && <p className="text-[10px] text-muted-foreground mt-0.5">{eq.marca}{eq.modelo ? ` · ${eq.modelo}` : ""}</p>}
                        </div>
                        <div>
                          <Label className="text-xs">Qtd</Label>
                          <Input type="number" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", e.target.value === "" ? "" : Number(e.target.value))} onFocus={e => { if (e.target.value === "0") e.target.select(); }} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Vlr Unit./dia</Label>
                          <Input type="number" step="0.01" value={item.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", e.target.value === "" ? "" : Number(e.target.value))} onFocus={e => { if (e.target.value === "0") e.target.select(); }} className="mt-1" />
                          {calc.minimoAplicado && <p className="text-[10px] text-amber-600 mt-0.5">× {calc.diasEfetivos}d (mín.)</p>}
                          {!calc.minimoAplicado && dias > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">× {dias}d</p>}
                        </div>
                        <div>
                          <Label className="text-xs">Desconto (R$)</Label>
                          <Input type="number" step="0.01" value={item.desconto} onChange={e => updateItem(idx, "desconto", e.target.value === "" ? "" : Number(e.target.value))} onFocus={e => { if (e.target.value === "0") e.target.select(); }} className="mt-1" />
                          {calc.descontoAuto > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">+Auto R${calc.descontoAuto.toFixed(2)}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Subtotal</p>
                          <p className="font-semibold text-sm mt-1">R$ {calc.subtotal.toFixed(2)}</p>
                          {calc.valorBase !== calc.subtotal && <p className="text-[10px] text-muted-foreground line-through">R$ {calc.valorBase.toFixed(2)}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {calc.minimoAplicado && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                            <AlertCircle className="w-2.5 h-2.5" /> Mínimo {calc.diasEfetivos} dias aplicado
                          </span>
                        )}
                        {calc.descontoAuto > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                            <Tag className="w-2.5 h-2.5" /> Desconto automático: R$ {calc.descontoAuto.toFixed(2)}
                          </span>
                        )}
                        {eq?.aplica_desconto_automatico === false && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Sem desconto automático</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="mt-3 rounded-xl border bg-white p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Frete</Label>
                    <Input type="number" step="0.01" value={form.frete} onChange={e => update("frete", e.target.value === "" ? "" : Number(e.target.value))} onFocus={e => { if (e.target.value === "0") e.target.select(); }} className="w-32 text-right" />
                  </div>
                  <div className="pt-2 border-t space-y-1.5">
                    {calcResult.totalDiaria > 0 && (
                      <div className="flex justify-between text-sm font-medium text-blue-700">
                        <span>Valor da diária da locação:</span>
                        <span>R$ {calcResult.totalDiaria.toFixed(2)}/dia</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal equipamentos:</span>
                      <span>R$ {calcResult.totalEquipamentos.toFixed(2)}</span>
                    </div>
                    {calcResult.minimoContratoAplicado && (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1 text-red-700 font-medium">
                          <Info className="w-3.5 h-3.5" /> Valor mínimo de contrato:
                        </span>
                        <span className="text-red-700 font-medium">R$ {calcResult.valorMinimoContrato.toFixed(2)}</span>
                      </div>
                    )}
                    {(form.frete || 0) > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Frete:</span><span>R$ {(form.frete || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <p className="text-sm font-semibold">Total do Orçamento:</p>
                      <p className="text-xl font-bold font-heading">R$ {(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {calcResult.minimoContratoAplicado && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>O valor dos equipamentos (R$ {calcResult.totalEquipamentos.toFixed(2)}) está abaixo do valor mínimo de contrato (R$ {valorMinimoContrato.toFixed(2)}). O valor mínimo foi aplicado automaticamente.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <p className="font-semibold">📄 Cláusulas do orçamento</p>
              <p className="mt-0.5">As cláusulas são carregadas automaticamente das <strong>Configurações → Cláusulas → Orçamentos</strong>. Para personalizar, edite lá.</p>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={e => update("observacoes", e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Orçamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}