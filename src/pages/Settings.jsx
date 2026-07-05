import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Building2, CreditCard, FileText, Settings2, Truck, Plus, Trash2, Upload, ImageIcon, MessageSquare, Percent, Bell, PenLine, Smartphone, ShieldCheck, Bot, Webhook } from "lucide-react";
import AgenteIASettings from "../components/settings/AgenteIASettings";
import FiscalSettings from "../components/settings/FiscalSettings";
import AwsWebhookSettings from "../components/settings/AwsWebhookSettings.jsx";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import UserSignatureSetup from "../components/UserSignatureSetup";

const CLAUSULAS_CONTRATO_PADRAO = `CLÁUSULA 1 – OBJETO
A LOCADORA aluga à LOCATÁRIA os equipamentos descritos neste contrato, nas condições aqui estabelecidas.

CLÁUSULA 2 – VALORES
O LOCATÁRIO pagará pela locação dos equipamentos:
Valor diário: {{valor_diaria}}
Valor mínimo: {{valor_minimo}}
Frete: {{valor_frete}}
Desconto: {{valor_desconto}}

CLÁUSULA 3 – PRAZO
O contrato inicia em {{data_inicio}} e termina após a devolução total dos equipamentos e aceite da LOCADORA.
Parágrafo 1: Se ultrapassar {{dias_fechamento}} dias, será feito fechamento automático do período.
Parágrafo 2: Após fechamento, inicia-se novo período de cobrança.

CLÁUSULA 4 – TRANSPORTE
O transporte é de responsabilidade do LOCATÁRIO, salvo quando contratado com a LOCADORA.
O prazo da locação inicia na entrega e encerra na retirada ou solicitação de recolha.

CLÁUSULA 5 – PERDAS E DANOS
Em caso de dano, perda ou uso inadequado, o LOCATÁRIO deverá pagar indenização ou arcar com reparo, sem suspensão da cobrança do aluguel.

CLÁUSULA 6 – SUBLOCAÇÃO
É proibida a sublocação dos equipamentos.

CLÁUSULA 7 – RESCISÃO
Em caso de inadimplência, o contrato será rescindido automaticamente e os equipamentos poderão ser retirados sem aviso prévio.

CLÁUSULA 8 – RESPONSABILIDADE
O LOCATÁRIO é responsável pelos trabalhadores e encargos relacionados ao uso dos equipamentos.

CLÁUSULA 9 – FORO
Fica eleito o foro de {{cidade_empresa}}/{{estado_empresa}} para dirimir quaisquer controvérsias oriundas deste contrato.`;

const CLAUSULAS_FICHA_PADRAO = `TERMO DE VERACIDADE DAS INFORMAÇÕES
Declaro que todas as informações prestadas nesta ficha cadastral são verdadeiras e completas, assumindo total responsabilidade civil e criminal por quaisquer dados inverídicos informados.

AUTORIZAÇÃO DE CONSULTA DE DADOS (LGPD — Lei 13.709/2018)
Autorizo a empresa a consultar, armazenar e tratar meus dados pessoais para fins de análise de crédito, cobrança e prestação de serviços, em conformidade com a Lei Geral de Proteção de Dados Pessoais.

TERMO DE RESPONSABILIDADE
Declaro estar ciente de que sou responsável pela guarda e bom uso dos equipamentos locados, comprometendo-me a ressarcir quaisquer danos ou perdas conforme contrato firmado.

AUTORIZAÇÃO FINANCEIRA
Autorizo a emissão de cobranças, boletos e demais documentos financeiros referentes aos contratos e ordens de serviço vinculados a este cadastro.`;

const CLAUSULAS_ORCAMENTO_PADRAO = `PROPOSTA COMERCIAL — CONDIÇÕES GERAIS

1. VALIDADE DA PROPOSTA
Este orçamento tem validade conforme data indicada. Após o vencimento, os valores estão sujeitos a alteração sem aviso prévio.

2. VALORES
Valor da diária da locação: {{valor_diaria}}
Valor mínimo de locação: {{valor_minimo}}
Frete (estimado): {{valor_frete}}
Valor total estimado: {{valor_total}}

3. PERÍODO DE LOCAÇÃO
O prazo inicia na data de entrega dos equipamentos e encerra na retirada total confirmada pela LOCADORA.
Os valores acima são estimados com base no período solicitado.

4. FRETE
O frete indicado é uma estimativa. O valor definitivo será confirmado no ato da contratação, conforme local de entrega.

5. CONDIÇÕES DE PAGAMENTO
O pagamento deverá ser realizado conforme condições combinadas no ato da aprovação deste orçamento.

6. APROVAÇÃO
A aprovação deste orçamento implica na aceitação de todas as condições aqui descritas e gera um contrato formal de locação.

7. OBSERVAÇÕES
Este documento é uma proposta comercial e não constitui contrato. O contrato formal será emitido após aprovação e confirmação das condições.`;

