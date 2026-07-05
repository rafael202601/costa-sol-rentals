import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Clock, Unlock, Lock, CheckCircle2, XCircle, AlertCircle, Save, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const DEFAULT_CONFIG = {
  fechamento_ativo: false,
  fechamento_tipo: "horario",
  fechamento_horario: "18:00",
  fechamento_horas: 12,
  abertura_ativa: false,
  abertura_tipo: "horario",
  abertura_horario: "07:00",
  abertura_horas: 13,
  abertura_valor_inicial: 0,
  abertura_responsavel: "",
};

function calcProximoFechamento(config, openCash) {
  if (!config.fechamento_ativo) return null;
  if (config.fechamento_tipo === "horario") {
    const [h, m] = (config.fechamento_horario || "18:00").split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return `Hoje às ${config.fechamento_horario}${target.getDate() !== now.getDate() ? " (amanhã)" : ""}`;
  }
  if (config.fechamento_tipo === "horas_apos_abertura" && openCash?.data_abertura) {
    const abertura = new Date(openCash.data_abertura);
    const fechamento = new Date(abertura.getTime() + (config.fechamento_horas || 12) * 3600000);
    return format(fechamento, "dd/MM/yyyy HH:mm");
  }
  return "—";
}

function calcProximaAbertura(config, lastCash) {
  if (!config.abertura_ativa) return null;
  if (config.abertura_tipo === "horario") {
    const [h, m] = (config.abertura_horario || "07:00").split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return `Hoje às ${config.abertura_horario}${target.getDate() !== now.getDate() ? " (amanhã)" : ""}`;
  }
  if (config.abertura_tipo === "horas_apos_fechamento" && lastCash?.data_fechamento) {
    const fechamento = new Date(lastCash.data_fechamento);
    const abertura = new Date(fechamento.getTime() + (config.abertura_horas || 13) * 3600000);
    return format(abertura, "dd/MM/yyyy HH:mm");
  }
  return "—";
}

