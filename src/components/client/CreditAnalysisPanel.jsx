import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldAlert, TrendingUp, Ban } from "lucide-react";
import { calcularClassificacao, getScoreBadgeClass } from "../../lib/clientScore";
import { toast } from "sonner";

/**
 * Painel de análise de crédito do cliente.
 * Exibe score interno + consulta API externa (se configurada).
 */
export default function CreditAnalysisPanel({ client, score, settings, onUpdate }) {
  const [consulting, setConsulting] = useState(false);
  const [result, setResult] = useState(null);

  const classificacao = calcularClassificacao(score ?? 100);
  const badgeClass = getScoreBadgeClass(score ?? 100);

  const apiKey = settings?.credito_api_token;
  const apiProvider = settings?.credito_provedor || "serasa";
  const hasApiConfig = !!apiKey;

  const consultarCredito = async () => {
    if (!hasApiConfig) {
      toast.warning("Configure a API de crédito em Configurações → Análise de Crédito antes de consultar.");
      return;
    }
    if (!client?.cpf_cnpj) {
      toast.error("Cliente sem CPF/CNPJ cadastrado.");
      return;
    }
    setConsulting(true);
    setResult(null);

    // Simulação de resposta da API de crédito
    // Em produção, chamaria o backend com o token e CPF/CNPJ
    try {
      // Aqui seria: const res = await base44.functions.invoke("consultarCredito", { cpf_cnpj: client.cpf_cnpj });
      // Por ora, apenas loga e mostra mensagem de configuração necessária
      await new Promise((r) => setTimeout(r, 1200));
      setResult({ simulado: true });
      toast.info("Consulta simulada — configure a API real em Configurações → Análise de Crédito para consultas reais.");
    } catch (err) {
      toast.error("Erro ao consultar crédito: " + err.message);
    } finally {
      setConsulting(false);
    }
  };

  const serasa = client?.status_serasa;
  const bloqueado = client?.bloqueado;
  const pendencia = client?.pendencia_financeira;

  return (
    <div className="space-y-3">
      {/* Score interno */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-xl p-3 border ${badgeClass}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Score Interno</span>
          </div>
          <p className="text-2xl font-bold">{score ?? 100}</p>
          <p className="text-xs mt-0.5 opacity-80">{classificacao.label}</p>
        </div>

        <div className="rounded-xl p-3 border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Limite de Crédito</p>
          <p className="text-lg font-bold text-foreground">{classificacao.limiteCreditoLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">baseado no score</p>
        </div>

        <div className={`rounded-xl p-3 border ${
          serasa === "negativado" ? "bg-red-50 border-red-200" :
          serasa === "restrito" ? "bg-amber-50 border-amber-200" :
          "bg-emerald-50 border-emerald-200"
        }`}>
          <p className="text-xs text-muted-foreground mb-1">Status Serasa</p>
          <div className="flex items-center gap-1.5">
            {serasa === "negativado" ? <Ban className="w-4 h-4 text-red-600" /> :
             serasa === "restrito" ? <AlertCircle className="w-4 h-4 text-amber-600" /> :
             <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <p className={`text-sm font-bold capitalize ${
              serasa === "negativado" ? "text-red-700" :
              serasa === "restrito" ? "text-amber-700" :
              "text-emerald-700"
            }`}>{serasa === "negativado" ? "Negativado" : serasa === "restrito" ? "Restrito" : "Regular"}</p>
          </div>
        </div>

        <div className={`rounded-xl p-3 border ${bloqueado || pendencia ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <p className="text-xs text-muted-foreground mb-1">Situação</p>
          {bloqueado ? (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <p className="text-sm font-bold text-red-700">Bloqueado</p>
            </div>
          ) : pendencia ? (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-700">Pendência</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700">Regular</p>
            </div>
          )}
        </div>
      </div>

      {/* Alertas */}
      {serasa === "negativado" && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Cliente com restrições financeiras (Serasa Negativado)</p>
            <p className="text-xs mt-0.5">Avalie o risco antes de criar novos contratos.</p>
          </div>
        </div>
      )}

      {/* Botão consulta externa */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={consultarCredito}
          disabled={consulting}
          className="gap-1.5"
        >
          {consulting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {consulting ? "Consultando..." : "Consultar Crédito Externo"}
        </Button>
        {!hasApiConfig && (
          <p className="text-xs text-muted-foreground">Configure a API em <strong>Configurações → Crédito</strong></p>
        )}
      </div>

      {result?.simulado && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
          ℹ️ Para consultas reais de SPC/Serasa, configure sua API em <strong>Configurações → Análise de Crédito</strong>. A integração com Serasa Experian, Boa Vista (SCPC) ou Quod requer contrato com o provedor.
        </div>
      )}
    </div>
  );
}