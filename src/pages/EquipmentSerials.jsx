import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Hash, History, Package, Wrench, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  disponivel: { label: "Disponível",  className: "bg-emerald-100 text-emerald-700" },
  alugado:    { label: "Alugado",     className: "bg-blue-100 text-blue-700" },
  manutencao: { label: "Manutenção",  className: "bg-amber-100 text-amber-700" },
  avariado:   { label: "Avariado",    className: "bg-red-100 text-red-700" },
  perdido:    { label: "Perdido",     className: "bg-gray-100 text-gray-700" },
  reservado:  { label: "Reservado",   className: "bg-purple-100 text-purple-700" },
};

const PAGE_SIZE = 50;

export default function EquipmentSerials() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);


  const debounceRef = useRef(null);
  const equipmentCacheRef = useRef(null);


  // Load equipment once (cached)
  const getEquipment = useCallback(async () => {
    if (equipmentCacheRef.current) return equipmentCacheRef.current;
    const data = await base44.entities.Equipment.list("-nome", 1000);
    const filtered = data.filter(e => e.controle_individual && (e.numeracoes || []).length > 0);
    equipmentCacheRef.current = filtered;
    return filtered;
  }, []);

  const runSearch = useCallback(async (term, status) => {
    setLoading(true);
    setHasSearched(true);
    setPage(1);

    const equipment = await getEquipment();
    const q = term.toLowerCase().trim();

    const allSerials = equipment.flatMap((eq) =>
      (eq.numeracoes || []).map((n) => ({
        ...n,
        equipamento_nome: eq.nome,
        equipamento_id: eq.id,
        equipamento_foto: eq.foto_url,
        equipamento_codigo: eq.codigo || "",
      }))
    );

    const filtered = allSerials.filter((s) => {
      const matchStatus = status === "todos" || s.status === status;
      if (!matchStatus) return false;
      if (!q) return true;

      return (
        (s.serial || "").toLowerCase().includes(q) ||
        (s.equipamento_nome || "").toLowerCase().includes(q) ||
        (s.equipamento_codigo || "").toLowerCase().includes(q) ||
        (s.contrato_numero || "").toLowerCase().includes(q) ||
        (s.contrato_id || "").toLowerCase().includes(q) ||
        // search historico for client/contract/OS info
        (s.historico || []).some(h =>
          (h.contrato_numero || "").toLowerCase().includes(q) ||
          (h.evento || "").toLowerCase().includes(q) ||
          (h.observacao || "").toLowerCase().includes(q)
        )
      );
    });

    setResults(filtered);
    setLoading(false);
  }, [getEquipment]);

  // Debounce search on text change
  useEffect(() => {
    if (!search && statusFilter === "todos") return; // don't auto-search if both are default
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(search, statusFilter);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, statusFilter, runSearch]);

  // When only status filter changes (and no search term), still run
  const handleStatusChange = (val) => {
    setStatusFilter(val);
    if (hasSearched || search) {
      clearTimeout(debounceRef.current);
      runSearch(search, val);
    }
  };

  const paginated = results.slice(0, page * PAGE_SIZE);
  const hasMore = results.length > paginated.length;

  // Corrige um serial individual preso — força status para "disponível"
  const fixSerial = async (serial) => {
    try {
      const allEquip = await base44.entities.Equipment.list("-nome", 1000);
      const eq = allEquip.find(e =>
        e.controle_individual && (e.numeracoes || []).some(n => n.serial === serial.serial)
      );
      if (!eq) { toast.error("Equipamento não encontrado"); return; }

      const agora = format(new Date(), "dd/MM/yyyy HH:mm");
      const novasNumeracoes = (eq.numeracoes || []).map(n => {
        if (n.serial !== serial.serial) return n;
        return {
          ...n,
          status: "disponivel",
          contrato_id: "",
          contrato_numero: "",
          os_id: "",
          historico: [
            ...(n.historico || []),
            {
              data: agora,
              evento: "Liberação manual (correção)",
              contrato_numero: n.contrato_numero || "",
              usuario: "Admin",
              observacao: "Serial liberado manualmente via painel de seriais",
            },
          ],
        };
      });

      const disponiveis = novasNumeracoes.filter(n => n.status === "disponivel").length;
      const alugados = novasNumeracoes.filter(n => n.status === "alugado").length;
      await base44.entities.Equipment.update(eq.id, {
        numeracoes: novasNumeracoes,
        quantidade_disponivel: disponiveis,
        quantidade_alugada: alugados,
        status_item: alugados === 0 ? "disponivel" : "alugado",
      });

      toast.success(`Serial ${serial.serial} liberado com sucesso!`);
      // Limpa cache e re-busca
      equipmentCacheRef.current = null;
      runSearch(search, statusFilter);
    } catch (e) {
      toast.error(`Erro ao corrigir serial: ${e.message}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Numerações Individuais"
        subtitle="Consulte seriais e numerações por equipamento, contrato ou status"
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serial, equipamento, contrato, OS, código..."
            className="pl-10 bg-card border-0 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-0 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Initial state — not searched yet */}
      {!hasSearched && (
        <div className="text-center py-20 text-muted-foreground">
          <Hash className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-foreground/60">Digite para pesquisar seriais ou numerações</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            Busque por serial, equipamento, código, contrato ou status para encontrar rapidamente o que precisa.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* No results */}
      {hasSearched && !loading && results.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum serial encontrado</p>
          <p className="text-sm mt-1">Tente outros termos ou ajuste o filtro de status.</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {results.length} serial(is) encontrado(s){results.length > PAGE_SIZE ? ` — exibindo ${paginated.length}` : ""}
          </p>

          <div className="space-y-2">
            {paginated.map((s, i) => {
              const ultimaMovimentacao = s.historico?.length > 0
                ? s.historico[s.historico.length - 1]
                : null;
              return (
                <Card key={i} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-3">
                      {s.equipamento_foto ? (
                        <img src={s.equipamento_foto} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{s.serial}</span>
                          <Badge className={cn("text-[10px]", STATUS_CONFIG[s.status]?.className)}>
                            {STATUS_CONFIG[s.status]?.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.equipamento_nome}</p>
                        {ultimaMovimentacao && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                            <History className="w-3 h-3 shrink-0" />
                            <span className="shrink-0">{ultimaMovimentacao.data}</span>
                            <span className="font-medium text-foreground/70">{ultimaMovimentacao.evento}</span>
                            {ultimaMovimentacao.contrato_numero && (
                              <span className="text-blue-600">— Contrato #{ultimaMovimentacao.contrato_numero}</span>
                            )}
                            {ultimaMovimentacao.usuario && (
                              <span>— por {ultimaMovimentacao.usuario}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {s.status === "alugado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => fixSerial(s)}
                        >
                          <Wrench className="w-3 h-3" /> Liberar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={() => setPage(p => p + 1)}
                className="text-sm text-primary hover:underline font-medium"
              >
                Carregar mais ({results.length - paginated.length} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}