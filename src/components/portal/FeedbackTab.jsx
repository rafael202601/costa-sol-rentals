import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Send, Paperclip, X, CheckCircle, MessageSquare, ThumbsUp, ThumbsDown, Lightbulb, Wrench, Truck, Package } from "lucide-react";
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

function StarRating({ value, onChange, label }) {
  return (
    <div>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange && onChange(n)} className="transition-transform hover:scale-110">
            <Star className={`w-6 h-6 ${n <= (value || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
          </button>
        ))}
        {value ? <span className="ml-1 text-xs text-muted-foreground self-center">{value}/5</span> : null}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  titulo: "", categoria: "atendimento", descricao: "", nota_geral: 5,
  nota_atendimento: 0, nota_entrega: 0, nota_equipamento: 0,
  colaborador_nome: "", contrato_numero: "", anexos: [],
};

export default function FeedbackTab({ client, isAdminView = false }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [detail, setDetail] = useState(null);
  const fileRef = useRef();

  useState(() => {
    if (!client) return;
    base44.entities.Feedback.filter({ client_id: client.id }).then(list => {
      setFeedbacks(list.sort((a, b) => (b.created_date || "") > (a.created_date || "") ? 1 : -1));
      setLoaded(true);
    });
  }, [client]);

  const loadFeedbacks = async () => {
    const list = await base44.entities.Feedback.filter({ client_id: client.id });
    setFeedbacks(list.sort((a, b) => (b.created_date || "") > (a.created_date || "") ? 1 : -1));
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAnexo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingAnexo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("anexos", [...(form.anexos || []), { nome: file.name, url: file_url, tipo: file.type }]);
    setUploadingAnexo(false);
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o título do feedback");
    if (!form.descricao.trim()) return toast.error("Descreva o feedback");
    setSaving(true);
    await base44.entities.Feedback.create({
      ...form,
      client_id: client.id,
      client_nome: client.nome_razao_social,
      status: "novo",
    });
    toast.success("Feedback enviado! Obrigado pela sua avaliação.");
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSaving(false);
    loadFeedbacks();
  };

  const avgNota = feedbacks.length > 0
    ? (feedbacks.reduce((s, f) => s + (f.nota_geral || 0), 0) / feedbacks.length).toFixed(1)
    : "—";

  if (!loaded) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (detail) return (
    <FeedbackDetail feedback={detail} onClose={() => setDetail(null)} client={client} onUpdated={loadFeedbacks} />
  );

  return (
    <div className="space-y-4">
      {/* Métricas */}
      {feedbacks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border p-3 bg-amber-50 border-amber-200">
            <p className="text-xs text-muted-foreground">Média</p>
            <p className="text-2xl font-bold text-amber-600 flex items-center gap-1">{avgNota} <Star className="w-4 h-4 fill-amber-400 text-amber-400" /></p>
          </div>
          <div className="rounded-xl border p-3 bg-emerald-50 border-emerald-200">
            <p className="text-xs text-muted-foreground">Elogios</p>
            <p className="text-2xl font-bold text-emerald-600">{feedbacks.filter(f => f.categoria === "elogio").length}</p>
          </div>
          <div className="rounded-xl border p-3 bg-red-50 border-red-200">
            <p className="text-xs text-muted-foreground">Reclamações</p>
            <p className="text-2xl font-bold text-red-600">{feedbacks.filter(f => f.categoria === "reclamacao").length}</p>
          </div>
        </div>
      )}

      {!showForm && !isAdminView && (
        <Button onClick={() => setShowForm(true)} className="w-full gap-2">
          <MessageSquare className="w-4 h-4" /> Enviar Feedback
        </Button>
      )}

      {/* Formulário */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <p className="font-semibold text-sm">Novo Feedback</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Título *</Label>
                <Input value={form.titulo} onChange={e => f("titulo", e.target.value)} className="mt-1" placeholder="Resumo do feedback..." />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => f("categoria", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_CFG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">Colaborador / Motorista (opcional)</Label>
                <Input value={form.colaborador_nome || ""} onChange={e => f("colaborador_nome", e.target.value)} className="mt-1" placeholder="Nome..." />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Contrato / OS relacionado (opcional)</Label>
                <Input value={form.contrato_numero || ""} onChange={e => f("contrato_numero", e.target.value)} className="mt-1" placeholder="Ex: #0042" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Descrição *</Label>
                <Textarea value={form.descricao} onChange={e => f("descricao", e.target.value)} rows={3} className="mt-1" placeholder="Conte mais detalhes..." />
              </div>
            </div>

            {/* Avaliações */}
            <div className="space-y-2 p-3 rounded-xl bg-muted/30 border">
              <p className="text-xs font-semibold">Avaliações</p>
              <StarRating value={form.nota_geral} onChange={v => f("nota_geral", v)} label="Avaliação Geral" />
              <StarRating value={form.nota_atendimento} onChange={v => f("nota_atendimento", v)} label="Atendimento" />
              <StarRating value={form.nota_entrega} onChange={v => f("nota_entrega", v)} label="Entrega" />
              <StarRating value={form.nota_equipamento} onChange={v => f("nota_equipamento", v)} label="Equipamentos" />
            </div>

            {/* Anexos */}
            <div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleAnexo} accept="image/*,.pdf" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={uploadingAnexo} className="gap-1.5 text-xs">
                <Paperclip className="w-3.5 h-3.5" /> {uploadingAnexo ? "Enviando..." : "Anexar foto/PDF"}
              </Button>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.anexos || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                    <Paperclip className="w-3 h-3" />
                    <span className="max-w-[100px] truncate">{a.nome}</span>
                    <button onClick={() => f("anexos", form.anexos.filter((_,j)=>j!==i))}><X className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving} className="gap-1.5">
                <Send className="w-3.5 h-3.5" /> {saving ? "Enviando..." : "Enviar Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de feedbacks */}
      {feedbacks.length === 0 && !showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum feedback enviado ainda</p>
            <p className="text-sm mt-1">Sua opinião é muito importante para nós!</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {feedbacks.map(fb => {
          const cc = CATEGORIA_CFG[fb.categoria] || CATEGORIA_CFG.atendimento;
          const sc = STATUS_CFG[fb.status] || STATUS_CFG.novo;
          const Icon = cc.icon;
          return (
            <Card key={fb.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetail(fb)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${cc.cls} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{fb.titulo}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc.cls}`}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cc.cls}`}>{cc.label}</span>
                      {fb.nota_geral > 0 && (
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= fb.nota_geral ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {fb.created_date ? format(new Date(fb.created_date), "dd/MM/yyyy") : "—"}
                      </span>
                    </div>
                    {fb.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{fb.descricao}</p>}
                    {fb.resposta && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">✅ Resposta da empresa:</p>
                        <p className="text-xs text-emerald-800 line-clamp-2">{fb.resposta}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackDetail({ feedback, onClose, client, onUpdated }) {
  const cc = CATEGORIA_CFG[feedback.categoria] || CATEGORIA_CFG.atendimento;
  const sc = STATUS_CFG[feedback.status] || STATUS_CFG.novo;
  const Icon = cc.icon;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 -ml-1">← Voltar</Button>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${cc.cls} shrink-0`}><Icon className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">{feedback.titulo}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cc.cls}`}>{cc.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                <span className="text-[10px] text-muted-foreground">{feedback.created_date ? format(new Date(feedback.created_date), "dd/MM/yyyy HH:mm") : "—"}</span>
              </div>
            </div>
          </div>

          {feedback.descricao && (
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{feedback.descricao}</p>
            </div>
          )}

          {/* Notas */}
          {(feedback.nota_geral || feedback.nota_atendimento || feedback.nota_entrega || feedback.nota_equipamento) > 0 && (
            <div className="p-3 rounded-xl border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avaliações</p>
              {[
                ["Geral", feedback.nota_geral],
                ["Atendimento", feedback.nota_atendimento],
                ["Entrega", feedback.nota_entrega],
                ["Equipamentos", feedback.nota_equipamento],
              ].filter(([,v]) => v > 0).map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}:</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= val ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {feedback.colaborador_nome && <p className="text-xs text-muted-foreground">👤 Colaborador: <span className="font-medium text-foreground">{feedback.colaborador_nome}</span></p>}
          {feedback.contrato_numero && <p className="text-xs text-muted-foreground">📄 Ref: <span className="font-medium text-foreground">{feedback.contrato_numero}</span></p>}

          {/* Anexos */}
          {(feedback.anexos || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Anexos:</p>
              {feedback.anexos.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Paperclip className="w-3 h-3" /> {a.nome}
                </a>
              ))}
            </div>
          )}

          {/* Resposta da empresa */}
          {feedback.resposta ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Resposta da empresa</p>
              <p className="text-sm text-emerald-900 whitespace-pre-wrap">{feedback.resposta}</p>
              {feedback.respondido_por && (
                <p className="text-[10px] text-emerald-600 mt-1">{feedback.respondido_por} — {feedback.respondido_em ? format(new Date(feedback.respondido_em), "dd/MM/yyyy") : ""}</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Aguardando resposta da empresa</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}