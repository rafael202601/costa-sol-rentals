import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, RefreshCw, Wifi, WifiOff, Server } from "lucide-react";
import { toast } from "sonner";

export default function AwsWebhookSettings() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vpsUrl, setVpsUrl] = useState(() => localStorage.getItem("aws_vps_url") || "");
  const [connectionStatus, setConnectionStatus] = useState("checking");

  const appId = window.__BASE44_APP_ID__ || "[APP_ID]";
  const endpoint = `https://sotluugxlslvmhfmoidm.supabase.co/rest/v1/integra_webhooks_aws`;

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.IntegraWebhookAWS.list("-created_date", 50);
      setLogs(data);
      const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
      const recente = data.find(l => new Date(l.created_date) > cincoMinutosAtras);
      setConnectionStatus(recente ? "online" : "offline");
    } catch (_) {
      setConnectionStatus("offline");
    }
    setLoading(false);
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const limparLogs = async () => {
    if (!confirm("Deseja apagar todos os logs de integração? Esta ação não pode ser desfeita.")) return;
    await Promise.all(logs.map(l => base44.entities.IntegraWebhookAWS.delete(l.id)));
    setLogs([]);
    toast.success("Logs limpos!");
  };

  const salvarVpsUrl = () => {
    localStorage.setItem("aws_vps_url", vpsUrl);
    toast.success("URL da VPS salva localmente!");
  };

  const statusBadge = {
    checking: <Badge variant="secondary">Verificando...</Badge>,
    online: <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">🟢 Online (último 5 min)</Badge>,
    offline: <Badge className="bg-slate-100 text-slate-500 border-slate-200">⚫ Sem dados recentes</Badge>,
  }[connectionStatus];

  const statusColors = {
    Pendente: "bg-amber-100 text-amber-700",
    Processado: "bg-emerald-100 text-emerald-700",
    Erro: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">🔌 Arquitetura Híbrida — VPS AWS + Base44</p>
          <p className="text-xs text-blue-700">
            Sua VPS recebe mensagens do WhatsApp e faz POST direto na entidade <strong>IntegraWebhookAWS</strong> do Base44.
            Uma automação detecta registros "Pendente" e aciona a IA automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Server className="w-4 h-4" /> Endpoint de Ingestão (para sua VPS)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Endpoint REST — POST para inserir mensagens</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={endpoint} className="font-mono text-xs bg-muted" />
              <Button variant="outline" size="icon" onClick={() => copiar(endpoint)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Envie um POST com header <code className="bg-muted px-1 rounded">x-api-key: [SUA_SERVICE_ROLE_KEY]</code> e body JSON com os campos da entidade.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 p-4 text-xs font-mono text-slate-200 space-y-1 overflow-x-auto">
            <p className="text-slate-400"># Exemplo de chamada da sua VPS (curl)</p>
            <p>{`curl -X POST \\`}</p>
            <p className="pl-4">{`"${endpoint}" \\`}</p>
            <p className="pl-4">{`-H "Content-Type: application/json" \\`}</p>
            <p className="pl-4">{`-H "x-api-key: [SUA_SERVICE_ROLE_KEY]" \\`}</p>
            <p className="pl-4">{`-d '{"json_recebido":"{\\"phone\\":\\"5521999...\\"}","remetente":"5521999990000","origem_api":"Z-API","status_processamento":"Pendente"}'`}</p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠️ Como obter a Service Role Key</p>
            <p>Acesse <strong>Dashboard → Settings → API Keys</strong> do Base44. Use a chave apenas na sua VPS, nunca no frontend.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-heading">URL da VPS AWS (registro local)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={vpsUrl}
              onChange={e => setVpsUrl(e.target.value)}
              placeholder="https://minha-vps.aws.com/webhook"
              className="flex-1"
            />
            <Button variant="outline" onClick={salvarVpsUrl}>Salvar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Apenas para referência — não é usada automaticamente pelo sistema.</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-heading flex items-center gap-2">
              {connectionStatus === "online"
                ? <Wifi className="w-4 h-4 text-emerald-500" />
                : <WifiOff className="w-4 h-4 text-slate-400" />}
              Status da Conexão
            </CardTitle>
            <div className="mt-1">{statusBadge}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadLogs} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
            {logs.length > 0 && (
              <Button variant="outline" size="sm" onClick={limparLogs} className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Limpar Logs
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro recebido ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="p-3 rounded-xl border bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{log.remetente}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{log.origem_api}</Badge>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[log.status_processamento] || "bg-muted"}`}>
                        {log.status_processamento}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground truncate">{log.json_recebido?.slice(0, 120)}{log.json_recebido?.length > 120 ? "..." : ""}</p>
                  {log.resposta_ia && (
                    <p className="text-emerald-700 border-t border-border pt-1">🤖 {log.resposta_ia?.slice(0, 150)}{log.resposta_ia?.length > 150 ? "..." : ""}</p>
                  )}
                  <p className="text-muted-foreground/60">{new Date(log.created_date).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}