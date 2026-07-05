import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Brain, Building2, Shield, MessageSquare, Lightbulb,
  Plus, Trash2, CheckCircle2, XCircle, Save
} from "lucide-react";
import BaseConhecimentoIA from "./BaseConhecimentoIA";

function Section({ icon: Icon, title, color, children }) {
  const colors = {
    violet: "border-l-violet-500 bg-violet-50/40",
    blue: "border-l-blue-500 bg-blue-50/40",
    emerald: "border-l-emerald-500 bg-emerald-50/40",
    amber: "border-l-amber-500 bg-amber-50/40",
    rose: "border-l-rose-500 bg-rose-50/40",
  };
  return (
    <Card className={`border-0 shadow-sm border-l-4 ${colors[color]}`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function AgenteIAKnowledgeSettings({ form, up }) {
  const [novoAprendizado, setNovoAprendizado] = useState("");
  const [novaRespostaTrigger, setNovaRespostaTrigger] = useState("");
  const [novaRespostaTexto, setNovaRespostaTexto] = useState("");

  // ── Aprendizados ──────────────────────────────────────────────────────────
  const aprendizados = form.ia_aprendizados || [];

  const addAprendizado = () => {
    const txt = novoAprendizado.trim();
    if (!txt) return;
    up("ia_aprendizados", [...aprendizados, { id: Date.now(), texto: txt, ativo: true }]);
    setNovoAprendizado("");
  };

  const removeAprendizado = (id) =>
    up("ia_aprendizados", aprendizados.filter((a) => a.id !== id));

  const toggleAprendizado = (id) =>
    up("ia_aprendizados", aprendizados.map((a) => a.id === id ? { ...a, ativo: !a.ativo } : a));

  // ── Respostas prontas ────────────────────────────────────────────────────
  const respostas = form.ia_respostas_prontas || [];

  const addResposta = () => {
    const trigger = novaRespostaTrigger.trim();
    const texto = novaRespostaTexto.trim();
    if (!trigger || !texto) return;
    up("ia_respostas_prontas", [...respostas, { id: Date.now(), trigger, texto, ativo: true }]);
    setNovaRespostaTrigger("");
    setNovaRespostaTexto("");
  };

  const removeResposta = (id) =>
    up("ia_respostas_prontas", respostas.filter((r) => r.id !== id));

  // ── Regras operacionais ──────────────────────────────────────────────────
  const regras = form.ia_regras_operacionais || [];

  const addRegra = (tipo) =>
    up("ia_regras_operacionais", [...regras, { id: Date.now(), tipo, descricao: "", ativo: true }]);

  const updateRegra = (id, field, val) =>
    up("ia_regras_operacionais", regras.map((r) => r.id === id ? { ...r, [field]: val } : r));

  const removeRegra = (id) =>
    up("ia_regras_operacionais", regras.filter((r) => r.id !== id));

  return (
    <div className="space-y-5">

      {/* ── BASE DE CONHECIMENTO ── */}
      <BaseConhecimentoIA
        arquivos={form.ia_base_conhecimento || []}
        onUpdate={(novos) => up("ia_base_conhecimento", novos)}
      />

      {/* ── INSTRUÇÕES GERAIS ── */}
      <Section icon={Brain} title="🧠 Instruções Gerais do Agente" color="violet">
        <p className="text-xs text-muted-foreground">
          Defina como o agente deve se comportar: tom de voz, prioridades, regras gerais de atendimento.
          Estas instruções são sempre enviadas ao agente em todas as conversas.
        </p>
        <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-700 space-y-1">
          <p className="font-semibold">💡 Exemplos de instruções úteis:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li>Sempre responder de forma curta e objetiva</li>
            <li>Nunca fechar contrato automaticamente — sempre pedir confirmação humana</li>
            <li>Pedir o CEP antes de gerar qualquer orçamento</li>
            <li>Usar linguagem informal e amigável</li>
            <li>Informar valores sempre que perguntado</li>
          </ul>
        </div>
        <Textarea
          rows={8}
          value={form.ia_instrucoes_gerais || ""}
          onChange={(e) => up("ia_instrucoes_gerais", e.target.value)}
          placeholder="Ex: Você é um assistente especializado em locação de andaimes e equipamentos de construção civil. Responda sempre de forma clara e direta. Nunca confirme datas de entrega sem verificar com o operacional. Quando o cliente perguntar sobre valores, informe sempre a tabela padrão..."
          className="text-sm font-mono"
        />
      </Section>

      {/* ── CONTEXTO DA EMPRESA ── */}
      <Section icon={Building2} title="🏢 Contexto da Empresa" color="blue">
        <p className="text-xs text-muted-foreground">
          Ensine ao agente tudo sobre o negócio: serviços, equipamentos, regiões atendidas, diferenciais, horários.
        </p>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">💡 O que incluir aqui:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li>Tipo de negócio e especialidades</li>
            <li>Lista de equipamentos disponíveis para locação</li>
            <li>Cidades e regiões atendidas</li>
            <li>Horário de funcionamento</li>
            <li>Endereço e formas de contato</li>
            <li>Diferenciais e condições especiais</li>
          </ul>
        </div>
        <Textarea
          rows={8}
          value={form.ia_contexto_empresa || ""}
          onChange={(e) => up("ia_contexto_empresa", e.target.value)}
          placeholder="Ex: Somos especializados em locação de andaimes tubulares, fachadeiros, escoras, caçambas e equipamentos de construção civil. Atendemos os municípios de Cabo Frio, Búzios, Arraial do Cabo e região. Horário: segunda a sexta das 7h às 17h, sábado das 7h às 12h. Endereço: Rua Alemanha, 98 — Jardim Caiçara..."
          className="text-sm"
        />
      </Section>

      {/* ── REGRAS OPERACIONAIS ── */}
      <Section icon={Shield} title="⚖️ Regras Operacionais" color="amber">
        <p className="text-xs text-muted-foreground">
          Defina o que o agente pode e não pode fazer. Estas regras guiam o comportamento em situações limítrofes.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => addRegra("pode")}
            className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <CheckCircle2 className="w-3.5 h-3.5" /> + Adicionar o que PODE fazer
          </Button>
          <Button variant="outline" size="sm" onClick={() => addRegra("nao_pode")}
            className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50">
            <XCircle className="w-3.5 h-3.5" /> + Adicionar o que NÃO PODE fazer
          </Button>
        </div>

        {regras.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground opacity-60">
            Nenhuma regra definida. Use os botões acima para adicionar.
          </div>
        )}

        <div className="space-y-2">
          {regras.map((r) => (
            <div key={r.id}
              className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                r.tipo === "pode"
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-rose-50/60 border-rose-200"
              }`}
            >
              {r.tipo === "pode"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              }
              <Input
                value={r.descricao}
                onChange={(e) => updateRegra(r.id, "descricao", e.target.value)}
                placeholder={r.tipo === "pode"
                  ? "Ex: Pode gerar orçamento e informar preços"
                  : "Ex: Não pode confirmar entregas sem aprovação do operacional"
                }
                className="flex-1 text-sm bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
              />
              <button onClick={() => removeRegra(r.id)}
                className="shrink-0 p-1 hover:bg-white/80 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── RESPOSTAS PRONTAS ── */}
      <Section icon={MessageSquare} title="💬 Respostas Prontas" color="emerald">
        <p className="text-xs text-muted-foreground">
          Cadastre respostas automáticas para perguntas frequentes. O agente usará essas respostas quando detectar o gatilho.
        </p>

        {/* Adicionar nova */}
        <div className="p-3 rounded-xl border bg-white/80 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Nova resposta pronta:</p>
          <div>
            <Label className="text-xs">Gatilho (palavras-chave ou pergunta)</Label>
            <Input
              value={novaRespostaTrigger}
              onChange={(e) => setNovaRespostaTrigger(e.target.value)}
              placeholder="Ex: horário de funcionamento, que horas abre, quando funciona..."
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Resposta</Label>
            <Textarea
              rows={3}
              value={novaRespostaTexto}
              onChange={(e) => setNovaRespostaTexto(e.target.value)}
              placeholder="Ex: Nosso horário é de segunda a sexta das 7h às 17h e sábado das 7h às 12h. Domingos e feriados fechado."
              className="mt-1 text-sm"
            />
          </div>
          <Button size="sm" onClick={addResposta}
            disabled={!novaRespostaTrigger.trim() || !novaRespostaTexto.trim()}
            className="gap-1.5 w-full">
            <Plus className="w-3.5 h-3.5" /> Adicionar Resposta
          </Button>
        </div>

        {respostas.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground opacity-60">
            Nenhuma resposta pronta cadastrada.
          </div>
        )}

        <div className="space-y-2">
          {respostas.map((r) => (
            <div key={r.id} className="p-3 rounded-xl border bg-white/80 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase mb-0.5">Gatilho</p>
                  <p className="text-xs font-medium text-foreground truncate">{r.trigger}</p>
                </div>
                <button onClick={() => removeResposta(r.id)}
                  className="shrink-0 p-1 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-700 uppercase mb-0.5">Resposta</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{r.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── APRENDIZADOS / MEMÓRIA OPERACIONAL ── */}
      <Section icon={Lightbulb} title="💡 Aprendizados & Memória Operacional" color="rose">
        <p className="text-xs text-muted-foreground">
          Adicione regras, exceções e comportamentos aprendidos com o tempo. Funciona como uma memória viva do agente — edite sempre que identificar uma melhoria.
        </p>

        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1">
          <p className="font-semibold">💡 Exemplos de aprendizados:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li>Clientes costumam chamar andaime fachadeiro de "andaime de fachada"</li>
            <li>Sempre perguntar o CEP antes de calcular frete</li>
            <li>Entrega urgente no mesmo dia tem taxa adicional de R$ 50</li>
            <li>Caçamba no bairro X só pode ser entregue às terças e quintas</li>
          </ul>
        </div>

        {/* Input para novo aprendizado */}
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={novoAprendizado}
            onChange={(e) => setNovoAprendizado(e.target.value)}
            placeholder="Descreva um novo aprendizado, regra ou comportamento..."
            className="text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addAprendizado();
            }}
          />
          <Button size="sm" onClick={addAprendizado}
            disabled={!novoAprendizado.trim()}
            className="shrink-0 self-end gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-2">Ctrl+Enter para salvar rapidamente</p>

        {aprendizados.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground opacity-60">
            Nenhum aprendizado cadastrado ainda.
          </div>
        )}

        <div className="space-y-2">
          {aprendizados.map((a, idx) => (
            <div key={a.id}
              className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all ${
                a.ativo ? "bg-white/80 border-border" : "bg-muted/30 border-border/40 opacity-50"
              }`}
            >
              <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0 text-right">
                {idx + 1}.
              </span>
              <p className="flex-1 text-sm leading-snug">{a.texto}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleAprendizado(a.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-all ${
                    a.ativo
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {a.ativo ? "Ativo" : "Inativo"}
                </button>
                <button onClick={() => removeAprendizado(a.id)}
                  className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}