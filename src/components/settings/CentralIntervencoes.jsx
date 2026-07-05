import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Clock, CheckCircle2, UserCheck, Bot, RefreshCw,
  Phone, MessageSquare, Send, RotateCcw, ChevronDown, ChevronUp,
  Lock, ArrowRightLeft, XCircle, Zap, User
} from "lucide-react";
import { toast } from "sonner";

// ── Utilitários ───────────────────────────────────────────────────────────────
function tempoDecorrido(dataStr) {
  if (!dataStr) return "—";
  const diff = Date.now() - new Date(dataStr).getTime();
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);
  if (dias > 0) return `${dias}d`;
  if (hrs > 0) return `${hrs}h`;
  if (min > 0) return `${min}min`;
  return "agora";
}

const STATUS_CONFIG = {
  aguardando:  { label: "🟡 Aguardando",       cls: "bg-amber-100 text-amber-800",    icon: Clock },
  assumido:    { label: "🔴 Atendimento Humano", cls: "bg-red-100 text-red-800",       icon: UserCheck },
  respondido:  { label: "🟢 Respondido",        cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  concluido:   { label: "⚫ Concluído",          cls: "bg-slate-200 text-slate-700",   icon: CheckCircle2 },
  ia_retomada: { label: "🟢 IA Ativa",          cls: "bg-violet-100 text-violet-800",  icon: Bot },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.aguardando;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ── Envia WhatsApp ─────────────────────────────────────────────────────────────
async function enviarWhatsApp(telefone, texto, origem) {
  const result = await base44.functions.invoke("enviarMensagemHumana", { telefone, texto, origem });
  if (result?.data?.error) throw new Error(result.data.error);
}

// ── Card de Intervenção ────────────────────────────────────────────────────────
function InterventionCard({ item, user, onUpdate, settings }) {
  const [expanded, setExpanded] = useState(false);
  const [resposta, setResposta] = useState("");
  const [sending, setSending] = useState(false);
  const [assuming, setAssuming] = useState(false);
  const [retomando, setRetomando] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const msgEndRef = useRef();

  const isAtivo = item.status === "aguardando" || item.status === "assumido";
  const isAssumidoPorMim = item.assumido_por === user?.email;
  const isAssumidoPorOutro = item.status === "assumido" && item.assumido_por && item.assumido_por !== user?.email;

  useEffect(() => {
    if (expanded && msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [expanded, item.historico_mensagens]);

  const handleAssumir = async () => {
    setAssuming(true);
    try {
      const agora = new Date().toISOString();
      // Envia mensagem de apresentação ao cliente
      const nomeAtendente = user?.full_name || user?.email || "Atendente";
      try {
        await enviarWhatsApp(
          item.telefone,
          `Olá! Aqui é ${nomeAtendente}. Vou continuar seu atendimento. Como posso ajudá-lo?`,
          item.origem
        );
      } catch (e) {
        console.warn("Falha ao enviar msg de apresentação:", e.message);
      }

      await base44.entities.Intervention.update(item.id, {
        status: "assumido",
        ia_pausada: true,
        assumido_por: user?.email || "",
        assumido_por_nome: nomeAtendente,
        data_assumido: agora,
        historico_mensagens: [
          ...(item.historico_mensagens || []),
          {
            role: "sistema",
            conteudo: `👤 ${nomeAtendente} assumiu o atendimento`,
            data_hora: agora,
            autor: "Sistema",
          },
        ],
      });
      toast.success(`Conversa assumida. IA pausada.`);
      onUpdate();
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setAssuming(false);
    }
  };

  const handleResponder = async () => {
    if (!resposta.trim()) return;
    setSending(true);
    try {
      await enviarWhatsApp(item.telefone, resposta.trim(), item.origem);
      const agora = new Date().toISOString();
      await base44.entities.Intervention.update(item.id, {
        resposta_humana: resposta.trim(),
        respondido_por: user?.email || "",
        respondido_por_nome: user?.full_name || "",
        data_resposta: agora,
        historico_mensagens: [
          ...(item.historico_mensagens || []),
          {
            role: "humano",
            conteudo: resposta.trim(),
            data_hora: agora,
            autor: user?.full_name || "Atendente",
          },
        ],
      });
      toast.success("Mensagem enviada!");
      setResposta("");
      onUpdate();
    } catch (e) {
      toast.error("Erro ao enviar: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleConcluir = async () => {
    setConcluding(true);
    try {
      await base44.entities.Intervention.update(item.id, {
        status: "concluido",
        ia_pausada: false,
        concluido_por: user?.email || "",
        concluido_por_nome: user?.full_name || "",
        data_conclusao: new Date().toISOString(),
      });
      toast.success("Conversa concluída. IA retomada.");
      onUpdate();
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setConcluding(false);
    }
  };

  const handleRetornarIA = async () => {
    setRetomando(true);
    try {
      await base44.entities.Intervention.update(item.id, {
        status: "ia_retomada",
        ia_pausada: false,
      });
      toast.success("IA retomada.");
      onUpdate();
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setRetomando(false);
    }
  };

  const handleTransferir = async () => {
    setTransferindo(true);
    try {
      const nomeAtendente = user?.full_name || user?.email || "Atendente";
      await base44.entities.Intervention.update(item.id, {
        status: "assumido",
        ia_pausada: true,
        assumido_por: user?.email || "",
        assumido_por_nome: nomeAtendente,
        data_assumido: new Date().toISOString(),
        historico_mensagens: [
          ...(item.historico_mensagens || []),
          {
            role: "sistema",
            conteudo: `🔄 ${nomeAtendente} assumiu o atendimento (transferência)`,
            data_hora: new Date().toISOString(),
            autor: "Sistema",
          },
        ],
      });
      toast.success("Atendimento transferido para você.");
      onUpdate();
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setTransferindo(false);
    }
  };

  const cardBorder =
    item.status === "aguardando" ? "border-amber-300 shadow-amber-50 shadow-md" :
    item.status === "assumido"   ? "border-red-300 shadow-red-50 shadow-md" :
    "border-slate-200";

  const cardBg =
    item.status === "aguardando" ? "bg-amber-50/30" :
    item.status === "assumido"   ? "bg-red-50/20" :
    "bg-white";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${cardBorder}`}>
      {/* Header */}
      <div
        className={`flex items-start gap-3 p-4 cursor-pointer ${cardBg}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white ${
          item.status === "aguardando" ? "bg-amber-500" :
          item.status === "assumido"   ? "bg-red-500" :
          "bg-slate-400"
        }`}>
          {(item.cliente_nome || item.telefone || "?")[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-sm truncate">{item.cliente_nome || item.telefone}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-xs text-slate-700 line-clamp-1 mb-1">💬 {item.pergunta_original}</p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{item.telefone}</span>
            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{tempoDecorrido(item.data_criacao)}</span>
            {item.assumido_por_nome && isAtivo && (
              <span className="flex items-center gap-1 text-red-700 font-medium">
                <Lock className="w-2.5 h-2.5" /> {item.assumido_por_nome}
              </span>
            )}
            {item.motivo && (
              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">⚠️ {item.motivo}</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Área expandida */}
      {expanded && (
        <div className="border-t bg-white">
          {/* Banner de responsável */}
          {isAtivo && item.assumido_por_nome && (
            <div className={`flex items-center gap-2 px-4 py-2 border-b text-xs font-medium ${
              isAssumidoPorMim
                ? "bg-blue-50 border-blue-100 text-blue-800"
                : "bg-red-50 border-red-100 text-red-800"
            }`}>
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {isAssumidoPorMim
                ? `✅ Você está atendendo`
                : `🔒 Em atendimento por: ${item.assumido_por_nome}`
              }
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Histórico */}
            {item.historico_mensagens?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Histórico da conversa</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {item.historico_mensagens.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === "humano" ? "justify-end" : m.role === "sistema" ? "justify-center" : "justify-start"}`}>
                      {m.role === "sistema" ? (
                        <div className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-1 rounded-full">{m.conteudo}</div>
                      ) : (
                        <div className={`max-w-[80%] text-xs px-3 py-1.5 rounded-xl ${
                          m.role === "humano" ? "bg-primary text-white" :
                          m.role === "ia"     ? "bg-violet-100 text-violet-800" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {m.conteudo}
                          <div className="text-[9px] opacity-60 mt-0.5">{m.autor}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={msgEndRef} />
                </div>
              </div>
            )}

            {/* Área de resposta */}
            {isAtivo && (
              <div className="space-y-3">
                {/* Aviso se outro está atendendo */}
                {isAssumidoPorOutro && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                    <span>🔒 <strong>{item.assumido_por_nome}</strong> está atendendo esta conversa.</span>
                    <Button size="sm" variant="outline" onClick={handleTransferir} disabled={transferindo}
                      className="h-6 px-2 text-[10px] border-red-300 text-red-700 hover:bg-red-100 ml-2 shrink-0">
                      {transferindo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                      Assumir
                    </Button>
                  </div>
                )}

                {/* Textarea de resposta */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" /> Responder como humano
                  </p>
                  <Textarea
                    rows={3}
                    value={resposta}
                    onChange={e => setResposta(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleResponder(); } }}
                    placeholder="Digite a resposta que será enviada ao cliente via WhatsApp..."
                    className="text-sm resize-none"
                  />
                </div>

                {/* Botões de ação */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleResponder} disabled={!resposta.trim() || sending} className="gap-1.5">
                    {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "Enviando..." : "Enviar"}
                  </Button>

                  {item.status !== "assumido" && (
                    <Button size="sm" variant="outline" onClick={handleAssumir} disabled={assuming}
                      className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                      {assuming ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      {assuming ? "Assumindo..." : "Intervir"}
                    </Button>
                  )}

                  <Button size="sm" variant="outline" onClick={handleRetornarIA} disabled={retomando}
                    className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50">
                    {retomando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    {retomando ? "..." : "Retornar IA"}
                  </Button>

                  <Button size="sm" variant="outline" onClick={handleConcluir} disabled={concluding}
                    className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    {concluding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {concluding ? "..." : "Concluir Conversa"}
                  </Button>
                </div>
              </div>
            )}

            {/* Exibição final */}
            {!isAtivo && (
              <div className={`p-3 rounded-xl text-xs border ${
                item.status === "concluido" ? "bg-slate-50 border-slate-200 text-slate-700" :
                item.status === "ia_retomada" ? "bg-violet-50 border-violet-200 text-violet-800" :
                "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}>
                {item.status === "concluido" && (
                  <p>⚫ Concluído por <strong>{item.concluido_por_nome || "Atendente"}</strong></p>
                )}
                {item.status === "respondido" && (
                  <p>✅ Respondido por <strong>{item.respondido_por_nome || "Atendente"}</strong>: "{item.resposta_humana}"</p>
                )}
                {item.status === "ia_retomada" && (
                  <p className="flex items-center gap-1"><Bot className="w-3 h-3" /> IA retomada para este contato</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function CentralIntervencoes({ settings, onSaveSettings, form, up }) {
  const [intervencoes, setIntervencoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    carregar();

    // Tempo real via subscribe
    const unsub = base44.entities.Intervention.subscribe(() => carregar());
    return () => unsub();
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const items = await base44.entities.Intervention.list("-created_date", 200).catch(() => []);
    setIntervencoes(items);
    setLoading(false);
  }, []);

  const filtradas = intervencoes.filter(i => {
    const matchFiltro =
      filtro === "todos"     ? true :
      filtro === "ativos"    ? (i.status === "aguardando" || i.status === "assumido") :
      filtro === "aguardando"? i.status === "aguardando" :
      filtro === "assumido"  ? i.status === "assumido" :
      filtro === "concluidos"? (i.status === "concluido" || i.status === "respondido" || i.status === "ia_retomada") :
      true;

    const matchBusca = !busca.trim() ? true :
      (i.cliente_nome || "").toLowerCase().includes(busca.toLowerCase()) ||
      (i.telefone || "").includes(busca) ||
      (i.pergunta_original || "").toLowerCase().includes(busca.toLowerCase());

    return matchFiltro && matchBusca;
  });

  const countAtivos = intervencoes.filter(i => i.status === "aguardando" || i.status === "assumido").length;
  const countAguardando = intervencoes.filter(i => i.status === "aguardando").length;
  const countAssumido = intervencoes.filter(i => i.status === "assumido").length;
  const countConcluido = intervencoes.filter(i => i.status === "concluido" || i.status === "respondido").length;
  const countIAAtiva = intervencoes.filter(i => i.status === "ia_retomada").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-white border shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`w-5 h-5 ${countAtivos > 0 ? "text-red-500" : "text-slate-400"}`} />
            <h3 className="font-bold text-base">Central de Intervenções</h3>
            {countAtivos > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                {countAtivos} ativo{countAtivos > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Tempo real
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Atendimento humano supervisionado • IA pausada durante intervenção</p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1.5 h-8 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "🟡 Aguardando", count: countAguardando, cls: "bg-amber-50 border-amber-200 text-amber-800" },
          { label: "🔴 Em Atend.",  count: countAssumido,   cls: "bg-red-50 border-red-200 text-red-800" },
          { label: "⚫ Concluídos", count: countConcluido,  cls: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "🟢 IA Ativa",   count: countIAAtiva,    cls: "bg-violet-50 border-violet-200 text-violet-800" },
          { label: "Total Ativos",  count: countAtivos,     cls: "bg-white border-slate-200 text-slate-700 font-bold" },
        ].map(({ label, count, cls }) => (
          <div key={label} className={`rounded-xl p-3 border text-center ${cls}`}>
            <p className="text-xl font-bold">{count}</p>
            <p className="text-[10px]">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "ativos",     label: "Ativos" },
            { key: "aguardando", label: "Aguardando" },
            { key: "assumido",   label: "Em Atend." },
            { key: "concluidos", label: "Concluídos" },
            { key: "todos",      label: "Todos" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFiltro(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filtro === key ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[160px]">
          <Input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente, telefone..." className="h-8 text-xs" />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading && intervencoes.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        )}
        {!loading && filtradas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {filtro === "ativos" ? "Nenhuma intervenção ativa 🎉" : "Nenhuma intervenção encontrada"}
            </p>
          </div>
        )}
        {filtradas.map(item => (
          <InterventionCard key={item.id} item={item} user={user} onUpdate={carregar} settings={settings} />
        ))}
      </div>

      {/* Configurações */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-3 bg-slate-50 border-b">
          <p className="text-sm font-semibold">⚙️ Configurações da Central</p>
          <p className="text-xs text-muted-foreground">Controle o comportamento do escalonamento humano</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Mensagem enviada ao cliente ao escalar</p>
            <p className="text-xs text-muted-foreground mb-2">Enviada quando a IA pausa e aguarda atendimento humano</p>
            <textarea rows={2} value={form?.mensagem_aguardo_humano || ""}
              onChange={e => up("mensagem_aguardo_humano", e.target.value)}
              placeholder="Vou verificar essa informação com nossa equipe e retorno em breve! 😊"
              className="w-full text-sm rounded-lg border border-input bg-white px-3 py-2 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {[
            { field: "central_intervencoes_ativa", label: "Ativar Central de Intervenções", desc: "Cria alertas para atendimento humano quando necessário" },
            { field: "ia_pode_pedir_ajuda",         label: "IA pode solicitar ajuda humana",    desc: "A IA escala automaticamente quando não tem informação suficiente" },
            { field: "pausar_ia_automaticamente",   label: "Pausar IA automaticamente ao escalar", desc: "A IA para de responder enquanto aguarda intervenção humana" },
            { field: "retornar_ia_apos_resposta",   label: "Retornar IA após resposta humana",  desc: "Após o atendente responder, a IA volta a operar" },
          ].map(({ field, label, desc }) => (
            <div key={field} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button onClick={() => up(field, !form?.[field])}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors ${form?.[field] ? "bg-primary" : "bg-slate-200"}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form?.[field] ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          ))}

          {/* Timeout */}
          <div className="p-3 rounded-xl bg-slate-50/70 border space-y-2">
            <div>
              <p className="text-sm font-medium">Retorno automático da IA por inatividade</p>
              <p className="text-xs text-muted-foreground">Após este tempo sem resposta humana, a IA retoma automaticamente. Use 0 para somente manual.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Manual apenas", value: 0 },
                { label: "15 min", value: 15 },
                { label: "30 min", value: 30 },
                { label: "1 hora", value: 60 },
                { label: "2 horas", value: 120 },
              ].map(({ label, value }) => {
                const selected = (Number(form?.intervencao_timeout_minutos) || 0) === value;
                return (
                  <button key={value} onClick={() => up("intervencao_timeout_minutos", value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selected ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
            {(Number(form?.intervencao_timeout_minutos) || 0) === 0
              ? <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">⚠️ Modo manual: a IA só volta quando clicar em "Concluir Conversa" ou "Retornar IA"</p>
              : <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5">✅ A IA retornará automaticamente após {form.intervencao_timeout_minutos} minutos sem resposta humana</p>
            }
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={onSaveSettings} className="gap-1.5 px-6">Salvar configurações</Button>
          </div>
        </div>
      </div>
    </div>
  );
}