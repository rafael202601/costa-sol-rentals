import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Calendar, DollarSign, Filter, X, MapPin, Package, Wrench, Upload, RefreshCw, Tag, Hash, ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInDays, parseISO, format, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import ContractImportModal from "../components/contracts/ContractImportModal";

// ─── Cache de sessão: mantém filtros e página ao navegar ─────────────────────
const SESSION_KEY = "contracts_list_state";
function saveSession(state) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
}
function loadSession() {
  try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ─── Normalização ─────────────────────────────────────────────────────────────
function norm(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// ─── Alert de prazo ───────────────────────────────────────────────────────────
function getAlertClass(contract) {
  if (["finalizado", "cancelado"].includes(contract.status) || !contract.data_prevista_termino) return "";
  const daysLeft = differenceInDays(parseISO(contract.data_prevista_termino), new Date());
  if (daysLeft < 0) return "ring-2 ring-red-400 bg-red-50/50";
  if (daysLeft <= 2) return "ring-2 ring-amber-400 bg-amber-50/50";
  return "";
}

const TODAY = format(new Date(), "yyyy-MM-dd");
const PAGE_SIZE = 25;

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
  if (period === "yesterday") { const y = format(subDays(now, 1), "yyyy-MM-dd"); return { from: y, to: y }; }
  if (period === "7d") return { from: format(subDays(now, 6), "yyyy-MM-dd"), to: TODAY };
  if (period === "30d") return { from: format(subDays(now, 29), "yyyy-MM-dd"), to: TODAY };
  if (period === "month") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: TODAY };
  return null;
}

