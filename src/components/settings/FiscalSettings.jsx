import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building2, AlertCircle, CheckCircle2, Landmark } from "lucide-react";

const BANCOS = [
  "Itaú", "Bradesco", "Banco do Brasil", "Caixa Econômica Federal",
  "Santander", "Sicoob", "Sicredi", "Nubank", "Inter", "Outro"
];

function Block({ icon: Icon, title, color, children }) {
  const border = {
    blue: "border-l-blue-500",
    emerald: "border-l-emerald-500",
    violet: "border-l-violet-500",
    amber: "border-l-amber-500",
  }[color] || "border-l-slate-400";
  return (
    <Card className={`border-0 shadow-sm border-l-4 ${border}`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, field, form, update, type = "text", placeholder = "", note = "" }) {
  return (
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
}

export default function FiscalSettings({ form, update, onSave, saving }) {
  const nfseOk = form.nfse_municipio && form.nfse_inscricao_municipal && form.nfse_usuario && form.nfse_senha;
  const boletoOk = form.boleto_banco && form.boleto_agencia && form.boleto_conta && form.boleto_api_token;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── NFS-e ── */}
      <Block icon={Building2} title="🏛️ NFS-e — Integração com Prefeitura" color="blue">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border">
          <div>
            <p className="text-sm font-medium">Ativar emissão de NFS-e</p>
            <p className="text-xs text-muted-foreground">Habilita geração automática de Nota Fiscal de Serviços</p>
          </div>
          <Switch checked={!!form.nfse_ativa} onCheckedChange={(v) => update("nfse_ativa", v)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Município *" field="nfse_municipio" form={form} update={update} placeholder="Ex: Rio de Janeiro" />
          <Field label="Código do Município (IBGE)" field="nfse_codigo_municipio" form={form} update={update} placeholder="Ex: 3304557" />
          <Field label="Inscrição Municipal *" field="nfse_inscricao_municipal" form={form} update={update} placeholder="Ex: 01234567" />
          <Field label="Código do Serviço (ISS) *" field="nfse_codigo_servico" form={form} update={update} placeholder="Ex: 14.02" />
          <Field label="Usuário / Login da Prefeitura *" field="nfse_usuario" form={form} update={update} />
          <Field label="Senha / Token da API *" field="nfse_senha" form={form} update={update} type="password" />
          <div>
            <Label className="text-xs">Ambiente</Label>
            <Select value={form.nfse_ambiente || "homologacao"} onValueChange={(v) => update("nfse_ambiente", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">🧪 Homologação (Teste)</SelectItem>
                <SelectItem value="producao">🚀 Produção</SelectItem>
              </SelectContent>
            </Select>
            {form.nfse_ambiente === "producao" && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Modo produção — notas emitidas terão validade fiscal real.
              </p>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs">Descrição Padrão do Serviço</Label>
          <Textarea
            value={form.nfse_descricao_servico || ""}
            onChange={(e) => update("nfse_descricao_servico", e.target.value)}
            rows={2}
            className="mt-1 text-sm"
            placeholder="Ex: Locação de andaimes e equipamentos de construção civil."
          />
          <p className="text-xs text-muted-foreground mt-1">Texto padrão para o campo de descrição de serviços nas NFs emitidas.</p>
        </div>

        {nfseOk ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Configuração completa — NFS-e pronta para ser emitida via cobrança.
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> Preencha os campos obrigatórios (*) para habilitar a emissão.
          </div>
        )}

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">ℹ️ Sobre a integração NFS-e</p>
          <p>A integração usa o padrão ABRASF (utilizado pela maioria dos municípios brasileiros). Os dados do emitente (empresa) são lidos automaticamente das configurações da empresa. O certificado digital A1 (.pfx) deve ser configurado via variável de ambiente <code className="bg-blue-100 px-1 rounded">NFSE_CERT_BASE64</code> e senha em <code className="bg-blue-100 px-1 rounded">NFSE_CERT_SENHA</code> no painel Base44.</p>
        </div>
      </Block>

      {/* ── BOLETO ── */}
      <Block icon={Landmark} title="🏦 Boleto Bancário — Integração" color="emerald">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border">
          <div>
            <p className="text-sm font-medium">Ativar geração de boletos</p>
            <p className="text-xs text-muted-foreground">Habilita emissão automática de boletos nas cobranças</p>
          </div>
          <Switch checked={!!form.boleto_ativa} onCheckedChange={(v) => update("boleto_ativa", v)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Banco *</Label>
            <Select value={form.boleto_banco || ""} onValueChange={(v) => update("boleto_banco", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
              <SelectContent>
                {BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Agência *" field="boleto_agencia" form={form} update={update} placeholder="Ex: 1234" />
          <Field label="Conta *" field="boleto_conta" form={form} update={update} placeholder="Ex: 12345-6" />
          <Field label="Carteira" field="boleto_carteira" form={form} update={update} placeholder="Ex: 109" />
          <Field label="Convênio / Código do Cedente" field="boleto_convenio" form={form} update={update} placeholder="Ex: 1234567" />
          <Field label="URL da API do Banco" field="boleto_api_url" form={form} update={update} placeholder="https://api.banco.com.br/v1/boletos" />
          <div className="sm:col-span-2">
            <Field label="Token da API *" field="boleto_api_token" form={form} update={update} type="password" placeholder="Bearer token ou API Key do banco..." />
          </div>
        </div>

        {boletoOk ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Configuração completa — boletos podem ser gerados nas cobranças.
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> Preencha banco, agência, conta e token para habilitar.
          </div>
        )}

        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 space-y-1">
          <p className="font-semibold">ℹ️ Sobre a integração de Boletos</p>
          <p>Compatível com APIs REST dos principais bancos brasileiros (Itaú, Bradesco, BB, CEF, Sicoob, Santander). Configure a URL da API e o token de autenticação fornecidos pelo seu banco. Após salvar, a opção "Gerar Boleto" aparecerá na tela de cobranças.</p>
        </div>
      </Block>

      <div className="flex justify-end pb-4">
        <Button onClick={onSave} disabled={saving} className="gap-2 px-8">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Configurações Fiscais"}
        </Button>
      </div>
    </div>
  );
}