import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Search } from "lucide-react";
import { format } from "date-fns";

const MODULE_COLOR = {
  contrato: "bg-blue-100 text-blue-700",
  os: "bg-amber-100 text-amber-700",
  cliente: "bg-purple-100 text-purple-700",
  financeiro: "bg-emerald-100 text-emerald-700",
  equipamento: "bg-slate-100 text-slate-600",
  motorista: "bg-cyan-100 text-cyan-700",
  orcamento: "bg-orange-100 text-orange-700",
};
const MODULE_LABEL = { contrato: "Contrato", os: "OS", cliente: "Cliente", financeiro: "Financeiro", equipamento: "Equipamento", motorista: "Motorista", orcamento: "Orçamento" };

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modulo, setModulo] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [usuarioFilter, setUsuarioFilter] = useState("todos");

  useEffect(() => {
    base44.entities.ActivityLog.list("-data_hora", 500).then((l) => { setLogs(l); setLoading(false); });
  }, []);

  const usuarios = [...new Set(logs.map((l) => l.usuario).filter(Boolean))];

  const filtered = logs.filter((l) => {
    if (modulo !== "todos" && l.modulo !== modulo) return false;
    if (usuarioFilter !== "todos" && l.usuario !== usuarioFilter) return false;
    if (search && !l.acao?.toLowerCase().includes(search.toLowerCase()) && !l.usuario?.toLowerCase().includes(search.toLowerCase()) && !l.referencia_numero?.includes(search)) return false;
    if (dateFrom && l.data_hora && l.data_hora.slice(0, 10) < dateFrom) return false;
    if (dateTo && l.data_hora && l.data_hora.slice(0, 10) > dateTo) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Log de Atividades" subtitle="Auditoria completa do sistema" />

      <div className="flex gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ação, usuário ou referência..." className="pl-9" />
        </div>
        <Select value={modulo} onValueChange={setModulo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            {Object.entries(MODULE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Usuário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos usuários</SelectItem>
            {usuarios.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="De" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="Até" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">{filtered.length} registro(s)</p>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto opacity-20 mb-3" />
          <p className="font-semibold">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${MODULE_COLOR[log.modulo]?.replace("text-", "bg-").replace(/\s.*/, "") || "bg-muted"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${MODULE_COLOR[log.modulo] || "bg-muted text-muted-foreground"}`}>{MODULE_LABEL[log.modulo] || log.modulo}</span>
                    <p className="text-sm font-medium truncate">{log.acao}</p>
                    {log.referencia_numero && <span className="text-xs text-muted-foreground">#{log.referencia_numero}</span>}
                  </div>
                  {log.detalhes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.detalhes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{log.usuario}</p>
                  <p className="text-[10px] text-muted-foreground">{log.data_hora ? format(new Date(log.data_hora), "dd/MM HH:mm") : "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}