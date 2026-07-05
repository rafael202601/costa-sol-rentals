import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, Truck, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";

// Resumo visual dos itens de contratos na nota
function NoteItemsPreview({ note }) {
  const contratoItens = (note.itens || []).filter(i => i.tipo === "contrato");
  if (contratoItens.length === 0) return null;

  return (
    <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
      {contratoItens.map((item, idx) => {
        if (!item.descricao) return null;
        // Extrai "pago até" da descrição ou do campo pago_ate
        const descricao = item.descricao || "";
        // Resumo: mostrar só até 80 chars
        const resumo = descricao.length > 90 ? descricao.slice(0, 87) + "..." : descricao;
        return (
          <p key={idx} className="leading-tight">{resumo}</p>
        );
      })}
    </div>
  );
}
import BillingNoteDialog from "./BillingNoteDialog";
import BillingNoteDetailDialog from "./BillingNoteDetailDialog";

const statusConfig = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  parcial: { label: "Parcial", cls: "bg-blue-100 text-blue-700" },
  pago: { label: "Pago", cls: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-700 line-through" },
  vencido: { label: "Vencido", cls: "bg-orange-100 text-orange-700" },
};

const FORMAS_PAG = [
  { value: "todos", label: "Todas formas" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

const TIPOS_DOC = [
  { value: "todos", label: "Todos tipos doc" },
  { value: "nf", label: "NF" },
  { value: "nfe", label: "NFe" },
  { value: "boleto", label: "Boleto" },
  { value: "outros", label: "Outros" },
];

function calcStatusVencido(note) {
  if (note.status === "pago" || note.status === "cancelado") return note.status;
  if (note.data_vencimento) {
    const venc = parseISO(note.data_vencimento);
    if (isBefore(venc, startOfDay(new Date()))) return "vencido";
  }
  return note.status || "pendente";
}

export default function BillingNotesList({ client, contracts, orders, settings }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailNote, setDetailNote] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFormaPag, setFilterFormaPag] = useState("todos");
  const [filterTipoDoc, setFilterTipoDoc] = useState("todos");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterVencInicio, setFilterVencInicio] = useState("");
  const [filterVencFim, setFilterVencFim] = useState("");
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [filterContrato, setFilterContrato] = useState("");

  const loadNotes = () => {
    setLoading(true);
    base44.entities.BillingNote.filter({ client_id: client.id }, "-created_date", 200)
      .then(setNotes)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotes(); }, [client.id]);

  const activeFilterCount = [
    filterStatus !== "todos",
    filterFormaPag !== "todos",
    filterTipoDoc !== "todos",
    filterDataInicio,
    filterDataFim,
    filterVencInicio,
    filterVencFim,
    filterValorMin,
    filterValorMax,
    filterContrato,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus("todos");
    setFilterFormaPag("todos");
    setFilterTipoDoc("todos");
    setFilterDataInicio("");
    setFilterDataFim("");
    setFilterVencInicio("");
    setFilterVencFim("");
    setFilterValorMin("");
    setFilterValorMax("");
    setFilterContrato("");
    setSearch("");
  };

  const filtered = notes.filter((n) => {
    const statusCalc = calcStatusVencido(n);

    if (filterStatus !== "todos" && statusCalc !== filterStatus) return false;

    // Forma de pagamento: checa pagamentos registrados ou forma_pagamento
    if (filterFormaPag !== "todos") {
      const forma = (n.forma_pagamento || "").toLowerCase();
      const pagHasForma = (n.pagamentos || []).some(p => (p.forma || "").toLowerCase() === filterFormaPag);
      if (forma !== filterFormaPag && !pagHasForma) return false;
    }

    // Tipo de documento financeiro
    if (filterTipoDoc !== "todos") {
      const hasTipo = (n.documentos_financeiros || []).some(d => d.tipo === filterTipoDoc);
      if (!hasTipo) return false;
    }

    // Data criação
    if (filterDataInicio && n.created_date) {
      if (isBefore(parseISO(n.created_date), parseISO(filterDataInicio))) return false;
    }
    if (filterDataFim && n.created_date) {
      if (isAfter(parseISO(n.created_date), parseISO(filterDataFim + "T23:59:59"))) return false;
    }

    // Vencimento
    if (filterVencInicio && n.data_vencimento) {
      if (isBefore(parseISO(n.data_vencimento), parseISO(filterVencInicio))) return false;
    }
    if (filterVencFim && n.data_vencimento) {
      if (isAfter(parseISO(n.data_vencimento), parseISO(filterVencFim))) return false;
    }

    // Valor
    if (filterValorMin && (n.valor_final || 0) < parseFloat(filterValorMin)) return false;
    if (filterValorMax && (n.valor_final || 0) > parseFloat(filterValorMax)) return false;

    // Contrato/OS
    if (filterContrato) {
      const q = filterContrato.toLowerCase();
      const inContratos = (n.contratos_numeros || []).some(c => c.toLowerCase().includes(q));
      const inOS = (n.os_numeros || []).some(o => o.toLowerCase().includes(q));
      if (!inContratos && !inOS) return false;
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      if (
        !n.numero?.toLowerCase().includes(q) &&
        !(n.contratos_numeros || []).join(" ").toLowerCase().includes(q) &&
        !(n.os_numeros || []).join(" ").toLowerCase().includes(q)
      ) return false;
    }

    return true;
  });

  // Summary
  const totalFiltrado = filtered.reduce((s, n) => s + (n.valor_final || 0), 0);
  const totalAberto = filtered.filter(n => ["pendente","parcial","vencido"].includes(calcStatusVencido(n))).reduce((s, n) => s + (n.saldo_aberto || 0), 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nota, contrato, OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 h-9 ${showFilters ? "bg-primary/5 border-primary/40" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 font-bold">{activeFilterCount}</span>
            )}
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9 text-xs text-muted-foreground">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nova Cobrança
        </Button>
      </div>

      {/* Filtros avançados */}
      {showFilters && (
        <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros Avançados</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Forma de pagamento */}
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={filterFormaPag} onValueChange={setFilterFormaPag}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAG.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de documento */}
            <div>
              <Label className="text-xs">Tipo de Documento</Label>
              <Select value={filterTipoDoc} onValueChange={setFilterTipoDoc}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Contrato/OS */}
            <div>
              <Label className="text-xs">Contrato / OS nº</Label>
              <Input
                value={filterContrato}
                onChange={(e) => setFilterContrato(e.target.value)}
                placeholder="Ex: 1042"
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Data criação */}
            <div>
              <Label className="text-xs">Criação — De</Label>
              <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Criação — Até</Label>
              <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>

            {/* Vencimento */}
            <div>
              <Label className="text-xs">Vencimento — De</Label>
              <Input type="date" value={filterVencInicio} onChange={(e) => setFilterVencInicio(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Vencimento — Até</Label>
              <Input type="date" value={filterVencFim} onChange={(e) => setFilterVencFim(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>

            {/* Valor */}
            <div>
              <Label className="text-xs">Valor mínimo (R$)</Label>
              <Input type="number" value={filterValorMin} onChange={(e) => setFilterValorMin(e.target.value)} placeholder="0,00" className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Valor máximo (R$)</Label>
              <Input type="number" value={filterValorMax} onChange={(e) => setFilterValorMax(e.target.value)} placeholder="9999,00" className="mt-1 h-8 text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
            {filtered.length} nota{filtered.length !== 1 ? "s" : ""}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            Total: R$ {totalFiltrado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          {totalAberto > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              Em aberto: R$ {totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="font-medium">Nenhuma cobrança encontrada</p>
          <p className="text-xs mt-1">{notes.length > 0 ? "Ajuste os filtros ou " : ""}Clique em "Nova Cobrança" para registrar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => {
            const statusCalc = calcStatusVencido(note);
            const st = statusConfig[statusCalc] || statusConfig.pendente;
            const docsFinanceiros = note.documentos_financeiros || [];
            const temNF = docsFinanceiros.some(d => d.tipo === "nf" || d.tipo === "nfe");
            const temBoleto = docsFinanceiros.some(d => d.tipo === "boleto");
            return (
              <div
                key={note.id}
                onClick={() => setDetailNote(note)}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">Nota #{note.numero || "—"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">{note.tipo}</span>
                      {temNF && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">NF</span>}
                      {temBoleto && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">Boleto</span>}
                      {note.forma_pagamento && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium uppercase">{note.forma_pagamento}</span>
                      )}
                    </div>
                    <NoteItemsPreview note={note} />
                    <div className="flex gap-3 flex-wrap text-xs text-muted-foreground mt-0.5">
                      {note.created_date && <span>{format(parseISO(note.created_date), "dd/MM/yyyy")}</span>}
                      {note.data_vencimento && (
                        <span className={statusCalc === "vencido" ? "text-orange-600 font-medium" : ""}>
                          Venc: {format(parseISO(note.data_vencimento), "dd/MM/yyyy")}
                        </span>
                      )}
                      {(note.os_numeros || []).length > 0 && (
                        <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> OS {note.os_numeros.map(n => `#${n}`).join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold text-sm">R$ {(note.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  {note.saldo_aberto > 0 && note.status !== "cancelado" && (
                    <p className="text-xs text-destructive">Saldo: R$ {note.saldo_aberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <BillingNoteDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          client={client}
          contracts={contracts}
          orders={orders}
          settings={settings}
          onCreated={(note) => { setCreateOpen(false); loadNotes(); setDetailNote(note); }}
        />
      )}

      {detailNote && (
        <BillingNoteDetailDialog
          open={!!detailNote}
          note={detailNote}
          client={client}
          settings={settings}
          onClose={() => { setDetailNote(null); loadNotes(); }}
          onUpdated={(updated) => { setDetailNote(updated); loadNotes(); }}
        />
      )}
    </div>
  );
}