const CLAUSULAS_OS_PADRAO = `1. EXECUÇÃO
O serviço será executado conforme solicitado nesta Ordem de Serviço.

2. RESPONSABILIDADE
O cliente é responsável pelo uso correto dos equipamentos no local de entrega.

3. PRAZO
O serviço será realizado conforme a data e horário acordados.

4. PAGAMENTO
O pagamento deverá ser realizado conforme condições combinadas no ato da contratação.`;

const DEFAULTS = {
  nome_social: "", nome_fantasia: "Andaimes Costa do Sol", cnpj: "",
  credito_provedor: "serasa", credito_api_token: "", credito_ambiente: "sandbox",
  credito_bloquear_negativado: false,
  inscricao_estadual: "", inscricao_municipal: "",
  endereco: "Rua Alemanha 98, Jardim Caiçara", telefone: "", email: "",
  logo_url: "",
  chave_pix: "", banco: "", agencia: "", conta: "",
  valor_por_km: 3.5, valor_minimo_contrato: 0, minimo_dias: 5, intervalo_cobranca: 2,
  tipo_calculo_frete: "manual",
  tabela_frete_bairros: [],
  clausulas_contrato: CLAUSULAS_CONTRATO_PADRAO,
  clausulas_orcamento: CLAUSULAS_ORCAMENTO_PADRAO,
  clausulas_os: CLAUSULAS_OS_PADRAO,
  clausulas_ficha_cadastral: CLAUSULAS_FICHA_PADRAO,
  mensagem_whatsapp_contrato: "Olá {{nome_cliente}}, segue o contrato nº {{numero_contrato}} no valor de {{valor_total}}. Prazo: {{data_fim}}. {{nome_empresa}}.",
  mensagem_whatsapp_cobranca: "Olá {{nome_cliente}}, o saldo devedor do contrato nº {{numero_contrato}} é de {{valor_total}}. Por favor, regularize o pagamento. {{nome_empresa}}.",
  regras_desconto_tempo: [],
  cobranca_automatica_ativa: false,
  cobranca_intervalo_dias: 2,
  cobranca_valor_minimo: 0,
  cobranca_canal: "whatsapp",
  cobranca_horario: "09:00",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_api_remetente: "",
  nfse_ativa: false,
  nfse_municipio: "", nfse_codigo_municipio: "", nfse_inscricao_municipal: "",
  nfse_codigo_servico: "", nfse_descricao_servico: "Locação de andaimes e equipamentos de construção civil.",
  nfse_usuario: "", nfse_senha: "", nfse_ambiente: "homologacao",
  boleto_ativa: false,
  boleto_banco: "", boleto_agencia: "", boleto_conta: "", boleto_carteira: "",
  boleto_convenio: "", boleto_api_url: "", boleto_api_token: "",
  mensagem_whatsapp_os: "Olá {{nome_cliente}}, segue a OS nº {{numero_contrato}}. {{nome_empresa}}.",
  // IA WhatsApp Agent
  ia_whatsapp_ativa: false,
  ia_openai_api_key: "",
  ia_whatsapp_token: "",
  ia_whatsapp_phone_id: "",
  ia_whatsapp_verify_token: "andaimes_verify_token",
  ia_whatsapp_numero: "",
  ia_tipo_envio: "api_oficial",
  ia_nome_agente: "Assistente Andaimes",
  ia_personalidade: "profissional",
  ia_linguagem: "informal",
  ia_tempo_resposta: "imediato",
  ia_mensagem_boas_vindas: "Olá! 👋 Sou o assistente virtual da Andaimes Costa do Sol. Como posso ajudar você hoje?",
  ia_mensagem_cliente_nao_encontrado: "Olá! 👋 Não encontrei seu cadastro em nosso sistema.\n\nPode me informar seu *nome completo* ou *CPF* para que eu possa te ajudar?",
  ia_mensagem_cobranca: "",
  ia_mensagem_confirmacao_pagamento: "",
  ia_mensagem_envio_contrato: "",
  ia_mensagem_envio_orcamento: "",
  ia_prompt_personalizado: "",
  ia_exigir_confirmacao: false,
  ia_transferir_atendente: false,
  ia_limite_tentativas: 5,
  ia_consultar_clientes: true,
  ia_consultar_contratos: true,
  ia_consultar_os: true,
  ia_consultar_financeiro: true,
  ia_consultar_orcamentos: false,
  ia_cobranca_ativa: false,
  ia_cobranca_intervalo: 2,
  ia_cobranca_incluir_pix: false,
};

