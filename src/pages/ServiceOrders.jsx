import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck, MapPin, DollarSign, Filter, X, Calendar, RefreshCw, Tag, Hash } from "lucide-react";
import { format, parseISO, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

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
  if (period === "yesterday") { const y = format(subDays(now, 1), "yyyy-MM-dd"); return { from: y, to: y }; }
  if (period === "7d") return { from: format(subDays(now, 6), "yyyy-MM-dd"), to: TODAY };
  if (period === "30d") return { from: format(subDays(now, 29), "yyyy-MM-dd"), to: TODAY };
  if (period === "month") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: TODAY };
  return null;
}

export default function ServiceOrders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [quickPeriod, setQuickPeriod] = useState("today");
  const [dateFrom, setDateFrom] = useState(TODAY);
  const [dateTo, setDateTo] = useState(TODAY);
  const [enderecoFilter, setEnderecoFilter] = useState("");
  const [bairroFilter, setBairroFilter] = useState("");
  const [cidadeFilter, setCidadeFilter] = useState("");
  const [letraFilter, setLetraFilter] = useState("");
  const [etiquetaFilter, setEtiquetaFilter] = useState("");
  const [clientTags, setClientTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  // loading=false de imediato — página abre instantaneamente, dados chegam em background
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [allLoaded, setAllLoaded] = useState(false);
  const [buscaPorCodigo, setBuscaPorCodigo] = useState(false);
  const [clientCodigoMap, setClientCodigoMap] = useState({});
  const navigate = useNavigate();

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
    records.map(r => ({
      ...r,
      _codigo_resolvido: r.customer_code || resolveCode(r, map),
    })), [resolveCode]);

  useEffect(() => {
    const init = async () => {
      setDataLoading(true);
      // Carrega OS primeiro — exibe assim que chegar
      const rawOrders = await base44.entities.ServiceOrder.list("-created_date", 300);
      setOrders(rawOrders.map(r => ({ ...r, _codigo_resolvido: r.customer_code || "" })));
      setDataLoading(false);
      // Carrega clientes e tags em background para enriquecer dados
      Promise.all([
        base44.entities.Client.list("nome_razao_social", 5000).catch(() => []),
        base44.entities.ClientTag.list().catch(() => []),
      ]).then(([clients, tags]) => {
        setClientTags(tags);
        const map = buildClientMap(clients);
        setClientCodigoMap(map);
        setOrders(prev => enrichRecords(prev, map));
      });
    };
    init();
  }, []);

  const loadToday = async () => {
    setDataLoading(true);
    const data = await base44.entities.ServiceOrder.list("-created_date", 300);
    setOrders(enrichRecords(data, clientCodigoMap));
    setDataLoading(false);
  };

  const loadAll = async () => {
    setDataLoading(true);
    const [rawOrders, clients] = await Promise.all([
      base44.entities.ServiceOrder.list("-created_date", 2000),
      base44.entities.Client.list("nome_razao_social", 5000).catch(() => []),
    ]);
    const map = buildClientMap(clients);
    setClientCodigoMap(map);
    setOrders(enrichRecords(rawOrders, map));
    setAllLoaded(true);
    setDataLoading(false);
    setDateFrom("");
    setDateTo("");
    setQuickPeriod("");
  };

  const handleQuickPeriod = (period) => {
    setQuickPeriod(period);
    if (period !== "custom") {
      const dates = getPeriodDates(period);
      if (dates) { setDateFrom(dates.from); setDateTo(dates.to); }
    }
  };

  const hasActiveFilters = statusFilter !== "todos" || enderecoFilter || bairroFilter || cidadeFilter || letraFilter || etiquetaFilter;
  const hasDateFilters = dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter("todos"); setEnderecoFilter(""); setBairroFilter(""); setCidadeFilter(""); setLetraFilter(""); setEtiquetaFilter("");
  };

  const norm = useCallback((s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(), []);

  // Debounce nos campos de texto — evita filtrar a cada tecla
  const debouncedSearch = useDebounce(search, 250);
  const debouncedEndereco = useDebounce(enderecoFilter, 250);
  const debouncedBairro = useDebounce(bairroFilter, 250);
  const debouncedCidade = useDebounce(cidadeFilter, 250);
  const debouncedEtiqueta = useDebounce(etiquetaFilter, 250);

  // Memoiza filtro: só recalcula quando dependências mudam
  const filtered = useMemo(() => {
    const sq = norm(debouncedSearch);
    return orders.filter((o) => {
      const codigoDoCliente = o._codigo_resolvido || "";
      const matchSearch = !debouncedSearch || (
        buscaPorCodigo
          ? norm(codigoDoCliente).includes(sq)
          : [o.numero, o.client_nome, o.local_entrega, codigoDoCliente].filter(Boolean).some((f) => norm(f).includes(sq))
      );
      let matchStatus;
      if (statusFilter === "todos") matchStatus = true;
      else if (statusFilter === "finalizada_nao_paga") matchStatus = o.status === "finalizada" && (o.status_pagamento || "pendente") !== "pago";
      else matchStatus = o.status === statusFilter;

      let matchDate = true;
      const dataEntrega = o.data_entrega ? o.data_entrega.substring(0, 10) : null;
      if (dateFrom && dataEntrega) matchDate = matchDate && dataEntrega >= dateFrom;
      if (dateTo && dataEntrega) matchDate = matchDate && dataEntrega <= dateTo;

      const matchEndereco = !debouncedEndereco || norm(o.local_entrega).includes(norm(debouncedEndereco));
      const matchBairro = !debouncedBairro || norm(o.local_entrega).includes(norm(debouncedBairro));
      const matchCidade = !debouncedCidade || norm(o.local_entrega).includes(norm(debouncedCidade));
      const matchLetra = !letraFilter || norm(o.client_nome).startsWith(norm(letraFilter));
      const matchEtiqueta = !debouncedEtiqueta || (o.client_etiquetas || []).some(et => norm(et).includes(norm(debouncedEtiqueta)));

      return matchSearch && matchStatus && matchDate && matchEndereco && matchBairro && matchCidade && matchLetra && matchEtiqueta;
    });
  }, [orders, debouncedSearch, buscaPorCodigo, statusFilter, dateFrom, dateTo, debouncedEndereco, debouncedBairro, debouncedCidade, letraFilter, debouncedEtiqueta, norm]);

  return (
    <div>
      <PageHeader title="Ordens de Serviço" subtitle={`${orders.length} ordens carregadas`}>
        <Button variant="outline" onClick={loadAll} className="gap-2 hidden sm:flex">
          <RefreshCw className="w-4 h-4" /> {allLoaded ? "Recarregar todas" : "Carregar todas"}
        </Button>
        <Button onClick={() => navigate("/ordens-servico/nova")} className="gap-2">
          <Plus className="w-4 h-4" /> Nova OS
        </Button>
      </PageHeader>

      {!allLoaded && (
        <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Exibindo OS filtradas por data. Para ver todas, clique em <strong>"Carregar todas"</strong>.</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs text-blue-700" onClick={loadAll}>Carregar todas →</Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={buscaPorCodigo ? "Buscar por código do cliente (ex: 1024)..." : "Buscar por número, cliente, cód. cliente ou local..."}
            className="pl-10 bg-card border-0 shadow-sm"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className={cn("gap-2 shrink-0", (hasActiveFilters || hasDateFilters) && "border-primary text-primary")} onClick={() => setShowFilters(v => !v)}>
          <Filter className="w-4 h-4" /> Filtros {(hasActiveFilters || hasDateFilters) && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
      </div>

      {/* Checkbox busca por código */}
      <label className="inline-flex items-center gap-2 mb-3 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={buscaPorCodigo}
          onChange={e => { setBuscaPorCodigo(e.target.checked); }}
          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
        />
        <Hash className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          Buscar por código do cliente
        </span>
        {buscaPorCodigo && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">ativo</span>
        )}
      </label>

      {/* Períodos rápidos */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
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
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_transito">Em Trânsito</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="aguardando_recolha">Aguardando Recolha</SelectItem>
                  <SelectItem value="recolhida">Recolhida</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                  <SelectItem value="finalizada_nao_paga">Finalizada — Cobrança Pendente</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Endereço</p>
              <Input value={enderecoFilter} onChange={e => setEnderecoFilter(e.target.value)} className="h-8 text-xs" placeholder="Rua, número..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bairro</p>
              <Input value={bairroFilter} onChange={e => setBairroFilter(e.target.value)} className="h-8 text-xs" placeholder="Bairro..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cidade</p>
              <Input value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} className="h-8 text-xs" placeholder="Cidade..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filtrar por letra (A–Z)</p>
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
              <p className="text-xs text-muted-foreground mb-1">Etiqueta do cliente</p>
              <Input value={etiquetaFilter} onChange={e => setEtiquetaFilter(e.target.value)} className="h-8 text-xs" placeholder="Ex: VIP, Construtora..." />
            </div>
          </div>
          {(hasActiveFilters || hasDateFilters) && (
            <button onClick={clearFilters} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} OS encontrada(s)</p>

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
        {filtered.map((order) => (
          <Link key={order.id} to={`/ordens-servico/${order.id}`}>
            <Card className="border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                        #{order.numero} — {order.client_nome}
                        {order._codigo_resolvido && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">Cód. {order._codigo_resolvido}</span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{order.local_entrega}</span>
                      </div>
                      {order.data_entrega && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {order.hora_tipo === "periodo"
                            ? `${format(new Date(order.data_entrega.substring ? order.data_entrega.substring(0,10) : order.data_entrega), "dd/MM/yyyy")} — ${order.hora_periodo === "manha" ? "Manhã" : order.hora_periodo === "tarde" ? "Tarde" : order.hora_periodo === "noite" ? "Noite" : "Período"}`
                            : order.hora_tipo === "sem_horario"
                            ? `${format(new Date(order.data_entrega.substring ? order.data_entrega.substring(0,10) : order.data_entrega), "dd/MM/yyyy")} — Sem horário`
                            : format(new Date(order.data_entrega), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                      {(order.client_etiquetas || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.client_etiquetas.slice(0, 3).map((et, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                              <Tag className="w-2.5 h-2.5" />{et}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-sm flex items-center gap-1 justify-end">
                        <DollarSign className="w-3 h-3" />
                        R$ {(order.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <StatusBadge status={order.status_pagamento || "pendente"} className="mt-0.5" />
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      )}

      {!dataLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma ordem de serviço encontrada</p>
          {!allLoaded && (
            <Button variant="outline" className="mt-3 gap-2" onClick={loadAll}>
              <RefreshCw className="w-4 h-4" /> Carregar todas as OS
            </Button>
          )}
        </div>
      )}
    </div>
  );
}