export default function CashAutoConfigPanel({ currentUser, openCash, registers, onRefresh }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configId, setConfigId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const lastClosed = registers?.find(r => r.status === "fechado");

  useEffect(() => {
    base44.entities.CashAutoConfig.list().then((list) => {
      if (list.length > 0) {
        setConfig({ ...DEFAULT_CONFIG, ...list[0] });
        setConfigId(list[0].id);
      }
    }).catch(() => {});
  }, []);

  const update = (k, v) => setConfig(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!isAdmin) { toast.error("Apenas administradores podem alterar esta configuração."); return; }
    setSaving(true);
    const payload = {
      ...config,
      configurado_por: currentUser?.email || "",
      configurado_por_nome: currentUser?.full_name || "",
      configurado_em: format(new Date(), "dd/MM/yyyy HH:mm"),
    };
    if (configId) {
      await base44.entities.CashAutoConfig.update(configId, payload);
    } else {
      const created = await base44.entities.CashAutoConfig.create(payload);
      setConfigId(created.id);
    }
    toast.success("Configurações salvas! As automações serão aplicadas no próximo ciclo.");
    setSaving(false);
    onRefresh?.();
  };

  const proximoFechamento = calcProximoFechamento(config, openCash);
  const proximaAbertura = calcProximaAbertura(config, lastClosed);
  const historico = (config.historico || []).slice().reverse().slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-start gap-3">
        <Settings className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Automação de Caixa</p>
          <p className="text-xs">Configure a abertura e o fechamento automáticos do caixa. As regras são executadas pelo sistema a cada 5 minutos. Somente administradores podem alterar essas configurações.</p>
        </div>
      </div>

      {/* Status atual */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${openCash ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          {openCash ? <Unlock className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-red-600" />}
          <div>
            <p className={`font-semibold text-sm ${openCash ? "text-emerald-800" : "text-red-800"}`}>
              Caixa {openCash ? "Aberto" : "Fechado"}
            </p>
            {openCash && <p className="text-xs text-emerald-700">Abertura: {openCash.responsavel}</p>}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-muted/30 flex items-center gap-3">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-semibold text-sm">Próximas execuções</p>
            {proximoFechamento && <p className="text-xs text-muted-foreground">🔒 Fechar: {proximoFechamento}</p>}
            {proximaAbertura && <p className="text-xs text-muted-foreground">🔓 Abrir: {proximaAbertura}</p>}
            {!proximoFechamento && !proximaAbertura && <p className="text-xs text-muted-foreground">Nenhuma automação ativa</p>}
          </div>
        </div>
      </div>

      {/* FECHAMENTO AUTOMÁTICO */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500" /> Fechamento Automático
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ativar fechamento automático</p>
              <p className="text-xs text-muted-foreground">O caixa será fechado automaticamente conforme configurado abaixo</p>
            </div>
            <Switch
              checked={!!config.fechamento_ativo}
              onCheckedChange={(v) => update("fechamento_ativo", v)}
              disabled={!isAdmin}
            />
          </div>

          {config.fechamento_ativo && (
            <div className="space-y-4 pt-2 border-t">
              <div>
                <Label className="text-xs">Tipo de fechamento</Label>
                <Select value={config.fechamento_tipo} onValueChange={(v) => update("fechamento_tipo", v)} disabled={!isAdmin}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horario">⏰ Horário fixo</SelectItem>
                    <SelectItem value="horas_apos_abertura">🕐 Horas após abertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.fechamento_tipo === "horario" && (
                <div>
                  <Label className="text-xs">Horário de fechamento</Label>
                  <Input
                    type="time"
                    value={config.fechamento_horario}
                    onChange={(e) => update("fechamento_horario", e.target.value)}
                    className="mt-1"
                    disabled={!isAdmin}
                  />
                  {proximoFechamento && (
                    <p className="text-xs text-emerald-600 mt-1">▶ Próximo: {proximoFechamento}</p>
                  )}
                </div>
              )}

              {config.fechamento_tipo === "horas_apos_abertura" && (
                <div>
                  <Label className="text-xs">Horas após abertura para fechar</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={config.fechamento_horas}
                    onChange={(e) => update("fechamento_horas", parseInt(e.target.value) || 12)}
                    className="mt-1"
                    disabled={!isAdmin}
                  />
                  {openCash && proximoFechamento && (
                    <p className="text-xs text-emerald-600 mt-1">▶ Fechamento previsto: {proximoFechamento}</p>
                  )}
                  {!openCash && (
                    <p className="text-xs text-muted-foreground mt-1">Será calculado a partir da abertura do caixa</p>
                  )}
                </div>
              )}

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">Regras do fechamento automático:</p>
                <p>• Não fecha se o caixa já estiver fechado</p>
                <p>• Não duplica se já houve fechamento manual no período</p>
                <p>• Registra data/hora, tipo "automático" e configurador</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ABERTURA AUTOMÁTICA */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-500" /> Abertura Automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ativar abertura automática</p>
              <p className="text-xs text-muted-foreground">O caixa será aberto automaticamente conforme configurado abaixo</p>
            </div>
            <Switch
              checked={!!config.abertura_ativa}
              onCheckedChange={(v) => update("abertura_ativa", v)}
              disabled={!isAdmin}
            />
          </div>

          {config.abertura_ativa && (
            <div className="space-y-4 pt-2 border-t">
              <div>
                <Label className="text-xs">Tipo de abertura</Label>
                <Select value={config.abertura_tipo} onValueChange={(v) => update("abertura_tipo", v)} disabled={!isAdmin}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horario">⏰ Horário fixo</SelectItem>
                    <SelectItem value="horas_apos_fechamento">🕐 Horas após fechamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.abertura_tipo === "horario" && (
                <div>
                  <Label className="text-xs">Horário de abertura</Label>
                  <Input
                    type="time"
                    value={config.abertura_horario}
                    onChange={(e) => update("abertura_horario", e.target.value)}
                    className="mt-1"
                    disabled={!isAdmin}
                  />
                  {proximaAbertura && (
                    <p className="text-xs text-emerald-600 mt-1">▶ Próxima: {proximaAbertura}</p>
                  )}
                </div>
              )}

              {config.abertura_tipo === "horas_apos_fechamento" && (
                <div>
                  <Label className="text-xs">Horas após fechamento para abrir</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={config.abertura_horas}
                    onChange={(e) => update("abertura_horas", parseInt(e.target.value) || 13)}
                    className="mt-1"
                    disabled={!isAdmin}
                  />
                  {lastClosed && proximaAbertura && (
                    <p className="text-xs text-emerald-600 mt-1">▶ Abertura prevista: {proximaAbertura}</p>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Valor inicial automático (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={config.abertura_valor_inicial}
                    onChange={(e) => update("abertura_valor_inicial", parseFloat(e.target.value) || 0)}
                    className="mt-1"
                    placeholder="0,00"
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Valor de troco/fundo de caixa inicial</p>
                </div>
                <div>
                  <Label className="text-xs">Responsável padrão</Label>
                  <Input
                    value={config.abertura_responsavel}
                    onChange={(e) => update("abertura_responsavel", e.target.value)}
                    className="mt-1"
                    placeholder="Nome do responsável..."
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">Regras da abertura automática:</p>
                <p>• Não abre se já existir caixa aberto</p>
                <p>• Não duplica abertura</p>
                <p>• Registra tipo "automático" e configurador</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info configurador */}
      {config.configurado_por && (
        <div className="text-xs text-muted-foreground">
          Última configuração por <strong>{config.configurado_por_nome || config.configurado_por}</strong> em {config.configurado_em}
        </div>
      )}

      {/* Botão Salvar */}
      {isAdmin && (
        <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      )}

      {!isAdmin && (
        <div className="p-3 rounded-xl bg-muted/30 border text-xs text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Apenas administradores podem alterar as configurações de automação do caixa.
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" /> Histórico de Execuções
              </CardTitle>
              <button onClick={() => setShowHistory(v => !v)} className="text-xs text-primary hover:underline">
                {showHistory ? "Ocultar" : "Ver histórico"}
              </button>
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent className="space-y-2">
              {historico.map((h, i) => (
                <div key={i} className={`flex items-start justify-between p-3 rounded-lg text-xs border ${
                  h.status === "sucesso" ? "bg-emerald-50 border-emerald-200" :
                  h.status === "erro" ? "bg-red-50 border-red-200" :
                  h.status === "ignorado" ? "bg-muted/30 border-border" : "bg-blue-50 border-blue-200"
                }`}>
                  <div className="space-y-0.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      {h.status === "sucesso" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> :
                       h.status === "erro" ? <XCircle className="w-3.5 h-3.5 text-red-600" /> :
                       <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                      {h.tipo === "abertura" ? "Abertura automática" : h.tipo === "fechamento" ? "Fechamento automático" : h.tipo}
                    </p>
                    {h.detalhe && <p className="text-muted-foreground">{h.detalhe}</p>}
                    {h.usuario && <p className="text-muted-foreground">Por: {h.usuario}</p>}
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-3">{h.data_hora}</span>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}