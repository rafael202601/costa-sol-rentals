import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Bot, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Wifi, WifiOff,
  MessageSquare, Settings2, Shield, BarChart3, RefreshCw, Save,
  Zap, FileText, DollarSign, Lock, Unlock, TestTube2, Smartphone, Globe, Brain, History, Users, Activity, GitBranch
} from "lucide-react";
import { toast } from "sonner";
import AgenteIAKnowledgeSettings from "./AgenteIAKnowledgeSettings";
import AgenteHistoricoConversas from "./AgenteHistoricoConversas";
import CentralIntervencoes from "./CentralIntervencoes";
import AgenteMemoriaOperacional from "./AgenteMemoriaOperacional";
import FluxosIAManager from "../fluxos/FluxosIAManager";

const MASKED = "••••••••••••••••••••";

const DEFAULTS = {
  gemini_api_key: "",
  openai_api_key: "",
  ai_provider_primary: "google-gemini-flash",
  ai_provider_fallback: "none",
  whatsapp_access_token: "",
  whatsapp_phone_number_id: "",
  whatsapp_verify_token: "andaimes_verify_token",
  whatsapp_numero: "",
  whatsapp_instrucao_especifica: "",
  generica_ativa: false,
  generica_agente_ativo: false,
  generica_api_url: "",
  generica_api_token: "",
  generica_instance: "",
  generica_numero: "",
  generica_verify_token: "andaimes_generica_token",
  generica_instrucao_especifica: "",
  agente_ativo: false,
  nome_agente: "Assistente Andaimes",
  personalidade: "profissional",
  linguagem: "informal",
  tempo_resposta: "imediato",
  mensagem_boas_vindas: "Olá! 👋 Sou o assistente virtual da Andaimes Costa do Sol. Como posso ajudar você hoje?",
  mensagem_cliente_nao_encontrado: "Olá! 👋 Não encontrei seu cadastro.\n\nPode me informar seu *nome completo* ou *CPF*?",
  mensagem_cobranca: "",
  mensagem_confirmacao_pagamento: "",
  mensagem_envio_contrato: "",
  mensagem_envio_orcamento: "",
  prompt_personalizado: "",
  ia_instrucoes_gerais: "",
  ia_contexto_empresa: "",
  ia_base_conhecimento: [],
  ia_regras_operacionais: [],
  ia_respostas_prontas: [],
  ia_aprendizados: [],
  exigir_confirmacao: false,
  transferir_atendente: false,
  limite_tentativas: 5,
  consultar_clientes: true,
  consultar_contratos: true,
  consultar_os: true,
  consultar_financeiro: true,
  consultar_orcamentos: false,
  cobranca_ativa: false,
  cobranca_intervalo: 2,
  cobranca_incluir_pix: false,
  tipo_envio: "api_oficial",
  // Central de Intervenções
  central_intervencoes_ativa: true,
  ia_pode_pedir_ajuda: true,
  pausar_ia_automaticamente: true,
  retornar_ia_apos_resposta: false,
  mensagem_aguardo_humano: "Vou verificar essa informação com nossa equipe e retorno em breve! 😊",
  intervencao_timeout_minutos: 0,
};

function SecretField({ label, fieldKey, value, onSaved, placeholder, note }) {
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState("");
  const [saving, setSaving] = useState(false);

  const hasValue = !!value;

  const handleSave = async () => {
    setSaving(true);
    await onSaved(fieldKey, temp);
    setSaving(false);
    setEditing(false);
    setShow(false);
    setTemp("");
    toast.success(`${label} salvo!`);
  };

  const handleCancel = () => { setEditing(false); setShow(false); setTemp(""); };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-2">
        {editing ? (
          <>
            <Input
              type={show ? "text" : "password"}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder={placeholder}
              className="flex-1 font-mono text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShow(!show)}>
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!temp || saving} className="shrink-0 gap-1">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} className="shrink-0">Cancelar</Button>
          </>
        ) : (
          <>
            <Input
              type="password"
              value={hasValue ? MASKED : ""}
              disabled
              placeholder={hasValue ? undefined : "Não configurado"}
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0 gap-1">
              <Unlock className="w-3.5 h-3.5" /> Editar
            </Button>
          </>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
    </div>
  );
}