export default function Settings() {
  const [form, setForm] = useState(DEFAULTS);
  const [settingsId, setSettingsId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.CompanySettings.list().then((list) => {
      if (list.length > 0) {
        const s = list[0];
        setSettingsId(s.id);
        // Merge: campos do banco sobrescrevem os defaults (incluindo strings vazias)
        setForm((p) => {
          const u = { ...p };
          // Itera chaves do banco para pegar TODOS os campos salvos, não apenas os do DEFAULTS
          Object.keys(s).forEach((k) => {
            if (k !== 'id' && k !== 'created_date' && k !== 'updated_date' && k !== 'created_by' && s[k] !== undefined && s[k] !== null) {
              u[k] = s[k];
            }
          });
          if (!u.tabela_frete_bairros) u.tabela_frete_bairros = [];
          return u;
        });
      }
    });
  }, []);

  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (settingsId) {
      await base44.entities.CompanySettings.update(settingsId, form);
    } else {
      const created = await base44.entities.CompanySettings.create(form);
      setSettingsId(created.id);
    }
    toast.success("Configurações salvas!");
    setSaving(false);
  };

  const Field = ({ label, field, type = "text", placeholder = "", note = "" }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={form[field] ?? ""}
        onChange={(e) => update(field, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
    </div>
  );

  // Tabela frete por bairro
  const addBairro = () => update("tabela_frete_bairros", [...(form.tabela_frete_bairros || []), { local: "", valor: 0 }]);
  const updateBairro = (i, field, val) => {
    const t = [...(form.tabela_frete_bairros || [])];
    t[i] = { ...t[i], [field]: val };
    update("tabela_frete_bairros", t);
  };
  const removeBairro = (i) => update("tabela_frete_bairros", (form.tabela_frete_bairros || []).filter((_, idx) => idx !== i));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update("logo_url", file_url);
    setUploadingLogo(false);
    toast.success("Logo enviada!");
  };

  const isAdmin = currentUser?.role === "admin";

  // Não-admins veem apenas a aba Minha Assinatura
  if (currentUser && !isAdmin) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Gerencie sua assinatura digital" />
        <div className="max-w-2xl">
          <UserSignatureSetup />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Dados da empresa e parâmetros do sistema">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </PageHeader>

      <Tabs defaultValue="empresa" className="max-w-3xl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="empresa" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />Empresa</TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" />Pagamentos</TabsTrigger>
          <TabsTrigger value="frete" className="gap-1.5"><Truck className="w-3.5 h-3.5" />Frete</TabsTrigger>
          <TabsTrigger value="clausulas" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Cláusulas</TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" />Parâmetros</TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Mensagens</TabsTrigger>
          <TabsTrigger value="descontos" className="gap-1.5"><Percent className="w-3.5 h-3.5" />Descontos</TabsTrigger>
          <TabsTrigger value="cobranca" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Cobrança Auto.</TabsTrigger>
          <TabsTrigger value="minha_assinatura" className="gap-1.5"><PenLine className="w-3.5 h-3.5" />Minha Assinatura</TabsTrigger>
          <TabsTrigger value="whatsapp_api" className="gap-1.5"><Smartphone className="w-3.5 h-3.5" />WhatsApp API</TabsTrigger>
          <TabsTrigger value="credito" className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Análise de Crédito</TabsTrigger>
          <TabsTrigger value="ia_agente" className="gap-1.5"><Bot className="w-3.5 h-3.5" />Agente IA</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Fiscal / NFS-e</TabsTrigger>
          <TabsTrigger value="aws_webhook" className="gap-1.5"><Webhook className="w-3.5 h-3.5" />Conexão AWS</TabsTrigger>
        </TabsList>

        {/* EMPRESA */}
        <TabsContent value="empresa">
          <div className="space-y-4">
            {/* Logo */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Logo da Empresa</CardTitle></CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">A logo será exibida em todos os PDFs gerados (contratos, recibos, orçamentos e OSs).</p>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="w-4 h-4" />
                      {uploadingLogo ? "Enviando..." : "Selecionar Logo"}
                    </span>
                  </label>
                  {form.logo_url && (
                    <button onClick={() => update("logo_url", "")} className="text-xs text-destructive hover:underline block">
                      Remover logo
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Dados da Empresa</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <Field label="Razão Social" field="nome_social" />
                <Field label="Nome Fantasia" field="nome_fantasia" />
                <Field label="CNPJ" field="cnpj" placeholder="00.000.000/0001-00" />
                <Field label="Inscrição Estadual" field="inscricao_estadual" />
                <Field label="Inscrição Municipal" field="inscricao_municipal" />
                <Field label="Telefone" field="telefone" />
                <Field label="E-mail" field="email" type="email" />
                <div className="sm:col-span-2">
                  <Label className="text-xs">Endereço (Origem para cálculo de frete)</Label>
                  <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PAGAMENTOS */}
        <TabsContent value="pagamentos">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-heading">Dados de Pagamento</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs">Chave PIX</Label>
                <Input value={form.chave_pix} onChange={(e) => update("chave_pix", e.target.value)} className="mt-1" placeholder="CPF, CNPJ, email, telefone ou chave aleatória" />
              </div>
              <Field label="Banco" field="banco" />
              <Field label="Agência" field="agencia" />
              <Field label="Conta" field="conta" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* FRETE */}
        <TabsContent value="frete">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Tipo de Cálculo de Frete</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { k: "manual", l: "Manual", desc: "Valor inserido livremente no contrato", icon: "✏️" },
                    { k: "por_km", l: "Por KM", desc: "Calcula com base na distância × valor/km", icon: "📏" },
                    { k: "por_bairro", l: "Por Bairro/Cidade", desc: "Tabela fixa por localidade", icon: "📍" },
                  ].map(({ k, l, desc, icon }) => (
                    <button key={k} type="button" onClick={() => update("tipo_calculo_frete", k)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${form.tipo_calculo_frete === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="text-2xl mb-1">{icon}</div>
                      <p className="text-sm font-semibold">{l}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </button>
                  ))}
                </div>

                {form.tipo_calculo_frete === "por_km" && (
                  <div className="p-4 rounded-xl bg-muted/40 space-y-3">
                    <p className="text-xs font-semibold">Configuração — Por KM</p>
                    <div>
                      <Label className="text-xs">Origem fixa (endereço da empresa)</Label>
                      <Input value={form.endereco} disabled className="mt-1 bg-muted" />
                    </div>
                    <Field label="Valor por KM (R$)" field="valor_por_km" type="number" note="Ida e volta é calculado automaticamente (×2)" />
                  </div>
                )}
              </CardContent>
            </Card>

            {form.tipo_calculo_frete === "por_bairro" && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-heading">Tabela de Frete por Bairro/Cidade</CardTitle>
                  <Button variant="outline" size="sm" onClick={addBairro} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(form.tabela_frete_bairros || []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum local cadastrado</p>
                  )}
                  {(form.tabela_frete_bairros || []).map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Bairro ou Cidade"
                        value={item.local || ""}
                        onChange={(e) => updateBairro(i, "local", e.target.value)}
                        className="flex-1"
                      />
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="R$"
                          value={item.valor || ""}
                          onChange={(e) => updateBairro(i, "valor", Number(e.target.value))}
                        />
                      </div>
                      <button onClick={() => removeBairro(i)} className="p-2 hover:bg-red-50 rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* CLÁUSULAS */}
        <TabsContent value="clausulas">
          <div className="space-y-4">
            {/* Variáveis dinâmicas */}
            <Card className="border-0 shadow-sm bg-blue-50 border-blue-100">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">Variáveis Dinâmicas — use nos textos das cláusulas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "{{nome_cliente}}", "{{cpf_cnpj}}", "{{codigo_cliente}}",
                    "{{nome_empresa}}", "{{cnpj_empresa}}", "{{endereco_empresa}}", "{{telefone_empresa}}",
                    "{{numero_contrato}}", "{{numero_orcamento}}", "{{cliente_nome}}",
                    "{{data_inicio}}", "{{data_fim}}", "{{usuario_criador}}",
                    "{{valor_diaria}}", "{{valor_minimo}}", "{{valor_frete}}", "{{valor_desconto}}", "{{valor_total}}",
                    "{{dias_fechamento}}", "{{cidade_empresa}}", "{{estado_empresa}}",
                  ].map((v) => (
                    <code key={v} className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-800 font-mono">{v}</code>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-heading">Cláusulas — Contratos</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Utilizadas nos PDFs de contratos de locação</p>
                </div>
                <button
                  onClick={() => update("clausulas_contrato", CLAUSULAS_CONTRATO_PADRAO)}
                  className="text-xs text-primary hover:underline shrink-0 mt-1"
                >
                  Restaurar padrão
                </button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.clausulas_contrato || ""}
                  onChange={(e) => update("clausulas_contrato", e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  placeholder="Digite as cláusulas do contrato..."
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm border-l-4 border-l-emerald-400">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Cláusulas — Orçamentos
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Utilizadas nos PDFs de orçamentos. Independentes das cláusulas do contrato.</p>
                </div>
                <button
                  onClick={() => update("clausulas_orcamento", CLAUSULAS_ORCAMENTO_PADRAO)}
                  className="text-xs text-primary hover:underline shrink-0 mt-1"
                >
                  Restaurar padrão
                </button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <p className="font-semibold mb-1">Variáveis disponíveis para o orçamento:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {["{{valor_diaria}}", "{{valor_minimo}}", "{{valor_frete}}", "{{valor_total}}", "{{cliente_nome}}", "{{numero_orcamento}}"].map(v => (
                      <code key={v} className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-xs font-mono">{v}</code>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={form.clausulas_orcamento || ""}
                  onChange={(e) => update("clausulas_orcamento", e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  placeholder="Digite as cláusulas do orçamento..."
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-heading">Cláusulas — Ordens de Serviço</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Utilizadas nos PDFs de ordens de serviço</p>
                </div>
                <button
                  onClick={() => update("clausulas_os", CLAUSULAS_OS_PADRAO)}
                  className="text-xs text-primary hover:underline shrink-0 mt-1"
                >
                  Restaurar padrão
                </button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.clausulas_os || ""}
                  onChange={(e) => update("clausulas_os", e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="Digite as cláusulas das OSs..."
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm border-l-4 border-l-violet-400">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                    Cláusulas — Ficha Cadastral
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aparecem no final do PDF da Ficha Cadastral, antes da assinatura. Suporte a múltiplos termos (LGPD, responsabilidade, etc.).
                  </p>
                </div>
                <button
                  onClick={() => update("clausulas_ficha_cadastral", CLAUSULAS_FICHA_PADRAO)}
                  className="text-xs text-primary hover:underline shrink-0 mt-1"
                >
                  Restaurar padrão
                </button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-800">
                  <p className="font-semibold mb-1">📋 Termos suportados nesta cláusula:</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>Termo de veracidade das informações</li>
                    <li>Autorização de consulta de dados (LGPD)</li>
                    <li>Termo de responsabilidade</li>
                    <li>Autorização financeira</li>
                  </ul>
                  <p className="mt-2">Separe os termos por linha em branco. O texto abaixo aparece <strong>antes da assinatura</strong> no PDF.</p>
                </div>
                <Textarea
                  value={form.clausulas_ficha_cadastral || ""}
                  onChange={(e) => update("clausulas_ficha_cadastral", e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  placeholder="Digite os termos e cláusulas da ficha cadastral..."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MENSAGENS */}
        <TabsContent value="mensagens">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-blue-50 border-blue-100">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["{{nome_cliente}}", "{{numero_contrato}}", "{{valor_total}}", "{{data_fim}}", "{{nome_empresa}}"].map((v) => (
                    <code key={v} className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-800 font-mono">{v}</code>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Mensagem WhatsApp — Contrato</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={form.mensagem_whatsapp_contrato || ""}
                  onChange={(e) => update("mensagem_whatsapp_contrato", e.target.value)}
                  rows={4}
                  placeholder="Mensagem enviada ao compartilhar o contrato..."
                  className="text-sm"
                />
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Mensagem WhatsApp — Cobrança</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={form.mensagem_whatsapp_cobranca || ""}
                  onChange={(e) => update("mensagem_whatsapp_cobranca", e.target.value)}
                  rows={4}
                  placeholder="Mensagem enviada para cobranças..."
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DESCONTOS POR TEMPO */}
        <TabsContent value="descontos">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">Como funciona</p>
                <p className="text-xs text-blue-600">
                  Defina faixas de desconto automático baseadas no tempo de locação. O sistema identifica a faixa mais alta aplicável e aplica o desconto automaticamente no contrato.
                  Ordenado automaticamente pela maior faixa que se aplicar ao número de dias do contrato.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-heading">Regras de Desconto por Tempo</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Desconto aplicado automaticamente conforme dias de locação</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const regs = [...(form.regras_desconto_tempo || []), { dias_minimos: 0, tipo: "percentual", valor: 0 }];
                  update("regras_desconto_tempo", regs);
                }} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar faixa
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(form.regras_desconto_tempo || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra cadastrada. Clique em "Adicionar faixa" para começar.</p>
                )}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted-foreground px-1 mb-1">
                  <span>Dias mínimos</span>
                  <span>Tipo</span>
                  <span>Valor desconto</span>
                  <span></span>
                </div>
                {(form.regras_desconto_tempo || [])
                  .sort((a, b) => (a.dias_minimos || 0) - (b.dias_minimos || 0))
                  .map((reg, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Ex: 7"
                        value={reg.dias_minimos || ""}
                        onChange={(e) => {
                          const regs = [...(form.regras_desconto_tempo || [])];
                          regs[i] = { ...regs[i], dias_minimos: Number(e.target.value) };
                          update("regras_desconto_tempo", regs);
                        }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                    <Select value={reg.tipo || "percentual"} onValueChange={(v) => {
                      const regs = [...(form.regras_desconto_tempo || [])];
                      regs[i] = { ...regs[i], tipo: v };
                      update("regras_desconto_tempo", regs);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentual">% Percentual</SelectItem>
                        <SelectItem value="fixo">R$ Fixo</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={reg.tipo === "percentual" ? "Ex: 10" : "Ex: 50.00"}
                        value={reg.valor || ""}
                        onChange={(e) => {
                          const regs = [...(form.regras_desconto_tempo || [])];
                          regs[i] = { ...regs[i], valor: Number(e.target.value) };
                          update("regras_desconto_tempo", regs);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">{reg.tipo === "percentual" ? "%" : "R$"}</span>
                    </div>
                    <button onClick={() => {
                      update("regras_desconto_tempo", (form.regras_desconto_tempo || []).filter((_, idx) => idx !== i));
                    }} className="p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COBRANÇA AUTOMÁTICA */}
        <TabsContent value="cobranca">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-amber-50 border-amber-100">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">ℹ️ Como funciona</p>
                <p className="text-xs text-amber-700">
                  O sistema envia avisos automáticos de cobrança para clientes com saldo em aberto.
                  Configure o intervalo, valor mínimo e canal de envio. A cobrança pode ser pausada por contrato individualmente.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Configuração de Cobrança Automática</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {/* Ativar/desativar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                  <div>
                    <p className="text-sm font-medium">Ativar cobrança automática</p>
                    <p className="text-xs text-muted-foreground">Envia notificações automáticas para clientes com saldo em aberto</p>
                  </div>
                  <Switch
                    checked={!!form.cobranca_automatica_ativa}
                    onCheckedChange={(v) => update("cobranca_automatica_ativa", v)}
                  />
                </div>

                {form.cobranca_automatica_ativa && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Intervalo de envio (dias)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.cobranca_intervalo_dias ?? ""}
                          onChange={(e) => update("cobranca_intervalo_dias", Number(e.target.value))}
                          className="mt-1"
                          placeholder="Ex: 2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Envia a cada X dias para o mesmo contrato</p>
                      </div>
                      <div>
                        <Label className="text-xs">Valor mínimo para cobrança (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.cobranca_valor_minimo ?? ""}
                          onChange={(e) => update("cobranca_valor_minimo", Number(e.target.value))}
                          className="mt-1"
                          placeholder="Ex: 50.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Não envia se o saldo for menor que este valor</p>
                      </div>
                      <div>
                        <Label className="text-xs">Canal de envio</Label>
                        <Select value={form.cobranca_canal || "whatsapp"} onValueChange={(v) => update("cobranca_canal", v)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Horário de envio</Label>
                        <Input
                          type="time"
                          value={form.cobranca_horario || "09:00"}
                          onChange={(e) => update("cobranca_horario", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Mensagem de cobrança</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Variáveis: <code className="bg-muted px-1 rounded">{"{{nome_cliente}}"}</code>{" "}
                        <code className="bg-muted px-1 rounded">{"{{numero_contrato}}"}</code>{" "}
                        <code className="bg-muted px-1 rounded">{"{{valor_em_aberto}}"}</code>{" "}
                        <code className="bg-muted px-1 rounded">{"{{data_atual}}"}</code>{" "}
                        <code className="bg-muted px-1 rounded">{"{{dias_em_aberto}}"}</code>{" "}
                        <code className="bg-muted px-1 rounded">{"{{nome_empresa}}"}</code>
                      </p>
                      <Textarea
                        value={form.mensagem_whatsapp_cobranca || ""}
                        onChange={(e) => update("mensagem_whatsapp_cobranca", e.target.value)}
                        rows={5}
                        placeholder={`Olá, {{nome_cliente}}!\n\nSeu contrato nº {{numero_contrato}} possui um valor em aberto de {{valor_em_aberto}}.\n\nPor favor, regularize o pagamento. Obrigado!`}
                        className="text-sm mt-1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MINHA ASSINATURA */}
        <TabsContent value="minha_assinatura">
          <UserSignatureSetup />
        </TabsContent>

        {/* WHATSAPP API */}
        <TabsContent value="whatsapp_api">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-emerald-50 border-emerald-100">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1">📱 Integração com API WhatsApp</p>
                <p className="text-xs text-emerald-700">
                  Configure sua API do WhatsApp (ex: Z-API, Evolution API, WPPConnect, Twilio etc.) para enviar PDFs automaticamente com anexo.
                  Se não configurado, o sistema usa o WhatsApp Web (navegador).
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Configurações da API</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">URL da API *</Label>
                  <Input
                    className="mt-1"
                    value={form.whatsapp_api_url || ""}
                    onChange={(e) => update("whatsapp_api_url", e.target.value)}
                    placeholder="https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-document/url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Endpoint da API que recebe os envios. Deve aceitar POST com JSON.</p>
                </div>
                <div>
                  <Label className="text-xs">Token de Autenticação</Label>
                  <Input
                    className="mt-1"
                    type="password"
                    value={form.whatsapp_api_token || ""}
                    onChange={(e) => update("whatsapp_api_token", e.target.value)}
                    placeholder="Bearer token ou API Key..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Será enviado no header Authorization: Bearer {"{token}"}.</p>
                </div>
                <div>
                  <Label className="text-xs">Número Remetente (opcional)</Label>
                  <Input
                    className="mt-1"
                    value={form.whatsapp_api_remetente || ""}
                    onChange={(e) => update("whatsapp_api_remetente", e.target.value)}
                    placeholder="5511999999999"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Número que envia as mensagens (com DDI). Deixe em branco se a API não precisar.</p>
                </div>

                {(form.whatsapp_api_url && form.whatsapp_api_token) ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    API configurada — o botão "Enviar WhatsApp" nos contratos e OSs oferecerá envio via API com anexo automático.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Não configurada — o sistema usará o WhatsApp Web (o usuário anexa manualmente o PDF).
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Mensagem para OS</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Variáveis: <code className="bg-muted px-1 rounded">{"{{nome_cliente}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{numero_contrato}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{valor_total}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{nome_empresa}}"}</code>
                </p>
                <Textarea
                  value={form.mensagem_whatsapp_os || ""}
                  onChange={(e) => update("mensagem_whatsapp_os", e.target.value)}
                  rows={4}
                  placeholder="Olá {{nome_cliente}}, segue a OS nº {{numero_contrato}}. {{nome_empresa}}."
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ANÁLISE DE CRÉDITO */}
        <TabsContent value="credito">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-blue-50 border-blue-100">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">ℹ️ Análise de Crédito Externa (SPC/Serasa)</p>
                <p className="text-xs text-blue-700">
                  Consultas de SPC/Serasa são serviços pagos que exigem contrato com o provedor (Serasa Experian, Boa Vista SCPC, Quod, etc.).
                  Configure aqui sua API Key para habilitar consultas automáticas ao cadastrar clientes.
                  Sem configuração, apenas o score interno estará disponível.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Configuração da API de Crédito</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Provedor</Label>
                    <Select value={form.credito_provedor || "serasa"} onValueChange={(v) => update("credito_provedor", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serasa">Serasa Experian</SelectItem>
                        <SelectItem value="boavista">Boa Vista (SCPC)</SelectItem>
                        <SelectItem value="quod">Quod</SelectItem>
                        <SelectItem value="spc">SPC Brasil</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ambiente</Label>
                    <Select value={form.credito_ambiente || "sandbox"} onValueChange={(v) => update("credito_ambiente", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Token / API Key *</Label>
                  <Input
                    type="password"
                    className="mt-1"
                    value={form.credito_api_token || ""}
                    onChange={(e) => update("credito_api_token", e.target.value)}
                    placeholder="Insira o token fornecido pelo provedor..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Obtenha no painel do seu provedor de consulta de crédito.</p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                  <div>
                    <p className="text-sm font-medium">Bloquear contratos com cliente negativado</p>
                    <p className="text-xs text-muted-foreground">Se ativo, impede criação de novos contratos para clientes com restrição</p>
                  </div>
                  <Switch
                    checked={!!form.credito_bloquear_negativado}
                    onCheckedChange={(v) => update("credito_bloquear_negativado", v)}
                  />
                </div>

                {form.credito_api_token ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    API configurada — consultas de crédito habilitadas no cadastro de clientes.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Sem configuração — apenas score interno disponível.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-heading">Score Interno de Clientes</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Calculado automaticamente com base no histórico de pagamentos</p>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-700 uppercase">Aumenta pontuação</p>
                    <div className="space-y-1">
                      {[
                        { label: "Pagamento antecipado", pts: "+10" },
                        { label: "Pagamento no prazo", pts: "+5" },
                        { label: "Cliente recorrente", pts: "+5" },
                      ].map((r) => (
                        <div key={r.label} className="flex justify-between items-center p-2 rounded-lg bg-emerald-50">
                          <span className="text-xs text-emerald-800">{r.label}</span>
                          <span className="text-xs font-bold text-emerald-700">{r.pts} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700 uppercase">Reduz pontuação</p>
                    <div className="space-y-1">
                      {[
                        { label: "Atraso até 5 dias", pts: "-10" },
                        { label: "Atraso 6–15 dias", pts: "-20" },
                        { label: "Atraso +15 dias", pts: "-40" },
                        { label: "Negativado Serasa", pts: "-50" },
                      ].map((r) => (
                        <div key={r.label} className="flex justify-between items-center p-2 rounded-lg bg-red-50">
                          <span className="text-xs text-red-800">{r.label}</span>
                          <span className="text-xs font-bold text-red-700">{r.pts} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { range: "80–100", label: "Excelente", limit: "R$ 10.000", cls: "bg-emerald-50 border-emerald-200 text-emerald-700 text-emerald-600" },
                    { range: "60–79", label: "Bom", limit: "R$ 5.000", cls: "bg-blue-50 border-blue-200 text-blue-700 text-blue-600" },
                    { range: "40–59", label: "Regular", limit: "R$ 2.000", cls: "bg-amber-50 border-amber-200 text-amber-700 text-amber-600" },
                    { range: "0–39", label: "Alto Risco", limit: "R$ 0", cls: "bg-red-50 border-red-200 text-red-700 text-red-600" },
                  ].map((c, i) => {
                    const [bg, border, txtStrong, txtLight] = c.cls.split(" ");
                    return (
                    <div key={c.range} className={`p-2 rounded-lg text-center text-xs border ${bg} ${border}`}>
                      <p className={`font-bold ${txtStrong}`}>{c.range}</p>
                      <p className={txtLight}>{c.label}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">Limite: {c.limit}</p>
                    </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AGENTE IA WHATSAPP */}
        <TabsContent value="ia_agente">
          <AgenteIASettings />
        </TabsContent>

        {/* FISCAL / NFS-e */}
        <TabsContent value="fiscal">
          <FiscalSettings form={form} update={update} onSave={handleSave} saving={saving} />
        </TabsContent>

        {/* CONEXÃO AWS / WEBHOOK PRÓPRIO */}
        <TabsContent value="aws_webhook">
          <AwsWebhookSettings />
        </TabsContent>

        {/* PARÂMETROS */}
        <TabsContent value="parametros">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading">Parâmetros Operacionais</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                A regra de dias mínimos é configurada individualmente em cada equipamento (Cadastro → Equipamentos).
              </p>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label="Valor Mínimo de Contrato (R$)" field="valor_minimo_contrato" type="number" note="Valor total mínimo a ser cobrado por contrato" />
              <Field label="Valor por KM (R$)" field="valor_por_km" type="number" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}