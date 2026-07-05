import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, RefreshCw, MessageSquare, Bot, User, Phone,
  ChevronLeft, AlertCircle, XCircle, BarChart3,
  Filter, Calendar, UserCheck, UserX, CheckCircle2,
  Clock, HandHelping, Undo2, Users, ChevronRight,
  SendHorizonal, Lock, ArrowRightLeft, Zap
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Utilitários ──────────────────────────────────────────────────────────────
function formatDateTime(str) {
  if (!str) return "—";
  const d = new Date(str);
  const hoje = new Date();
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + `, ${hora}`;
}

function formatDateTimeFull(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

const CORES = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-rose-500","bg-amber-500","bg-cyan-500","bg-pink-500","bg-indigo-500"];
function corAvatar(tel) {
  let hash = 0;
  for (const c of (tel || "")) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return CORES[hash % CORES.length];
}
function nomeExibicao(contato) {
  return contato.nome || (contato.telefone !== "desconhecido" ? contato.telefone : "Desconhecido");
}
function iniciais(contato) {
  return nomeExibicao(contato).split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Agrupa logs por contato ──────────────────────────────────────────────────
function agruparPorContato(logs) {
  const map = {};
  for (const log of logs) {
    const tel = log.telefone || "desconhecido";
    if (!map[tel]) {
      map[tel] = {
        telefone: tel, nome: log.cliente_nome || null, cliente_id: log.cliente_id || null,
        mensagens: [], ultima_interacao: log.data_hora || log.created_date,
        ultimo_status: log.status, tem_cadastro: !!log.cliente_id,
      };
    }
    map[tel].mensagens.push(log);
    const d1 = new Date(log.data_hora || log.created_date || 0);
    const d2 = new Date(map[tel].ultima_interacao || 0);
    if (d1 > d2) {
      map[tel].ultima_interacao = log.data_hora || log.created_date;
      map[tel].ultimo_status = log.status;
      if (log.cliente_nome) map[tel].nome = log.cliente_nome;
      if (log.cliente_id) { map[tel].cliente_id = log.cliente_id; map[tel].tem_cadastro = true; }
    }
  }
  for (const tel in map) {
    map[tel].mensagens.sort((a, b) =>
      new Date(a.data_hora || a.created_date || 0) - new Date(b.data_hora || b.created_date || 0)
    );
  }
  return Object.values(map).sort((a, b) =>
    new Date(b.ultima_interacao || 0) - new Date(a.ultima_interacao || 0)
  );
}

// ─── Status da conversa ───────────────────────────────────────────────────────
function statusConversa(contato, intervencoes) {
  const interv = intervencoes.find(i =>
    i.telefone === contato.telefone &&
    (i.status === "aguardando" || i.status === "assumido")
  );
  if (interv) return { tipo: "intervencao", intervencao: interv };
  const ultimo = contato.mensagens[contato.mensagens.length - 1];
  if (!ultimo) return { tipo: "desconhecido" };
  if (ultimo.status === "erro") return { tipo: "erro" };
  if (ultimo.status === "sem_cadastro") return { tipo: "sem_cadastro" };
  if (ultimo.status === "enviado" && ultimo.resposta) return { tipo: "concluido" };
  return { tipo: "aberto" };
}

// ─── Badges ──────────────────────────────────────────────────────────────────
function BadgeStatus({ tipo, intervencao }) {
  const cfg = {
    concluido:    { label: "🟢 IA ativa",     cls: "bg-emerald-100 text-emerald-700" },
    aberto:       { label: "🟡 Aguardando",   cls: "bg-amber-100 text-amber-700" },
    erro:         { label: "Erro",            cls: "bg-red-100 text-red-700" },
    sem_cadastro: { label: "Sem cadastro",    cls: "bg-slate-100 text-slate-600" },
    intervencao:  { label: "🔴 Atend. Humano", cls: "bg-red-100 text-red-800 font-bold" },
    desconhecido: { label: "—",               cls: "bg-slate-100 text-slate-500" },
  };
  const { label, cls } = cfg[tipo] || cfg.desconhecido;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>;
}

// ─── Linha de contato ─────────────────────────────────────────────────────────
function LinhaContato({ contato, ativo, onSelecionar, statusInfo }) {
  const ultima = contato.mensagens[contato.mensagens.length - 1];
  const ultimaMsg = ultima?.pergunta || ultima?.resposta || "—";
  const isIntervencao = statusInfo?.tipo === "intervencao";

  return (
    <button onClick={() => onSelecionar(contato)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-muted/40 ${
        ativo ? "bg-primary/5 border-r-2 border-r-primary" :
        isIntervencao ? "bg-red-50/40" : ""
      }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${corAvatar(contato.telefone)}`}>
        {iniciais(contato)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-semibold truncate">{nomeExibicao(contato)}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(contato.ultima_interacao)}</span>
        </div>
        {contato.nome && contato.telefone !== contato.nome && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Phone className="w-2.5 h-2.5" /> {contato.telefone}
          </p>
        )}
        <p className="text-xs text-muted-foreground truncate mt-0.5">{ultimaMsg}</p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <BadgeStatus tipo={statusInfo?.tipo} intervencao={statusInfo?.intervencao} />
          {statusInfo?.intervencao?.assumido_por_nome && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex items-center gap-0.5">
              <Lock className="w-2 h-2" /> {statusInfo.intervencao.assumido_por_nome}
            </span>
          )}
          {contato.tem_cadastro
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex items-center gap-0.5"><UserCheck className="w-2.5 h-2.5"/>Cadastrado</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 font-medium flex items-center gap-0.5"><UserX className="w-2.5 h-2.5"/>Sem cadastro</span>
          }
        </div>
      </div>
    </button>
  );
}

// ─── Paginação ────────────────────────────────────────────────────────────────
function Paginacao({ pagina, totalPaginas, onAnterior, onProxima }) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2 border-t bg-slate-50/60 text-xs text-muted-foreground">
      <button onClick={onAnterior} disabled={pagina === 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span>Página {pagina} de {totalPaginas}</span>
      <button onClick={onProxima} disabled={pagina === totalPaginas} className="p-1 rounded hover:bg-muted disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Bolha de mensagem WhatsApp ───────────────────────────────────────────────
function BolhaMensagem({ log }) {
  const data = formatDateTimeFull(log.data_hora || log.created_date);
  return (
    <div className="space-y-2 py-1">
      {log.pergunta && (
        <div className="flex items-end gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
            <Phone className="w-3 h-3 text-slate-600" />
          </div>
          <div className="max-w-[80%]">
            <div className="bg-white border rounded-2xl rounded-bl-sm px-3 py-2 text-sm shadow-sm">{log.pergunta}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-1">{data}</p>
          </div>
        </div>
      )}
      {log.resposta && log.status !== "erro" && (
        <div className="flex items-end gap-2 justify-end">
          <div className="max-w-[80%]">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm shadow-sm">{log.resposta}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 mr-1 text-right flex items-center justify-end gap-1">
              <Bot className="w-2.5 h-2.5" /> IA · {data}
            </p>
          </div>
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-primary" />
          </div>
        </div>
      )}
      {log.status === "erro" && (
        <div className="flex items-start gap-2 justify-end">
          <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-2xl px-3 py-2 text-xs text-red-700">
            <p className="font-semibold flex items-center gap-1 mb-0.5"><XCircle className="w-3 h-3" /> Erro na resposta</p>
            {log.erro_detalhe && <p>{log.erro_detalhe}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bolha de mensagem humana (histórico intervenção) ─────────────────────────
function BolhaHumana({ msg }) {
  const data = formatDateTimeFull(msg.data_hora);
  if (msg.role === "sistema") {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[10px] text-muted-foreground bg-slate-100 px-3 py-1 rounded-full">{msg.conteudo}</span>
      </div>
    );
  }
  const isHumano = msg.role === "humano" || msg.role === "human";
  return (
    <div className={`flex items-end gap-2 py-1 ${isHumano ? "justify-end" : "justify-start"}`}>
      {!isHumano && (
        <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
          <Phone className="w-3 h-3 text-slate-600" />
        </div>
      )}
      <div className="max-w-[80%]">
        <div className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isHumano ? "bg-blue-600 text-white rounded-br-sm" :
          msg.role === "ia" ? "bg-primary text-primary-foreground rounded-bl-sm" :
          "bg-white border rounded-bl-sm"
        }`}>
          {msg.conteudo}
        </div>
        <p className={`text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1 ${isHumano ? "justify-end mr-1" : "ml-1"}`}>
          {isHumano && <User className="w-2.5 h-2.5" />}
          {msg.autor} · {data}
        </p>
      </div>
      {isHumano && (
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="w-3 h-3 text-blue-600" />
        </div>
      )}
    </div>
  );
}

// ─── Painel de conversa (direita) ─────────────────────────────────────────────
function PainelConversa({ contato, intervencoes, logs, onVoltar, onCarregar, user }) {
  const msgRef = useRef();
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [retomando, setRetomando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  const intervencao = intervencoes.find(i =>
    i.telefone === contato.telefone &&
    (i.status === "aguardando" || i.status === "assumido")
  );
  const iaPausada = !!intervencao?.ia_pausada;
  const assumidoPorMim = intervencao?.assumido_por === user?.email;
  const assumidoPorOutro = iaPausada && intervencao?.assumido_por && !assumidoPorMim;

  // Scroll automático
  useEffect(() => {
    setTimeout(() => {
      if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
    }, 100);
  }, [contato.mensagens, intervencao?.historico_mensagens]);

  const handleIntervir = async () => {
    setAssumindo(true);
    try {
      const nomeAtendente = user?.full_name || user?.email || "Atendente";
      const agora = new Date().toISOString();

      // Envia msg de apresentação ao cliente
      try {
        await base44.functions.invoke("enviarMensagemHumana", {
          telefone: contato.telefone,
          texto: `Olá! Aqui é ${nomeAtendente}. Vou continuar seu atendimento. Como posso ajudá-lo?`,
          origem: intervencao?.origem || "meta",
        });
      } catch (e) { console.warn("Falha ao enviar apresentação:", e.message); }

      if (intervencao) {
        await base44.entities.Intervention.update(intervencao.id, {
          status: "assumido",
          ia_pausada: true,
          assumido_por: user?.email || "",
          assumido_por_nome: nomeAtendente,
          data_assumido: agora,
          historico_mensagens: [
            ...(intervencao.historico_mensagens || []),
            { role: "sistema", conteudo: `👤 ${nomeAtendente} assumiu o atendimento`, data_hora: agora, autor: "Sistema" },
          ],
        });
      } else {
        await base44.entities.Intervention.create({
          telefone: contato.telefone,
          cliente_nome: contato.nome || "",
          cliente_id: contato.cliente_id || "",
          pergunta_original: contato.mensagens[contato.mensagens.length - 1]?.pergunta || "",
          motivo: "Intervenção manual",
          status: "assumido",
          ia_pausada: true,
          assumido_por: user?.email || "",
          assumido_por_nome: nomeAtendente,
          data_assumido: agora,
          data_criacao: agora,
          historico_mensagens: [
            { role: "sistema", conteudo: `👤 ${nomeAtendente} assumiu o atendimento`, data_hora: agora, autor: "Sistema" },
          ],
        });
      }
      toast.success(`Conversa assumida por ${nomeAtendente}`);
      onCarregar();
    } catch (e) { toast.error("Erro: " + e.message); }
    finally { setAssumindo(false); }
  };

  const handleEnviar = async () => {
    if (!textoResposta.trim() || !intervencao) return;
    setEnviando(true);
    try {
      await base44.functions.invoke("enviarMensagemHumana", {
        telefone: contato.telefone,
        texto: textoResposta.trim(),
        origem: intervencao.origem || "meta",
      });
      const agora = new Date().toISOString();
      const hist = [...(intervencao.historico_mensagens || []), {
        role: "humano",
        conteudo: textoResposta.trim(),
        data_hora: agora,
        autor: user?.full_name || user?.email || "Atendente",
      }];
      await base44.entities.Intervention.update(intervencao.id, {
        historico_mensagens: hist,
        resposta_humana: textoResposta.trim(),
        respondido_por: user?.email,
        respondido_por_nome: user?.full_name || user?.email,
        data_resposta: agora,
      });
      setTextoResposta("");
      onCarregar();
    } catch (e) { toast.error("Erro: " + e.message); }
    finally { setEnviando(false); }
  };

  const handleRetornarIA = async () => {
    if (!intervencao) return;
    setRetomando(true);
    try {
      await base44.entities.Intervention.update(intervencao.id, { status: "ia_retomada", ia_pausada: false });
      toast.success("IA retomada.");
      onCarregar();
    } catch (e) { toast.error("Erro: " + e.message); }
    finally { setRetomando(false); }
  };

  const handleConcluir = async () => {
    if (!intervencao) return;
    setConcluindo(true);
    try {
      await base44.entities.Intervention.update(intervencao.id, {
        status: "concluido",
        ia_pausada: false,
        concluido_por: user?.email || "",
        concluido_por_nome: user?.full_name || "",
        data_conclusao: new Date().toISOString(),
      });
      toast.success("Conversa concluída.");
      onCarregar();
    } catch (e) { toast.error("Erro: " + e.message); }
    finally { setConcluindo(false); }
  };

  const handleAssumirDeOutro = async () => {
    if (!intervencao) return;
    setAssumindo(true);
    try {
      const nomeAtendente = user?.full_name || user?.email || "Atendente";
      const agora = new Date().toISOString();
      await base44.entities.Intervention.update(intervencao.id, {
        assumido_por: user?.email || "",
        assumido_por_nome: nomeAtendente,
        data_assumido: agora,
        historico_mensagens: [
          ...(intervencao.historico_mensagens || []),
          { role: "sistema", conteudo: `🔄 ${nomeAtendente} assumiu (transferência)`, data_hora: agora, autor: "Sistema" },
        ],
      });
      toast.success("Atendimento assumido.");
      onCarregar();
    } catch (e) { toast.error("Erro: " + e.message); }
    finally { setAssumindo(false); }
  };

  const totalEnviadas = contato.mensagens.filter(m => m.status === "enviado").length;
  const totalErros = contato.mensagens.filter(m => m.status === "erro").length;

  // Merge logs e histórico de intervenção em ordem cronológica
  const todasMensagens = [
    ...contato.mensagens.map(m => ({ ...m, _tipo: "log" })),
  ];
  const histInterv = intervencao?.historico_mensagens || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-white shrink-0">
        <button onClick={onVoltar} className="md:hidden p-1.5 rounded-lg hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${corAvatar(contato.telefone)}`}>
          {iniciais(contato)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{nomeExibicao(contato)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-2.5 h-2.5" /> {contato.telefone}
            {contato.tem_cadastro
              ? <span className="ml-1 text-[10px] text-blue-600 flex items-center gap-0.5"><UserCheck className="w-2.5 h-2.5"/>Cadastrado</span>
              : <span className="ml-1 text-[10px] text-slate-500 flex items-center gap-0.5"><UserX className="w-2.5 h-2.5"/>Sem cadastro</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-emerald-700">{totalEnviadas} enviada(s)</p>
            {totalErros > 0 && <p className="text-xs text-red-600">{totalErros} erro(s)</p>}
          </div>
          {/* Botões principais */}
          {!iaPausada ? (
            <Button size="sm" variant="outline" onClick={handleIntervir} disabled={assumindo}
              className="gap-1.5 text-xs h-8 border-orange-300 text-orange-700 hover:bg-orange-50">
              {assumindo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <HandHelping className="w-3.5 h-3.5" />}
              Intervir
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={handleRetornarIA} disabled={retomando}
                className="gap-1.5 text-xs h-8 border-violet-300 text-violet-700 hover:bg-violet-50">
                {retomando ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                Ret. IA
              </Button>
              <Button size="sm" variant="outline" onClick={handleConcluir} disabled={concluindo}
                className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                {concluindo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Concluir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Banner status */}
      {iaPausada && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b text-sm font-medium ${
          assumidoPorMim ? "bg-blue-50 border-blue-200 text-blue-900" :
          assumidoPorOutro ? "bg-red-50 border-red-200 text-red-900" :
          "bg-orange-50 border-orange-200 text-orange-900"
        }`}>
          {assumidoPorOutro ? <Lock className="w-4 h-4 shrink-0" /> : <Users className="w-4 h-4 shrink-0" />}
          {assumidoPorMim
            ? `✅ Você está atendendo esta conversa`
            : assumidoPorOutro
            ? `🔒 Em atendimento por: ${intervencao.assumido_por_nome}`
            : `🔴 Atendimento Humano Ativo`
          }
          {!assumidoPorMim && assumidoPorOutro && (
            <Button size="sm" variant="outline" onClick={handleAssumirDeOutro} disabled={assumindo}
              className="ml-auto h-6 px-2 text-[10px] border-red-300 text-red-700 hover:bg-red-100 shrink-0">
              <ArrowRightLeft className="w-3 h-3 mr-1" /> Assumir
            </Button>
          )}
          <span className="ml-auto text-xs opacity-70">🔴 IA pausada</span>
        </div>
      )}
      {!iaPausada && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b text-xs text-emerald-700 bg-emerald-50/50">
          <Bot className="w-3 h-3" /> 🟢 IA ativa — respondendo automaticamente
        </div>
      )}

      {/* Mensagens */}
      <div ref={msgRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50/50">
        {/* Logs do WhatsApp */}
        {todasMensagens.length === 0 && histInterv.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">Nenhuma mensagem</div>
        )}
        {todasMensagens.map((log, i) => <BolhaMensagem key={i} log={log} />)}

        {/* Separador de intervenção */}
        {histInterv.length > 0 && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 border-t border-dashed border-orange-300" />
            <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              👤 Atendimento Humano
            </span>
            <div className="flex-1 border-t border-dashed border-orange-300" />
          </div>
        )}

        {/* Histórico de intervenção */}
        {histInterv.map((msg, i) => <BolhaHumana key={i} msg={msg} />)}
      </div>

      {/* Área de resposta (modo humano) */}
      {iaPausada && (
        <div className="px-4 py-3 border-t bg-white shrink-0">
          {assumidoPorOutro && (
            <p className="text-[10px] text-red-700 mb-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> <strong>{intervencao.assumido_por_nome}</strong> está atendendo. Clique em "Assumir" para tomar controle.
            </p>
          )}
          {!assumidoPorOutro && (
            <p className="text-[10px] text-blue-700 mb-2 font-medium flex items-center gap-1">
              <Users className="w-3 h-3" /> Modo humano ativo — responda diretamente ao cliente
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={textoResposta}
              onChange={e => setTextoResposta(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="text-sm h-9"
              disabled={assumidoPorOutro}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
            />
            <Button size="sm" onClick={handleEnviar}
              disabled={!textoResposta.trim() || enviando || assumidoPorOutro}
              className="h-9 px-3 gap-1.5 shrink-0">
              {enviando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
              {enviando ? "..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}
      {!iaPausada && (
        <div className="px-4 py-2 border-t bg-white flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
          <Bot className="w-3 h-3" />
          <span>Mensagens processadas automaticamente pelo Agente IA</span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AgenteHistoricoConversas() {
  const [logs, setLogs] = useState([]);
  const [intervencoes, setIntervencoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [mostraMobile, setMostraMobile] = useState(false);
  const [user, setUser] = useState(null);

  const [filtroCadastro, setFiltroCadastro] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroData, setFiltroData] = useState(todayStr());
  const [porPagina, setPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    carregar();

    // Tempo real — subscribe a mudanças
    const unsubInterv = base44.entities.Intervention.subscribe(() => carregarIntervencoes());
    const unsubLogs = base44.entities.WhatsappLog.subscribe(() => carregarLogs());
    return () => { unsubInterv(); unsubLogs(); };
  }, []);

  useEffect(() => { carregar(); }, [filtroData]);
  useEffect(() => { setPagina(1); }, [busca, filtroCadastro, filtroStatus, porPagina, filtroData]);

  const carregarLogs = useCallback(async () => {
    const items = await base44.entities.WhatsappLog.list("-created_date", 1000).catch(() => []);
    setLogs(items);
    // Atualiza contato selecionado com novos dados
    setSelecionado(prev => {
      if (!prev) return prev;
      const todosC = agruparPorContato(items);
      return todosC.find(c => c.telefone === prev.telefone) || prev;
    });
  }, []);

  const carregarIntervencoes = useCallback(async () => {
    const items = await base44.entities.Intervention.list("-created_date", 200).catch(() => []);
    setIntervencoes(items);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [items, intervs] = await Promise.all([
      base44.entities.WhatsappLog.list("-created_date", 1000).catch(() => []),
      base44.entities.Intervention.list("-created_date", 200).catch(() => []),
    ]);
    setLogs(items);
    setIntervencoes(intervs);
    // Atualiza selecionado se existir
    if (selecionado) {
      const todosC = agruparPorContato(items);
      const atualizado = todosC.find(c => c.telefone === selecionado.telefone);
      if (atualizado) setSelecionado(atualizado);
    }
    setLoading(false);
  }, [selecionado]);

  const logsFiltradosPorData = filtroData
    ? logs.filter(l => (l.data_hora || l.created_date || "").slice(0, 10) === filtroData)
    : logs;

  const todosContatos = agruparPorContato(logsFiltradosPorData.length > 0 ? logsFiltradosPorData : logs);

  const contatosFiltrados = todosContatos.filter(c => {
    const statusInfo = statusConversa(c, intervencoes);
    const q = busca.toLowerCase();
    if (q && !(
      (c.nome || "").toLowerCase().includes(q) ||
      (c.telefone || "").toLowerCase().includes(q) ||
      c.mensagens.some(m => (m.pergunta || "").toLowerCase().includes(q) || (m.resposta || "").toLowerCase().includes(q))
    )) return false;
    if (filtroCadastro === "cadastrado" && !c.tem_cadastro) return false;
    if (filtroCadastro === "sem_cadastro" && c.tem_cadastro) return false;
    if (filtroStatus === "aberto" && !["aberto","intervencao","erro"].includes(statusInfo.tipo)) return false;
    if (filtroStatus === "concluido" && statusInfo.tipo !== "concluido") return false;
    if (filtroStatus === "intervencao" && statusInfo.tipo !== "intervencao") return false;
    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(contatosFiltrados.length / porPagina));
  const contatosPaginados = contatosFiltrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const handleSelecionar = (c) => { setSelecionado(c); setMostraMobile(true); };
  const handleVoltar = () => setMostraMobile(false);

  const totalContatos = todosContatos.length;
  const totalMsgs = logsFiltradosPorData.length > 0 ? logsFiltradosPorData.length : logs.length;
  const totalErros = logs.filter(l => l.status === "erro").length;
  const totalIntervencoes = intervencoes.filter(i => i.status === "aguardando" || i.status === "assumido").length;

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-xs font-medium">
            <MessageSquare className="w-3 h-3 text-primary" /> {totalContatos} contato(s)
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-xs font-medium">
            <BarChart3 className="w-3 h-3 text-slate-500" /> {totalMsgs} mensagem(ns)
          </div>
          {totalErros > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              <AlertCircle className="w-3 h-3" /> {totalErros} erro(s)
            </div>
          )}
          {totalIntervencoes > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-medium text-orange-700 animate-pulse">
              <Users className="w-3 h-3" /> {totalIntervencoes} em atendimento
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Tempo real
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1.5 h-8 text-xs">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border rounded-xl">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
            className="h-8 text-xs rounded-lg border border-input bg-transparent px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          {filtroData !== todayStr() && (
            <button onClick={() => setFiltroData(todayStr())} className="text-[10px] text-primary hover:underline">Hoje</button>
          )}
        </div>
        <Select value={filtroCadastro} onValueChange={setFiltroCadastro}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Cadastro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="cadastrado">✅ Cadastrados</SelectItem>
            <SelectItem value="sem_cadastro">❌ Sem cadastro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="intervencao">🔴 Em Atend. Humano</SelectItem>
            <SelectItem value="aberto">🟡 Em Aberto</SelectItem>
            <SelectItem value="concluido">🟢 IA Ativa</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Por página:</span>
          <Select value={String(porPagina)} onValueChange={v => setPorPagina(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Layout principal */}
      <div className="border rounded-xl overflow-hidden bg-white" style={{ minHeight: 520 }}>
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando conversas...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa registrada</p>
          </div>
        ) : (
          <div className="flex h-full" style={{ minHeight: 520 }}>
            {/* Coluna esquerda */}
            <div className={`flex flex-col border-r w-full md:w-80 shrink-0 ${mostraMobile ? "hidden md:flex" : "flex"}`}>
              <div className="p-3 border-b bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar nome, telefone..." className="pl-8 h-8 text-xs" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                  {contatosFiltrados.length} conversa(s)
                  {contatosFiltrados.length > porPagina && ` · pág. ${pagina}/${totalPaginas}`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                {contatosPaginados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                  </div>
                ) : contatosPaginados.map(c => (
                  <LinhaContato key={c.telefone} contato={c}
                    ativo={selecionado?.telefone === c.telefone}
                    onSelecionar={handleSelecionar}
                    statusInfo={statusConversa(c, intervencoes)}
                  />
                ))}
              </div>
              <Paginacao pagina={pagina} totalPaginas={totalPaginas}
                onAnterior={() => setPagina(p => Math.max(1, p - 1))}
                onProxima={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              />
            </div>

            {/* Coluna direita */}
            <div className={`flex-1 flex flex-col min-w-0 ${mostraMobile ? "flex" : "hidden md:flex"}`}>
              {selecionado ? (
                <PainelConversa
                  contato={selecionado}
                  intervencoes={intervencoes}
                  logs={logs}
                  onVoltar={handleVoltar}
                  onCarregar={carregar}
                  user={user}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MessageSquare className="w-14 h-14 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">Selecione uma conversa</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique em um contato para ver o histórico</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}