// ─── Card memoizado: só re-renderiza se o contrato mudar ─────────────────────
const ContractCard = ({ contract }) => {
  const alertClass = getAlertClass(contract);
  return (
    <Link to={`/contratos/${contract.id}`}>
      <Card className={cn("border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer", alertClass)}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                  #{contract.numero} — {contract.client_nome}
                  {contract._codigo_resolvido && (
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                      Cód. {contract._codigo_resolvido}
                    </span>
                  )}
                  {contract.tipo_entrega === "retirada_loja" && (
                    <span className="text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      🏪 Retirada Loja
                    </span>
                  )}
                </p>
                {(contract.endereco_entrega || contract.obra_endereco) && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{contract.endereco_entrega || contract.obra_endereco}</span>
                  </p>
                )}
                {contract.obra_nome && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wrench className="w-3 h-3 shrink-0" />
                    Obra: <span className="font-medium text-foreground">{contract.obra_nome}</span>
                  </p>
                )}
                {(contract.itens || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {contract.itens.slice(0, 3).map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full border">
                        <Package className="w-2.5 h-2.5" />
                        {item.quantidade_retirada || 1}x {item.equipamento_nome}
                      </span>
                    ))}
                    {contract.itens.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{contract.itens.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {contract.data_inicio && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {(() => {
                        try {
                          const d = parseISO(contract.data_inicio);
                          if (isNaN(d)) return "—";
                          const dStr = format(d, "dd/MM/yyyy");
                          return ["na_obra", "em_transito", "aguardando_recolha", "devolvido_parcial", "devolvido_pendente", "finalizado"].includes(contract.status)
                            ? `Entrega: ${dStr}`
                            : `Solicitação: ${dStr}`;
                        } catch { return "—"; }
                      })()}
                    </span>
                  )}
                  {contract.data_prevista_termino && (
                    <span>→ {(() => {
                      try {
                        const d = parseISO(contract.data_prevista_termino);
                        return isNaN(d) ? "—" : format(d, "dd/MM/yyyy");
                      } catch { return "—"; }
                    })()}</span>
                  )}
                </div>
                {(contract.client_etiquetas || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contract.client_etiquetas.slice(0, 4).map((et, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                        <Tag className="w-2.5 h-2.5" />{et}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto sm:ml-0 shrink-0">
              <div className="text-right">
                <p className="font-bold text-sm flex items-center gap-1 justify-end">
                  <DollarSign className="w-3 h-3" />
                  R$ {(contract.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <StatusBadge status={contract.status_financeiro || "pendente"} className="mt-0.5" />
              </div>
              <StatusBadge status={contract.status} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

// ─── Debounce simples inline (sem dependência externa) ────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Contracts() {
  const navigate = useNavigate();

  // ─── Restaura estado da sessão ──────────────────────────────────────────────
  const session = useRef(loadSession());
  const s = session.current || {};

  const [contracts, setContracts] = useState([]);
  const [search, setSearch] = useState(s.search ?? "");
  const [statusFilter, setStatusFilter] = useState(s.statusFilter ?? "todos");
  const [quickPeriod, setQuickPeriod] = useState(s.quickPeriod ?? "today");
  const [dateFrom, setDateFrom] = useState(s.dateFrom ?? TODAY);
  const [dateTo, setDateTo] = useState(s.dateTo ?? TODAY);
  const [letraFilter, setLetraFilter] = useState(s.letraFilter ?? "");
  const [obraFilter, setObraFilter] = useState(s.obraFilter ?? "");
  const [enderecoFilter, setEnderecoFilter] = useState(s.enderecoFilter ?? "");
  const [bairroFilter, setBairroFilter] = useState(s.bairroFilter ?? "");
  const [cidadeFilter, setCidadeFilter] = useState(s.cidadeFilter ?? "");
  const [equipamentoFilter, setEquipamentoFilter] = useState(s.equipamentoFilter ?? "");
  const [etiquetaFilter, setEtiquetaFilter] = useState(s.etiquetaFilter ?? "");
  const [tipoEntregaFilter, setTipoEntregaFilter] = useState(s.tipoEntregaFilter ?? "todos");
  const [buscaPorCodigo, setBuscaPorCodigo] = useState(s.buscaPorCodigo ?? false);
  const [page, setPage] = useState(s.page ?? 1);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // loading=false de imediato — página abre instantaneamente, dados chegam em background
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [allLoaded, setAllLoaded] = useState(false);
  const [clientCodigoMap, setClientCodigoMap] = useState({});

  // ─── Persiste filtros na sessão ─────────────────────────────────────────────
  useEffect(() => {
    saveSession({ search, statusFilter, quickPeriod, dateFrom, dateTo, letraFilter, obraFilter, enderecoFilter, bairroFilter, cidadeFilter, equipamentoFilter, etiquetaFilter, tipoEntregaFilter, buscaPorCodigo, page });
  }, [search, statusFilter, quickPeriod, dateFrom, dateTo, letraFilter, obraFilter, enderecoFilter, bairroFilter, cidadeFilter, equipamentoFilter, etiquetaFilter, tipoEntregaFilter, buscaPorCodigo, page]);

  // ─── Mapa de clientes: carregado uma vez, somente campos necessários ─────────
  const buildClientMap = useCallback((clients) => {
    const map = {};
    clients.forEach(cl => {
      if (!cl.codigo_cliente) return;
      const code = cl.codigo_cliente;
      if (cl.id) map[cl.id] = code;
      if (cl.external_id) {
        map[cl.external_id] = code;
        map[String(parseInt(cl.external_id, 10))] = code;
      }
      map[String(code)] = code;
      const nomeNorm = (cl.nome_razao_social || "").toLowerCase().trim();
      if (nomeNorm) map[nomeNorm] = code;
    });
    return map;
  }, []);

  const resolveCode = useCallback((record, map) => {
    if (record.client_codigo) return record.client_codigo;
    if (record.codigo_cliente) return record.codigo_cliente;
    if (record.client_id && map[record.client_id]) return map[record.client_id];
    if (record.client_external_id && map[record.client_external_id]) return map[record.client_external_id];
    if (record.client_id) {
      const asNum = String(parseInt(record.client_id, 10));
      if (map[asNum]) return map[asNum];
    }
    const nomeNorm = (record.client_nome || "").toLowerCase().trim();
    if (nomeNorm && map[nomeNorm]) return map[nomeNorm];
    return "";
  }, []);

  const enrichRecords = useCallback((records, map) =>
    records.map(r => ({ ...r, _codigo_resolvido: r.customer_code || resolveCode(r, map) })),
  [resolveCode]);

  // ─── Carga inicial: página abre imediatamente, dados chegam em background ─────
  useEffect(() => {
    const init = async () => {
      setDataLoading(true);
      // Carrega contratos primeiro (mais rápido) — exibe assim que chegar
      const rawContracts = await base44.entities.Contract.list("-created_date", 300);
      setContracts(rawContracts.map(r => ({ ...r, _codigo_resolvido: r.customer_code || "" })));
      setDataLoading(false);
      // Depois carrega clientes em background para enriquecer os códigos
      base44.entities.Client.list("nome_razao_social", 5000).catch(() => []).then(clients => {
        const map = buildClientMap(clients);
        setClientCodigoMap(map);
        setContracts(prev => enrichRecords(prev, map));
      });
    };
    init();
  }, []);

  const loadToday = async () => {
    setDataLoading(true);
    const data = await base44.entities.Contract.list("-created_date", 300);
    setContracts(enrichRecords(data, clientCodigoMap));
    setDataLoading(false);
  };

  const loadAll = async () => {
    setDataLoading(true);
    const [rawContracts, clients] = await Promise.all([
      base44.entities.Contract.list("-created_date", 2000),
      base44.entities.Client.list("nome_razao_social", 5000).catch(() => []),
    ]);
    const map = buildClientMap(clients);
    setClientCodigoMap(map);
    setContracts(enrichRecords(rawContracts, map));
    setAllLoaded(true);
    setDataLoading(false);
    setDateFrom("");
    setDateTo("");
    setQuickPeriod("");
    setPage(1);
  };

  const handleQuickPeriod = (period) => {
    setQuickPeriod(period);
    setPage(1);
    if (period !== "custom") {
      const dates = getPeriodDates(period);
      if (dates) { setDateFrom(dates.from); setDateTo(dates.to); }
    }
  };

  const hasActiveFilters = statusFilter !== "todos" || tipoEntregaFilter !== "todos" || letraFilter || obraFilter || enderecoFilter || bairroFilter || cidadeFilter || equipamentoFilter || etiquetaFilter;
  const hasDateFilters = dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter("todos"); setTipoEntregaFilter("todos"); setLetraFilter(""); setObraFilter("");
    setEnderecoFilter(""); setBairroFilter(""); setCidadeFilter(""); setEquipamentoFilter(""); setEtiquetaFilter("");
    setPage(1);
  };

  // ─── Debounce nos campos de texto ────────────────────────────────────────────
  const debouncedSearch     = useDebounce(search, 250);
  const debouncedObra       = useDebounce(obraFilter, 250);
  const debouncedEndereco   = useDebounce(enderecoFilter, 250);
  const debouncedBairro     = useDebounce(bairroFilter, 250);
  const debouncedCidade     = useDebounce(cidadeFilter, 250);
  const debouncedEquipamento= useDebounce(equipamentoFilter, 250);
  const debouncedEtiqueta   = useDebounce(etiquetaFilter, 250);

  // Reset página quando filtros mudam
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, letraFilter, dateFrom, dateTo, debouncedObra, debouncedEndereco, debouncedBairro, debouncedCidade, debouncedEquipamento, debouncedEtiqueta, tipoEntregaFilter, buscaPorCodigo]);

  // ─── Filtro memoizado ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const sq = norm(debouncedSearch);
    return contracts.filter((c) => {
      const codigoDoCliente = c._codigo_resolvido || "";
      const matchSearch = !debouncedSearch || (
        buscaPorCodigo
          ? norm(codigoDoCliente).includes(sq)
          : [c.numero, c.client_nome, codigoDoCliente].filter(Boolean).some((f) => norm(f).includes(sq))
      );
      const matchStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchLetra = !letraFilter || norm(c.client_nome).startsWith(norm(letraFilter));
      let matchDate = true;
      if (dateFrom && c.data_inicio) matchDate = matchDate && c.data_inicio >= dateFrom;
      if (dateTo && c.data_inicio) matchDate = matchDate && c.data_inicio <= dateTo;
      const matchObra = !debouncedObra || norm(c.obra_nome).includes(norm(debouncedObra));
      const matchEndereco = !debouncedEndereco || norm(c.endereco_entrega || c.obra_endereco).includes(norm(debouncedEndereco));
      const matchBairro = !debouncedBairro || norm(c.endereco_entrega || c.obra_endereco).includes(norm(debouncedBairro));
      const matchCidade = !debouncedCidade || norm(c.endereco_entrega || c.obra_endereco).includes(norm(debouncedCidade));
      const matchEquipamento = !debouncedEquipamento || (c.itens || []).some(it => norm(it.equipamento_nome).includes(norm(debouncedEquipamento)));
      const matchEtiqueta = !debouncedEtiqueta || (c.client_etiquetas || []).some(et => norm(et).includes(norm(debouncedEtiqueta)));
      const matchTipoEntrega = tipoEntregaFilter === "todos" || (tipoEntregaFilter === "entrega" ? c.tipo_entrega !== "retirada_loja" : c.tipo_entrega === "retirada_loja");
      return matchSearch && matchStatus && matchTipoEntrega && matchLetra && matchDate && matchObra && matchEndereco && matchBairro && matchCidade && matchEquipamento && matchEtiqueta;
    });
  }, [contracts, debouncedSearch, buscaPorCodigo, statusFilter, letraFilter, dateFrom, dateTo, debouncedObra, debouncedEndereco, debouncedBairro, debouncedCidade, debouncedEquipamento, debouncedEtiqueta, tipoEntregaFilter]);

  // ─── Paginação: só renderiza PAGE_SIZE cards por vez ─────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <div>
      <PageHeader title="Contratos" subtitle={`${contracts.length} contratos carregados`}>
        <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2 hidden sm:flex">
          <Upload className="w-4 h-4" /> Importar CSV
        </Button>
        <Button variant="outline" onClick={loadAll} className="gap-2 hidden sm:flex" title="Carregar todos os contratos">
          <RefreshCw className="w-4 h-4" /> {allLoaded ? "Recarregar todos" : "Carregar todos"}
        </Button>
        <Button onClick={() => navigate("/contratos/novo")} className="gap-2 hidden sm:flex">
          <Plus className="w-4 h-4" /> Novo Contrato
        </Button>
      </PageHeader>

      <ContractImportModal open={showImport} onClose={() => setShowImport(false)} onDone={() => loadToday()} />

      {!allLoaded && (
        <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Exibindo contratos filtrados por data. Para ver todos, clique em <strong>"Carregar todos"</strong>.</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs text-blue-700" onClick={loadAll}>Carregar todos →</Button>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={buscaPorCodigo ? "Buscar por código do cliente (ex: 1024)..." : "Buscar por número, cliente ou cód. cliente..."}
            className="pl-10 bg-card border-0 shadow-sm"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className={cn("gap-2 shrink-0", (hasActiveFilters || hasDateFilters) && "border-primary text-primary")} onClick={() => setShowFilters((v) => !v)}>
          <Filter className="w-4 h-4" /> Filtros {(hasActiveFilters || hasDateFilters) && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
        <Button onClick={() => navigate("/contratos/novo")} className="gap-2 sm:hidden"><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {/* Checkbox busca por código */}
      <label className="inline-flex items-center gap-2 mb-3 cursor-pointer select-none group">
        <input type="checkbox" checked={buscaPorCodigo} onChange={e => setBuscaPorCodigo(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-primary cursor-pointer" />
        <Hash className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Buscar por código do cliente</span>
        {buscaPorCodigo && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">ativo</span>}
      </label>

      {/* Períodos rápidos */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className="text-xs text-muted-foreground shrink-0">Período:</span>
        {QUICK_PERIODS.map(p => (
          <button key={p.value} onClick={() => handleQuickPeriod(p.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              quickPeriod === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary hover:text-primary"
            }`}
          >{p.label}</button>
        ))}
        {quickPeriod === "custom" && (
          <div className="flex gap-2 flex-wrap mt-1 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">De</span>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-36" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Até</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-36" />
            </div>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="bg-card border-0 shadow-sm rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipo de Atendimento</p>
              <Select value={tipoEntregaFilter} onValueChange={setTipoEntregaFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="retirada_loja">Retirada na Loja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="em_transito">Em Trânsito</SelectItem>
                  <SelectItem value="na_obra">Na Obra</SelectItem>
                  <SelectItem value="aguardando_recolha">Ag. Recolha</SelectItem>
                  <SelectItem value="devolvido_parcial">Dev. Parcial</SelectItem>
                  <SelectItem value="devolvido_pendente">Dev. Pendente</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filtrar por letra</p>
              <Select value={letraFilter || "todos"} onValueChange={(v) => setLetraFilter(v === "todos" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="A–Z" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Obra</p>
              <Input value={obraFilter} onChange={(e) => setObraFilter(e.target.value)} className="h-8 text-xs" placeholder="Nome da obra..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Endereço</p>
              <Input value={enderecoFilter} onChange={(e) => setEnderecoFilter(e.target.value)} className="h-8 text-xs" placeholder="Rua, número..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bairro</p>
              <Input value={bairroFilter} onChange={(e) => setBairroFilter(e.target.value)} className="h-8 text-xs" placeholder="Bairro..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cidade</p>
              <Input value={cidadeFilter} onChange={(e) => setCidadeFilter(e.target.value)} className="h-8 text-xs" placeholder="Cidade..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Equipamento</p>
              <Input value={equipamentoFilter} onChange={(e) => setEquipamentoFilter(e.target.value)} className="h-8 text-xs" placeholder="Nome do equipamento..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Etiqueta do cliente</p>
              <Input value={etiquetaFilter} onChange={(e) => setEtiquetaFilter(e.target.value)} className="h-8 text-xs" placeholder="Ex: VIP, Imobiliária..." />
            </div>
          </div>
          {(hasActiveFilters || hasDateFilters) && (
            <button onClick={clearFilters} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Contador + paginação topo */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} contrato(s) encontrado(s)
          {totalPages > 1 && ` · página ${safePage} de ${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">{safePage}/{totalPages}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Lista de contratos — apenas PAGE_SIZE itens por vez */}
      {dataLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="rounded-xl bg-card shadow-sm p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/5" />
                  <div className="h-3 bg-muted rounded w-3/5" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="space-y-2 text-right shrink-0">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-5 bg-muted rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum contrato encontrado</p>
          {!allLoaded && (
            <Button variant="outline" className="mt-3 gap-2" onClick={loadAll}>
              <RefreshCw className="w-4 h-4" /> Carregar todos os contratos
            </Button>
          )}
        </div>
      )}

      {/* Paginação rodapé */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => { setPage(1); window.scrollTo(0, 0); }}>
            Primeira
          </Button>
          <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0); }}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">{safePage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}>
            Próxima <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => { setPage(totalPages); window.scrollTo(0, 0); }}>
            Última
          </Button>
        </div>
      )}
    </div>
  );
}