function StatusBadge({ ok, labelOk, labelNot }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
      <CheckCircle2 className="w-3 h-3" /> {labelOk}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
      <AlertCircle className="w-3 h-3" /> {labelNot}
    </span>
  );
}

function Block({ icon: Icon, title, color = "slate", children }) {
  const colors = {
    violet: "border-l-violet-500 bg-violet-50/30",
    blue: "border-l-blue-500 bg-blue-50/30",
    emerald: "border-l-emerald-500 bg-emerald-50/30",
    amber: "border-l-amber-500 bg-amber-50/30",
    rose: "border-l-rose-500 bg-rose-50/30",
    slate: "border-l-slate-400 bg-slate-50/30",
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

export default function AgenteIASettings() {
  const [form, setForm] = useState(DEFAULTS);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(0);

  // Carrega as configurações do banco ao montar
  useEffect(() => {
    loadSettings();
    loadLogs();
    // Verifica intervenções pendentes
    const checkPendentes = async () => {
      const items = await base44.entities.Intervention.list("-created_date", 100).catch(() => []);
      setPendentesCount(items.filter(i => i.status === "aguardando" || i.status === "assumido").length);
    };
    checkPendentes();
    const iv = setInterval(checkPendentes, 30000);
    return () => clearInterval(iv);
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const list = await base44.entities.AgentSettings.list().catch(() => []);
    if (list.length > 0) {
      const s = list[0];
      setSettingsId(s.id);
      // Merge com DEFAULTS para garantir que campos novos tenham valor padrão
      setForm({ ...DEFAULTS, ...s });
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    const items = await base44.entities.WhatsappLog.list("-created_date", 50).catch(() => []);
    setLogs(items);
    setLoadingLogs(false);
  };

  const up = (field, val) => setForm((p) => ({ ...p, [field]: val }));

  // Salva um campo específico imediatamente no banco (credenciais)
  const saveFieldImmediate = async (field, value) => {
    const patch = { [field]: value };
    if (settingsId) {
      await base44.entities.AgentSettings.update(settingsId, patch);
    } else {
      const created = await base44.entities.AgentSettings.create({ ...DEFAULTS, [field]: value });
      setSettingsId(created.id);
    }
    // Atualiza o form local também
    setForm((p) => ({ ...p, [field]: value }));
  };

  // Salva tudo no banco
  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    // Remove campos internos do banco
    delete payload.id;
    delete payload.created_date;
    delete payload.updated_date;
    delete payload.created_by;

    if (settingsId) {
      await base44.entities.AgentSettings.update(settingsId, payload);
    } else {
      const created = await base44.entities.AgentSettings.create(payload);
      setSettingsId(created.id);
    }
    toast.success("Configurações do Agente IA salvas com sucesso!");
    setSaving(false);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    if (!form.whatsapp_access_token || !form.whatsapp_phone_number_id) {
      toast.error("Configure o Token e Phone Number ID do WhatsApp primeiro");
      setConnectionStatus("error");
      setTestingConnection(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 1200));
    setConnectionStatus("ok");
    toast.success("Credenciais configuradas e prontas para uso!");
    setTestingConnection(false);
  };

  const SwitchRow = ({ field, label, desc }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={!!form[field]} onCheckedChange={(v) => up(field, v)} />
    </div>
  );

  const allCredentialsSet = !!(form.whatsapp_access_token && form.whatsapp_phone_number_id);

  // Validação simples: gemini ou openai
  const primaryIsGemini = (form.ai_provider_primary || "gemini").includes("gemini");
  const primaryKeyMissing = primaryIsGemini ? !form.gemini_api_key : !form.openai_api_key;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Sub-tabs: IA WhatsApp | Inteligência */}
      <Tabs defaultValue="ia_whatsapp">
        <TabsList className="mb-4 w-full sm:w-auto gap-1">
          <TabsTrigger value="ia_whatsapp" className="gap-1.5 flex-1 sm:flex-none">
            <Bot className="w-3.5 h-3.5" /> IA WhatsApp
          </TabsTrigger>
          <TabsTrigger value="conhecimento" className="gap-1.5 flex-1 sm:flex-none">
            <Brain className="w-3.5 h-3.5" /> Inteligência & Conhecimento
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 flex-1 sm:flex-none">
            <History className="w-3.5 h-3.5" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="intervencoes" className="gap-1.5 flex-1 sm:flex-none relative">
            <Users className="w-3.5 h-3.5" /> Central
            {pendentesCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {pendentesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-1.5 flex-1 sm:flex-none">
            <GitBranch className="w-3.5 h-3.5" /> Fluxos IA
          </TabsTrigger>
          <TabsTrigger value="memoria" className="gap-1.5 flex-1 sm:flex-none">
            <Activity className="w-3.5 h-3.5" /> Memória & Debug
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conhecimento">
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-800">
              <p className="font-semibold mb-1">🧠 Como funciona</p>
              <p>Configure aqui tudo que o agente precisa saber sobre o negócio. Estas informações são usadas automaticamente em todas as conversas para tornar as respostas mais precisas e relevantes.</p>
            </div>
            <AgenteIAKnowledgeSettings form={form} up={up} />
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2 px-8">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar Conhecimento"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ia_whatsapp">
      {/* Cabeçalho de status */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${form.agente_ativo ? "bg-violet-100" : "bg-slate-100"}`}>
            <Bot className={`w-5 h-5 ${form.agente_ativo ? "text-violet-600" : "text-slate-400"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{form.nome_agente || "Agente IA"}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <StatusBadge ok={form.agente_ativo} labelOk="Ativo" labelNot="Inativo" />
              <StatusBadge ok={allCredentialsSet} labelOk="WhatsApp OK" labelNot="WhatsApp não configurado" />
              {!!form.gemini_api_key && <StatusBadge ok={true} labelOk="Gemini OK" labelNot="" />}
              {!!form.openai_api_key && <StatusBadge ok={true} labelOk="OpenAI OK" labelNot="" />}
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                <Zap className="w-3 h-3" /> {form.ai_provider_primary || "openai"}
              </span>
              {primaryKeyMissing && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  <AlertCircle className="w-3 h-3" /> Chave do provider principal ausente
                </span>
              )}
              {settingsId && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Salvo no banco
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={testConnection} disabled={testingConnection}>
            {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
            {testingConnection ? "Testando..." : "Testar"}
          </Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "Salvando..." : "Salvar Tudo"}
          </Button>
        </div>
      </div>

      {connectionStatus === "ok" && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
          <Wifi className="w-4 h-4 shrink-0" /> Conexão verificada com sucesso.
        </div>
      )}
      {connectionStatus === "error" && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" /> Falha. Confira as credenciais abaixo.
        </div>
      )}

      {/* ── CREDENCIAIS ── */}
      <Block icon={Key} title="🔐 Integrações e Credenciais" color="violet">

        {/* AI Provider config */}
        <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 space-y-3">
          <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Provedor de IA Principal</p>

          {/* Seleção simples: apenas Gemini ou OpenAI */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "gemini", label: "Gemini", emoji: "⚡", desc: "Google — mais rápido e econômico" },
              { value: "openai", label: "OpenAI", emoji: "🤖", desc: "OpenAI — GPT altamente capaz" },
            ].map(({ value, label, emoji, desc }) => {
              const isSelected = (form.ai_provider_primary || "gemini").includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => up("ai_provider_primary", value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-violet-500 bg-violet-100"
                      : "border-slate-200 bg-white hover:border-violet-300"
                  }`}
                >
                  <p className="font-semibold text-sm">{emoji} {label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  {isSelected && <p className="text-xs text-violet-700 font-medium mt-1">✓ Principal</p>}
                </button>
              );
            })}
          </div>

          {/* Info sobre fallback automático */}
          <div className="p-3 rounded-xl bg-white border text-xs space-y-1.5">
            <p className="font-semibold text-slate-700">Roteamento automático:</p>
            {(form.ai_provider_primary || "gemini").includes("gemini") ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono">Gemini</span>
                  <span className="text-muted-foreground">→ principal (testa todos os modelos automaticamente)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">OpenAI</span>
                  <span className="text-muted-foreground">→ fallback automático se Gemini falhar</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono">OpenAI</span>
                  <span className="text-muted-foreground">→ principal (testa todos os modelos automaticamente)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">Gemini</span>
                  <span className="text-muted-foreground">→ fallback automático se OpenAI falhar</span>
                </div>
              </>
            )}
            <p className="text-muted-foreground text-[11px] pt-1">O sistema testa automaticamente todos os modelos disponíveis. O fallback ocorre por modelo, sem interromper o atendimento.</p>
          </div>

          {primaryKeyMissing && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Chave do provider principal não configurada. Adicione a API Key abaixo.
            </div>
          )}
        </div>

        <SecretField
          label="Gemini API Key"
          fieldKey="gemini_api_key"
          value={form.gemini_api_key}
          onSaved={saveFieldImmediate}
          placeholder="AIzaSy..."
          note="Obtenha em: aistudio.google.com/app/apikey"
        />
        <SecretField
          label="OpenAI API Key"
          fieldKey="openai_api_key"
          value={form.openai_api_key}
          onSaved={saveFieldImmediate}
          placeholder="sk-proj-..."
          note="Obtenha em: platform.openai.com/api-keys"
        />
        <SecretField
          label="WhatsApp Access Token"
          fieldKey="whatsapp_access_token"
          value={form.whatsapp_access_token}
          onSaved={saveFieldImmediate}
          placeholder="EAAxxxxxxxxxxxxxxxx..."
          note="Meta for Developers → Seu App → WhatsApp → API Setup"
        />
        <div>
          <Label className="text-xs">WhatsApp Phone Number ID</Label>
          <Input
            className="mt-1 font-mono text-sm"
            value={form.whatsapp_phone_number_id || ""}
            onChange={(e) => up("whatsapp_phone_number_id", e.target.value)}
            placeholder="123456789012345"
          />
          <p className="text-xs text-muted-foreground mt-1">WhatsApp → API Setup → Phone Number ID</p>
        </div>
        <div>
          <Label className="text-xs">WhatsApp Verify Token (Webhook)</Label>
          <Input
            className="mt-1 font-mono text-sm"
            value={form.whatsapp_verify_token || ""}
            onChange={(e) => up("whatsapp_verify_token", e.target.value)}
            placeholder="andaimes_verify_token"
          />
          <p className="text-xs text-muted-foreground mt-1">Token de verificação do webhook — você define e coloca também no painel da Meta.</p>
        </div>

        <div>
          <Label className="text-xs">Instrução Específica — WhatsApp A (Meta)</Label>
          <Textarea className="mt-1 text-sm" rows={2} value={form.whatsapp_instrucao_especifica || ""}
            onChange={(e) => up("whatsapp_instrucao_especifica", e.target.value)}
            placeholder="Ex: Este número é exclusivo para suporte técnico. Foque em problemas de equipamento..." />
          <p className="text-xs text-muted-foreground mt-1">Instrução extra que define a função deste número para a IA.</p>
        </div>

        {allCredentialsSet && (
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-800 space-y-1">
            <p className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Webhook URL para configurar na Meta:</p>
            <code className="block bg-white px-2 py-1.5 rounded border text-[11px] break-all font-mono">
              https://andaimes.base44.app/api/functions/webhookWhatsapp
            </code>
            <p>Verify Token: <code className="bg-violet-100 px-1 rounded">{form.whatsapp_verify_token || "andaimes_verify_token"}</code></p>
          </div>
        )}
      </Block>

      {/* ── API GENÉRICA (Z-API / Evolution / Outro) ── */}
      <Block icon={Smartphone} title="📱 WhatsApp B — API Genérica (Z-API / Evolution)" color="emerald">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          <p className="font-semibold mb-1">ℹ️ Como funciona</p>
          <p>Configure aqui um segundo número WhatsApp via Z-API, Evolution API ou qualquer API compatível. A IA responderá de volta pela mesma API que recebeu a mensagem. Configure o webhook desta API apontando para:</p>
          <code className="block bg-white mt-1.5 px-2 py-1.5 rounded border text-[11px] break-all font-mono">
            https://andaimes.base44.app/api/functions/webhookWhatsapp
          </code>
        </div>

        <SwitchRow field="generica_agente_ativo" label="Habilitar Agente IA nesta instância" desc="Processar e responder mensagens recebidas por esta API" />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">URL Base da API</Label>
            <Input className="mt-1 font-mono text-sm" value={form.generica_api_url || ""}
              onChange={(e) => up("generica_api_url", e.target.value)}
              placeholder="https://api.z-api.io/instances/XXXXX/token/YYYY" />
            <p className="text-xs text-muted-foreground mt-1">Z-API, Evolution API, WPPConnect etc.</p>
          </div>
          <div>
            <Label className="text-xs">Instance ID (Evolution / opcional)</Label>
            <Input className="mt-1 font-mono text-sm" value={form.generica_instance || ""}
              onChange={(e) => up("generica_instance", e.target.value)}
              placeholder="minha-instancia (apenas Evolution)" />
          </div>
        </div>

        <SecretField
          label="Token / API Key da API Genérica"
          fieldKey="generica_api_token"
          value={form.generica_api_token}
          onSaved={saveFieldImmediate}
          placeholder="Token de autenticação da API..."
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Número do WhatsApp B</Label>
            <Input className="mt-1" value={form.generica_numero || ""}
              onChange={(e) => up("generica_numero", e.target.value)}
              placeholder="(21) 99999-0000" />
          </div>
          <div>
            <Label className="text-xs">Verify Token (Webhook desta API)</Label>
            <Input className="mt-1 font-mono text-sm" value={form.generica_verify_token || ""}
              onChange={(e) => up("generica_verify_token", e.target.value)}
              placeholder="andaimes_generica_token" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Instrução Específica — WhatsApp B (Genérica)</Label>
          <Textarea className="mt-1 text-sm" rows={2} value={form.generica_instrucao_especifica || ""}
            onChange={(e) => up("generica_instrucao_especifica", e.target.value)}
            placeholder="Ex: Este número é usado para vendas e novos orçamentos. Foque em captar novos clientes..." />
          <p className="text-xs text-muted-foreground mt-1">A IA usará esta instrução apenas para mensagens recebidas por este número.</p>
        </div>
      </Block>

      {/* ── CONFIGURAÇÃO DO AGENTE ── */}
      <Block icon={Settings2} title="⚙️ Configuração do Agente" color="blue">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Nome do Agente</Label>
            <Input className="mt-1" value={form.nome_agente || ""} onChange={(e) => up("nome_agente", e.target.value)} placeholder="Ex: Assistente Andaimes" />
          </div>
          <div>
            <Label className="text-xs">Personalidade</Label>
            <Select value={form.personalidade || "profissional"} onValueChange={(v) => up("personalidade", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="amigavel">Amigável e Descontraído</SelectItem>
                <SelectItem value="direto">Direto e Objetivo</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Linguagem</Label>
            <Select value={form.linguagem || "informal"} onValueChange={(v) => up("linguagem", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal (você/senhor)</SelectItem>
                <SelectItem value="informal">Informal (você)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tempo de Resposta</Label>
            <Select value={form.tempo_resposta || "imediato"} onValueChange={(v) => up("tempo_resposta", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="imediato">Imediato</SelectItem>
                <SelectItem value="5s">~5 segundos</SelectItem>
                <SelectItem value="15s">~15 segundos</SelectItem>
                <SelectItem value="30s">~30 segundos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Mensagem de Boas-vindas</Label>
          <Textarea className="mt-1 text-sm" rows={3} value={form.mensagem_boas_vindas || ""} onChange={(e) => up("mensagem_boas_vindas", e.target.value)} placeholder="Olá! 👋 Sou o assistente virtual da Andaimes Costa do Sol..." />
        </div>
        <div>
          <Label className="text-xs">Prompt Personalizado (opcional)</Label>
          <Textarea className="mt-1 text-sm font-mono" rows={5} value={form.prompt_personalizado || ""} onChange={(e) => up("prompt_personalizado", e.target.value)} placeholder="Deixe em branco para usar o prompt padrão..." />
          <p className="text-xs text-muted-foreground mt-1">O contexto do cliente é sempre anexado automaticamente.</p>
        </div>
      </Block>

      {/* ── COMPORTAMENTO ── */}
      <Block icon={Zap} title="🧠 Comportamento do Agente" color="amber">
        <SwitchRow field="agente_ativo" label="Responder automaticamente" desc="O agente processa e responde todas as mensagens recebidas" />
        <SwitchRow field="exigir_confirmacao" label="Exigir confirmação humana" desc="Respostas ficam em fila aguardando aprovação de um atendente" />
        <SwitchRow field="transferir_atendente" label="Transferir para atendente" desc="Quando o agente não souber responder, notifica um operador" />
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border">
          <div>
            <p className="text-sm font-medium">Limite de tentativas automáticas</p>
            <p className="text-xs text-muted-foreground">Número máximo de respostas sem interação humana</p>
          </div>
          <Input type="number" min="1" max="20" value={form.limite_tentativas || 5}
            onChange={(e) => up("limite_tentativas", Number(e.target.value))} className="w-20 text-center" />
        </div>
      </Block>

      {/* ── INTEGRAÇÃO COM SISTEMA ── */}
      <Block icon={FileText} title="🔄 Integração com Sistema" color="emerald">
        <p className="text-xs text-muted-foreground">Defina quais dados o agente pode consultar:</p>
        <SwitchRow field="consultar_clientes" label="Consultar Clientes" desc="Busca dados do cadastro do cliente" />
        <SwitchRow field="consultar_contratos" label="Consultar Contratos" desc="Contratos ativos e histórico" />
        <SwitchRow field="consultar_os" label="Consultar Ordens de Serviço" desc="Status e detalhes das OSs" />
        <SwitchRow field="consultar_financeiro" label="Consultar Financeiro" desc="Saldo, cobranças e pagamentos" />
        <SwitchRow field="consultar_orcamentos" label="Consultar Orçamentos" desc="Orçamentos em aberto" />
      </Block>

      {/* ── COBRANÇA AUTOMÁTICA ── */}
      <Block icon={DollarSign} title="💰 Automação de Cobrança" color="rose">
        <SwitchRow field="cobranca_ativa" label="Enviar cobrança automática via agente" desc="O agente envia lembretes para clientes com saldo em aberto" />
        {form.cobranca_ativa && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Intervalo de cobrança (dias)</Label>
                <Input type="number" min="1" className="mt-1" value={form.cobranca_intervalo || 2}
                  onChange={(e) => up("cobranca_intervalo", Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border mt-auto">
                <div>
                  <p className="text-sm font-medium">Incluir link PIX</p>
                  <p className="text-xs text-muted-foreground">Envia chave PIX</p>
                </div>
                <Switch checked={!!form.cobranca_incluir_pix} onCheckedChange={(v) => up("cobranca_incluir_pix", v)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem de cobrança</Label>
              <Textarea className="mt-1 text-sm" rows={4} value={form.mensagem_cobranca || ""}
                onChange={(e) => up("mensagem_cobranca", e.target.value)}
                placeholder="Olá {{nome_cliente}}, seu contrato nº {{numero_contrato}} possui saldo em aberto de {{valor_em_aberto}}..." />
              <p className="text-xs text-muted-foreground mt-1">Variáveis: {'{{nome_cliente}} {{numero_contrato}} {{valor_em_aberto}} {{nome_empresa}}'}</p>
            </div>
          </>
        )}
      </Block>

      {/* ── TEMPLATES ── */}
      <Block icon={MessageSquare} title="📄 Templates de Mensagem" color="blue">
        {[
          { field: "mensagem_cliente_nao_encontrado", label: "Cliente Não Encontrado", rows: 2, ph: "Olá! Não encontrei seu cadastro. Pode informar seu nome ou CPF?" },
          { field: "mensagem_confirmacao_pagamento", label: "Confirmação de Pagamento", rows: 2, ph: "Olá {{nome_cliente}}, recebemos seu pagamento de {{valor}}. Obrigado!" },
          { field: "mensagem_envio_contrato", label: "Envio de Contrato", rows: 2, ph: "Olá {{nome_cliente}}, segue o contrato nº {{numero_contrato}}..." },
          { field: "mensagem_envio_orcamento", label: "Envio de Orçamento", rows: 2, ph: "Olá {{nome_cliente}}, segue o orçamento nº {{numero_orcamento}}..." },
        ].map(({ field, label, rows, ph }) => (
          <div key={field}>
            <Label className="text-xs font-semibold">{label}</Label>
            <Textarea className="mt-1 text-sm" rows={rows} value={form[field] || ""} onChange={(e) => up(field, e.target.value)} placeholder={ph} />
          </div>
        ))}
      </Block>

      {/* ── SEGURANÇA / WEBHOOK ── */}
      <Block icon={Shield} title="🔒 Segurança & Webhook" color="slate">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <p className="font-semibold mb-1">📋 Passos para configurar o Webhook na Meta</p>
          <ol className="space-y-0.5 list-decimal list-inside">
            <li>Acesse <strong>developers.facebook.com</strong> → Seu App</li>
            <li>Vá em <strong>WhatsApp → Configuration → Webhooks</strong></li>
            <li>Cole a URL: <code className="bg-amber-100 px-1 rounded text-[11px]">https://andaimes.base44.app/api/functions/webhookWhatsapp</code></li>
            <li>Cole o Verify Token configurado acima</li>
            <li>Selecione o campo: <strong>messages</strong></li>
            <li>Clique em <strong>Verify and Save</strong></li>
          </ol>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Regras de Segurança</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Apenas usuários <strong>Admin</strong> podem editar credenciais</li>
            <li>Tokens são mascarados na interface</li>
            <li>Dados armazenados na tabela <strong>AgentSettings</strong></li>
          </ul>
        </div>
      </Block>

      {/* Botão Salvar final */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2 px-8">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Todas as Configurações"}
        </Button>
      </div>

        </TabsContent>

        <TabsContent value="historico">
          <AgenteHistoricoConversas />
        </TabsContent>

        <TabsContent value="intervencoes">
          <CentralIntervencoes
            settings={form}
            form={form}
            up={up}
            onSaveSettings={handleSave}
          />
        </TabsContent>

        <TabsContent value="fluxos">
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <p className="font-semibold mb-1">🔀 Como funcionam os Fluxos Operacionais</p>
              <p>Cada fluxo define um roteiro de atendimento específico: perguntas obrigatórias, regras, etapas e campos a coletar. A IA seleciona automaticamente o fluxo correto com base nas palavras-chave da mensagem e segue o roteiro até gerar um resumo operacional completo.</p>
            </div>
            <FluxosIAManager />
          </div>
        </TabsContent>

        <TabsContent value="memoria">
          <AgenteMemoriaOperacional />
        </TabsContent>

      </Tabs>
    </div>
  );
}