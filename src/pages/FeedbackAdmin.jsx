import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Star, MessageSquare, ThumbsUp, ThumbsDown, Lightbulb, Wrench, Truck, Package,
  Search, Send, Archive, CheckCircle, Filter, Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const CATEGORIA_CFG = {
  elogio:          { label: "Elogio",           icon: ThumbsUp,    cls: "text-emerald-600 bg-emerald-50" },
  reclamacao:      { label: "Reclamação",        icon: ThumbsDown,  cls: "text-red-600 bg-red-50" },
  sugestao:        { label: "Sugestão",          icon: Lightbulb,   cls: "text-amber-600 bg-amber-50" },
  problema_tecnico:{ label: "Problema Técnico",  icon: Wrench,      cls: "text-orange-600 bg-orange-50" },
  atendimento:     { label: "Atendimento",       icon: MessageSquare,cls: "text-blue-600 bg-blue-50" },
  entrega:         { label: "Entrega",           icon: Truck,       cls: "text-violet-600 bg-violet-50" },
  equipamentos:    { label: "Equipamentos",      icon: Package,     cls: "text-cyan-600 bg-cyan-50" },
};

const STATUS_CFG = {
  novo:       { label: "Novo",        cls: "bg-blue-100 text-blue-700" },
  em_analise: { label: "Em Análise",  cls: "bg-amber-100 text-amber-700" },
  respondido: { label: "Respondido",  cls: "bg-emerald-100 text-emerald-700" },
  resolvido:  { label: "Resolvido",   cls: "bg-green-100 text-green-700" },
  arquivado:  { label: "Arquivado",   cls: "bg-gray-100 text-gray-500" },
};

export default function FeedbackAdmin() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [detail, setDetail] = useState(null);
  const [resposta, setResposta] = useState("");
  const [novoStatus, setNovoStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  const load = async () => {
    const list = await base44.entities.Feedback.list("-created_date", 200);
    setFeedbacks(list);
    setLoading(false);
  };

  const openDetail = (fb) => {
    setDetail(fb);
    setResposta(fb.resposta || "");
    setNovoStatus(fb.status || "novo");
  };

  const handleSaveResposta = async () => {
    if (!detail) return;
    setSaving(true);
    await base44.entities.Feedback.update(detail.id, {
      resposta,
      status: novoStatus,
      respondido_por: user?.full_name || user?.email || "Admin",
      respondido_em: new Date().toISOString(),
    });
    toast.success("Resposta salva!");
    setSaving(false);
    setDetail(null);
    load();
  };

  const handleArchive = async (id) => {
    await base44.entities.Feedback.update(id, { status: "arquivado" });
    toast.success("Arquivado.");
    load();
  };

  // Filtros
  const filtered = feedbacks.filter(fb => {
    const q = search.toLowerCase();
    const matchQ = !q || fb.titulo?.toLowerCase().includes(q) || fb.client_nome?.toLowerCase().includes(q) || fb.descricao?.toLowerCase().includes(q);
    const matchC = filterCat === "todos" || fb.categoria === filterCat;
    const matchS = filterStatus === "todos" || fb.status === filterStatus;
    return matchQ && matchC && matchS;
  });

  const avgGeral = feedbacks.length > 0 ? (feedbacks.reduce((s, f) => s + (f.nota_geral || 0), 0) / feedbacks.filter(f => f.nota_geral > 0).length || 0).toFixed(1) : "—";

  return (
    <div>
      <PageHeader title="Feedbacks dos Clientes" subtitle="Gestão de avaliações e retornos" />

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: feedbacks.length, cls: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Novos", value: feedbacks.filter(f => f.status === "novo").length, cls: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Elogios", value: feedbacks.filter(f => f.categoria === "elogio").length, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Reclamações", value: feedbacks.filter(f => f.categoria === "reclamacao").length, cls: "bg-red-50 border-red-200 text-red-700" },
        ].map(m => (
          <div key={m.label} className={`rounded-2xl border p-3 ${m.cls}`}>
            <p className="text-xs opacity-70">{m.label}</p>
            <p className="text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Avaliação média */}
      {avgGeral !== "—" && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 w-fit">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= Math.round(parseFloat(avgGeral)) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
          </div>
          <span className="font-bold text-amber-700">{avgGeral}</span>
          <span className="text-xs text-amber-600">média geral</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar feedback..." className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(CATEGORIA_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum feedback encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const cc = CATEGORIA_CFG[fb.categoria] || CATEGORIA_CFG.atendimento;
            const sc = STATUS_CFG[fb.status] || STATUS_CFG.novo;
            const Icon = cc.icon;
            return (
              <Card key={fb.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(fb)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${cc.cls}`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{fb.titulo}</p>
                          <p className="text-xs text-muted-foreground">{fb.client_nome}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc.cls}`}>{sc.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cc.cls}`}>{cc.label}</span>
                        {fb.nota_geral > 0 && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= fb.nota_geral ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground">{fb.created_date ? format(new Date(fb.created_date), "dd/MM/yyyy") : "—"}</span>
                        {fb.colaborador_nome && <span className="text-[10px] text-muted-foreground">👤 {fb.colaborador_nome}</span>}
                      </div>
                      {fb.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{fb.descricao}</p>}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleArchive(fb.id); }}
                      className="shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-slate-700"
                      title="Arquivar"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de detalhe / resposta */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Feedback</DialogTitle>
          </DialogHeader>
          {detail && (() => {
            const cc = CATEGORIA_CFG[detail.categoria] || CATEGORIA_CFG.atendimento;
            const Icon = cc.icon;
            return (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <div className={`p-2 rounded-xl shrink-0 ${cc.cls}`}><Icon className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">{detail.titulo}</p>
                    <p className="text-xs text-muted-foreground">{detail.client_nome} — {detail.created_date ? format(new Date(detail.created_date), "dd/MM/yyyy HH:mm") : "—"}</p>
                  </div>
                </div>
                {detail.descricao && <p className="text-sm p-3 rounded-xl border whitespace-pre-wrap">{detail.descricao}</p>}

                {(detail.nota_geral || detail.nota_atendimento || detail.nota_entrega || detail.nota_equipamento) > 0 && (
                  <div className="p-3 rounded-xl border space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avaliações</p>
                    {[["Geral",detail.nota_geral],["Atendimento",detail.nota_atendimento],["Entrega",detail.nota_entrega],["Equipamentos",detail.nota_equipamento]].filter(([,v])=>v>0).map(([l,v])=>(
                      <div key={l} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{l}:</span>
                        <div className="flex gap-0.5">{[1,2,3,4,5].map(n=><Star key={n} className={`w-4 h-4 ${n<=v?"fill-amber-400 text-amber-400":"text-slate-200"}`}/>)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {detail.colaborador_nome && <p className="text-xs">👤 Colaborador: <strong>{detail.colaborador_nome}</strong></p>}
                {detail.contrato_numero && <p className="text-xs">📄 Ref: <strong>{detail.contrato_numero}</strong></p>}

                {(detail.anexos || []).length > 0 && (
                  <div className="space-y-1">
                    {detail.anexos.map((a,i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Paperclip className="w-3 h-3" />{a.nome}
                      </a>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3 space-y-3">
                  <Label className="text-xs font-semibold">Resposta ao Cliente</Label>
                  <Textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={3} placeholder="Digite a resposta para o cliente..." />
                  <div>
                    <Label className="text-xs">Alterar Status</Label>
                    <Select value={novoStatus} onValueChange={setNovoStatus}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
            <Button onClick={handleSaveResposta} disabled={saving} className="gap-2">
              <Send className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Resposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}