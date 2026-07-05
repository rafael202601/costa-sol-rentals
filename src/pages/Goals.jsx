import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Target, TrendingUp, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const DESPESAS_KEY = "metas_despesas";
const METAS_KEY = "metas_aquisicoes";

export default function Goals() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [despesas, setDespesas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DESPESAS_KEY) || "[]"); } catch { return []; }
  });
  const [metas, setMetas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(METAS_KEY) || "[]"); } catch { return []; }
  });
  const [novaDespesa, setNovaDespesa] = useState({ nome: "", valor: 0, tipo: "fixa" });
  const [novaMeta, setNovaMeta] = useState({ nome: "", valor: 0 });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    Promise.all([
      base44.entities.Contract.list("-created_date", 200),
      base44.entities.ServiceOrder.list("-created_date", 50),
    ]).then(([c, o]) => { setContracts(c); setOrders(o); });
  }, []);

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <Lock className="w-12 h-12 opacity-30" />
        <p className="font-semibold text-lg">Acesso Restrito</p>
        <p className="text-sm">Esta página é visível apenas para Administradores.</p>
      </div>
    );
  }

  // Financial calculations
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const faturamentoMes = contracts
    .filter((c) => {
      const d = c.updated_date || c.created_date;
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    })
    .reduce((sum, c) => sum + (c.valor_total || 0), 0);

  const totalDespesas = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const lucroLiquido = faturamentoMes - totalDespesas;
  const pontoEquilibrio = totalDespesas;
  const percentualMeta = pontoEquilibrio > 0 ? Math.min(100, (faturamentoMes / pontoEquilibrio) * 100) : 100;

  const chartData = [
    { name: "Faturamento", value: faturamentoMes, fill: "#22c55e" },
    { name: "Despesas", value: totalDespesas, fill: "#ef4444" },
    { name: "Lucro Líq.", value: Math.max(0, lucroLiquido), fill: "#3b82f6" },
  ];

  const saveDespesas = (list) => {
    setDespesas(list);
    localStorage.setItem(DESPESAS_KEY, JSON.stringify(list));
  };

  const saveMetas = (list) => {
    setMetas(list);
    localStorage.setItem(METAS_KEY, JSON.stringify(list));
  };

  const addDespesa = () => {
    if (!novaDespesa.nome || !novaDespesa.valor) { toast.error("Preencha nome e valor"); return; }
    saveDespesas([...despesas, { ...novaDespesa, id: Date.now() }]);
    setNovaDespesa({ nome: "", valor: 0, tipo: "fixa" });
    toast.success("Despesa adicionada!");
  };

  const addMeta = () => {
    if (!novaMeta.nome || !novaMeta.valor) { toast.error("Preencha nome e valor"); return; }
    saveMetas([...metas, { ...novaMeta, id: Date.now(), progresso: 0 }]);
    setNovaMeta({ nome: "", valor: 0 });
    toast.success("Meta adicionada!");
  };

  return (
    <div>
      <PageHeader title="Metas e Inteligência Financeira" subtitle="Ponto de equilíbrio e metas de aquisição" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Faturamento Mês</p>
            <p className="text-2xl font-bold font-heading text-emerald-600 mt-1">
              R$ {faturamentoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Despesas</p>
            <p className="text-2xl font-bold font-heading text-destructive mt-1">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Lucro Líquido</p>
            <p className={`text-2xl font-bold font-heading mt-1 ${lucroLiquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              R$ {lucroLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ponto de Equilíbrio</p>
            <div className="flex items-end gap-1 mt-1">
              <p className="text-2xl font-bold font-heading">{percentualMeta.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground mb-1">atingido</p>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className={`h-1.5 rounded-full transition-all ${percentualMeta >= 100 ? "bg-emerald-500" : percentualMeta >= 70 ? "bg-amber-500" : "bg-destructive"}`}
                style={{ width: `${percentualMeta}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Débitos vs. Recebimentos (Mês Atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Break-even gauge */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Target className="w-4 h-4" /> Ponto de Equilíbrio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Para cobrir R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em despesas, você precisa faturar esse valor.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Faturado este mês</span>
                <span className="font-bold">R$ {faturamentoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-bold text-white transition-all ${percentualMeta >= 100 ? "bg-emerald-500" : percentualMeta >= 70 ? "bg-amber-500" : "bg-destructive"}`}
                  style={{ width: `${Math.min(100, percentualMeta)}%` }}
                >
                  {percentualMeta.toFixed(0)}%
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Meta mínima</span>
                <span>R$ {pontoEquilibrio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              {lucroLiquido < 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Falta R$ {Math.abs(lucroLiquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para atingir o ponto de equilíbrio.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Despesas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Despesas Mensais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input placeholder="Nome da despesa" value={novaDespesa.nome} onChange={(e) => setNovaDespesa(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <Input type="number" placeholder="Valor" value={novaDespesa.valor || ""} onChange={(e) => setNovaDespesa(p => ({ ...p, valor: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={novaDespesa.tipo === "fixa" ? "default" : "outline"} onClick={() => setNovaDespesa(p => ({ ...p, tipo: "fixa" }))}>Fixa</Button>
              <Button size="sm" variant={novaDespesa.tipo === "variavel" ? "default" : "outline"} onClick={() => setNovaDespesa(p => ({ ...p, tipo: "variavel" }))}>Variável</Button>
              <Button size="sm" onClick={addDespesa} className="ml-auto gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {despesas.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Nenhuma despesa cadastrada</p>}
              {despesas.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">{d.tipo === "fixa" ? "Fixa" : "Variável"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-destructive">R$ {Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <button onClick={() => saveDespesas(despesas.filter(x => x.id !== d.id))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Metas de Aquisição */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Metas de Aquisição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Ex: Comprar 10 andaimes" value={novaMeta.nome} onChange={(e) => setNovaMeta(p => ({ ...p, nome: e.target.value }))} />
              <Input type="number" placeholder="Valor (R$)" value={novaMeta.valor || ""} onChange={(e) => setNovaMeta(p => ({ ...p, valor: Number(e.target.value) }))} />
            </div>
            <Button size="sm" onClick={addMeta} className="gap-1 w-full"><Plus className="w-3.5 h-3.5" /> Adicionar Meta</Button>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {metas.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Nenhuma meta cadastrada</p>}
              {metas.map((m) => {
                const pct = Math.min(100, (Math.max(0, lucroLiquido) / m.valor) * 100);
                return (
                  <div key={m.id} className="p-3 rounded-xl bg-muted/50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium">{m.nome}</p>
                      <button onClick={() => saveMetas(metas.filter(x => x.id !== m.id))} className="text-muted-foreground hover:text-destructive ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 mb-1">
                      <div className={`h-2 rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% do lucro reservado</span>
                      <span>R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}