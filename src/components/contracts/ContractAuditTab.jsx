import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, User, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTION_COLORS = {
  "Criação": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Edição": "bg-blue-100 text-blue-700 border-blue-200",
  "Pagamento": "bg-purple-100 text-purple-700 border-purple-200",
  "Assinatura": "bg-amber-100 text-amber-700 border-amber-200",
  "Cancelamento": "bg-red-100 text-red-700 border-red-200",
  "Status": "bg-slate-100 text-slate-700 border-slate-200",
  "Cobrança": "bg-orange-100 text-orange-700 border-orange-200",
  "PDF": "bg-indigo-100 text-indigo-700 border-indigo-200",
};

function getColor(acao = "") {
  const key = Object.keys(ACTION_COLORS).find((k) => acao.toLowerCase().includes(k.toLowerCase()));
  return ACTION_COLORS[key] || "bg-muted text-muted-foreground border-border";
}

export default function ContractAuditTab({ contractId, contractNumero }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("todos");

  useEffect(() => {
    base44.entities.ActivityLog.filter({ referencia_id: contractId })
      .then((data) => {
        const sorted = [...data].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
        setLogs(sorted);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [contractId]);

  const actionTypes = ["todos", ...new Set(logs.map((l) => l.acao?.split(" ")[0] || "").filter(Boolean))];

  const filtered = logs.filter((l) => {
    const matchUser = !filterUser || (l.usuario || "").toLowerCase().includes(filterUser.toLowerCase());
    const matchType = filterType === "todos" || (l.acao || "").toLowerCase().includes(filterType.toLowerCase());
    return matchUser && matchType;
  });

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando histórico...</div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar por usuário..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((t) => (
              <SelectItem key={t} value={t}>{t === "todos" ? "Todos os tipos" : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhum evento registrado para este contrato.
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-4 pl-10">
          {filtered.map((log, i) => (
            <div key={log.id || i} className="relative">
              {/* Dot */}
              <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-background bg-primary shadow-sm" />
              <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getColor(log.acao)}`}>
                      {log.acao || "—"}
                    </span>
                    {log.usuario && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> {log.usuario}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.data_hora ? new Date(log.data_hora).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                {log.detalhes && (
                  <p className="text-xs text-muted-foreground mt-1">{log.detalhes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}