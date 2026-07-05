import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, CheckCircle2, AlertCircle, Loader2, RefreshCw, ScanBarcode } from "lucide-react";
import { format } from "date-fns";

export default function MigrationFix() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState([]);

  const [runningSerials, setRunningSerials] = useState(false);
  const [doneSerials, setDoneSerials] = useState(false);
  const [logSerials, setLogSerials] = useState([]);

  const addLogS = (msg, type = "info") => {
    setLogSerials(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString("pt-BR") }]);
  };

  // Corrige seriais "presos" — alugados mas cujo contrato/OS já está encerrado
  const runFixSerials = async () => {
    setRunningSerials(true);
    setDoneSerials(false);
    setLogSerials([]);

    addLogS("Carregando equipamentos com controle individual...");
    let equipamentos = [];
    try {
      const all = await base44.entities.Equipment.list("-nome", 1000);
      equipamentos = all.filter(e => e.controle_individual && (e.numeracoes || []).length > 0);
      addLogS(`✓ ${equipamentos.length} equipamento(s) com seriais encontrados.`);
    } catch (e) {
      addLogS(`Erro ao carregar equipamentos: ${e.message}`, "error");
      setRunningSerials(false);
      return;
    }

    // Carrega contratos e OS encerrados para cruzar
    addLogS("Carregando contratos e OS encerrados...");
    const statusEncerradoContrato = ["finalizado", "cancelado", "devolvido_pendente", "devolvido_parcial"];
    const statusEncerradoOS = ["finalizada", "cancelada", "recolhida"];

    let contratos = [];
    let ordens = [];
    try {
      contratos = await base44.entities.Contract.list("-created_date", 3000);
      ordens = await base44.entities.ServiceOrder.list("-created_date", 3000);
      addLogS(`✓ ${contratos.length} contratos e ${ordens.length} OS carregados.`);
    } catch (e) {
      addLogS(`Erro ao carregar contratos/OS: ${e.message}`, "error");
      setRunningSerials(false);
      return;
    }

    // Índices rápidos
    const contratoById = {};
    const contratoByNumero = {};
    for (const c of contratos) {
      if (c.id) contratoById[c.id] = c;
      if (c.numero) contratoByNumero[c.numero] = c;
    }
    const osById = {};
    for (const o of ordens) {
      if (o.id) osById[o.id] = o;
    }

    const agora = format(new Date(), "dd/MM/yyyy HH:mm");
    let totalCorrigidos = 0;
    let totalVerificados = 0;

    for (const eq of equipamentos) {
      let mudou = false;
      const novasNumeracoes = (eq.numeracoes || []).map(n => {
        totalVerificados++;
        if (n.status !== "alugado") return n; // só processa alugados

        // Descobre o contrato/OS vinculado
        const contratoVinculado =
          (n.contrato_id && n.contrato_id !== "pending" && contratoById[n.contrato_id]) ||
          (n.contrato_numero && contratoByNumero[n.contrato_numero]) ||
          null;

        const osVinculada =
          (n.os_id && osById[n.os_id]) || null;

        // Verifica se está encerrado
        const contratoEncerrado = contratoVinculado && statusEncerradoContrato.includes(contratoVinculado.status);
        const osEncerrada = osVinculada && statusEncerradoOS.includes(osVinculada.status);

        // Também libera se contrato_id = "pending" (bug antigo de gravação)
        const idPending = n.contrato_id === "pending";

        // Libera se:
        // 1. Contrato encerrado
        // 2. OS encerrada
        // 3. Contrato_id "pending" (nunca foi corretamente vinculado)
        // 4. Nenhum contrato/OS encontrado (registro fantasma)
        const semVinculoReal = !contratoVinculado && !osVinculada;

        if (contratoEncerrado || osEncerrada || idPending || semVinculoReal) {
          mudou = true;
          totalCorrigidos++;
          const motivo = contratoEncerrado
            ? `contrato #${contratoVinculado.numero} (${contratoVinculado.status})`
            : osEncerrada
            ? `OS encerrada`
            : idPending
            ? "contrato_id=pending (bug legado)"
            : "sem vínculo real encontrado";
          addLogS(
            `✓ ${eq.nome} — serial ${n.serial}: liberado [${motivo}]`,
            "success"
          );
          return {
            ...n,
            status: "disponivel",
            contrato_id: "",
            contrato_numero: "",
            os_id: "",
            historico: [
              ...(n.historico || []),
              {
                data: agora,
                evento: "Liberação automática (correção)",
                contrato_numero: n.contrato_numero || "",
                usuario: "Sistema",
                observacao: `Motivo: ${motivo}`,
              },
            ],
          };
        }
        return n;
      });

      if (mudou) {
        try {
          // Recalcula quantidades
          const disponiveis = novasNumeracoes.filter(n => n.status === "disponivel").length;
          const alugados = novasNumeracoes.filter(n => n.status === "alugado").length;
          await base44.entities.Equipment.update(eq.id, {
            numeracoes: novasNumeracoes,
            quantidade_disponivel: disponiveis,
            quantidade_alugada: alugados,
            status_item: alugados === 0 ? "disponivel" : "alugado",
          });
        } catch (e) {
          addLogS(`✗ Erro ao atualizar ${eq.nome}: ${e.message}`, "error");
        }
      }
    }

    addLogS(`--- Verificados: ${totalVerificados} seriais. Corrigidos: ${totalCorrigidos}. ---`, totalCorrigidos > 0 ? "success" : "info");
    addLogS("✅ Correção de seriais concluída!", "success");
    setRunningSerials(false);
    setDoneSerials(true);
  };

  const addLog = (msg, type = "info") => {
    setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString("pt-BR") }]);
  };

  const runFix = async () => {
    setRunning(true);
    setDone(false);
    setLog([]);

    addLog("Iniciando script de correção de migração...");

    // Carrega todos os clientes uma vez
    let allClients = [];
    try {
      allClients = await base44.entities.Client.list("-created_date", 2000);
      addLog(`✓ ${allClients.length} cliente(s) carregados.`);
    } catch (e) {
      addLog(`Erro ao carregar clientes: ${e.message}`, "error");
      setRunning(false);
      return;
    }

    const clientByCodigo = {};
    const clientByNome = {};
    for (const c of allClients) {
      if (c.codigo_cliente) clientByCodigo[c.codigo_cliente.trim()] = c;
      const nome = (c.nome_razao_social || c.fantasia || "").toLowerCase().trim();
      if (nome) clientByNome[nome] = c;
    }

    // ---- CORRIGIR ORDENS DE SERVIÇO ----
    addLog("--- Processando Ordens de Serviço ---");
    let osList = [];
    try {
      osList = await base44.entities.ServiceOrder.list("-created_date", 2000);
      addLog(`Encontradas ${osList.length} OS para verificar.`);
    } catch (e) {
      addLog(`Erro ao carregar OS: ${e.message}`, "error");
    }

    let osFixed = 0;
    let osOrfas = 0;
    for (const os of osList) {
      // Se já tem client_id válido, pula
      if (os.client_id) {
        // Valida se o client_id existe de fato
        const clientExiste = allClients.find(c => c.id === os.client_id);
        if (clientExiste) continue;
        addLog(`OS #${os.numero || os.id}: client_id inválido (${os.client_id}), tentando corrigir...`, "warn");
      }

      let clientEncontrado = null;
      let metodo = "";

      // 1. Por codigo_cliente
      const codigoOS = os.codigo_cliente || os.client_codigo;
      if (codigoOS && clientByCodigo[codigoOS.trim()]) {
        clientEncontrado = clientByCodigo[codigoOS.trim()];
        metodo = `código ${codigoOS}`;
      }

      // 2. Por nome
      if (!clientEncontrado && os.client_nome) {
        const nomeKey = os.client_nome.toLowerCase().trim();
        if (clientByNome[nomeKey]) {
          clientEncontrado = clientByNome[nomeKey];
          metodo = `nome "${os.client_nome}"`;
        }
      }

      if (clientEncontrado) {
        try {
          await base44.entities.ServiceOrder.update(os.id, {
            client_id: clientEncontrado.id,
            client_nome: clientEncontrado.nome_razao_social || os.client_nome || clientEncontrado.fantasia,
          });
          osFixed++;
          addLog(`✓ OS #${os.numero || os.id} — vinculada ao cliente via ${metodo}.`, "success");
        } catch (e) {
          addLog(`✗ OS #${os.numero || os.id} — erro ao atualizar: ${e.message}`, "error");
        }
      } else if (!os.client_id) {
        osOrfas++;
        addLog(`⚠ OS #${os.numero || os.id} — cliente não encontrado (nome: "${os.client_nome || "vazio"}", código: "${codigoOS || "vazio"}"). Registro órfão.`, "warn");
      }
    }

    addLog(`OS: ${osFixed} corrigidas, ${osOrfas} órfãs sem cliente identificado.`);

    // ---- CORRIGIR CONTRATOS ----
    addLog("--- Processando Contratos ---");
    let contractList = [];
    try {
      contractList = await base44.entities.Contract.list("-created_date", 2000);
      addLog(`Encontrados ${contractList.length} contratos para verificar.`);
    } catch (e) {
      addLog(`Erro ao carregar contratos: ${e.message}`, "error");
    }

    let contractFixed = 0;
    let contractOrfas = 0;
    for (const ct of contractList) {
      if (ct.client_id) {
        const clientExiste = allClients.find(c => c.id === ct.client_id);
        if (clientExiste) continue;
        addLog(`Contrato #${ct.numero || ct.id}: client_id inválido, tentando corrigir...`, "warn");
      }

      let clientEncontrado = null;
      let metodo = "";

      const codigoCT = ct.client_codigo || ct.codigo_cliente;
      if (codigoCT && clientByCodigo[codigoCT.trim()]) {
        clientEncontrado = clientByCodigo[codigoCT.trim()];
        metodo = `código ${codigoCT}`;
      }

      if (!clientEncontrado && ct.client_nome) {
        const nomeKey = ct.client_nome.toLowerCase().trim();
        if (clientByNome[nomeKey]) {
          clientEncontrado = clientByNome[nomeKey];
          metodo = `nome "${ct.client_nome}"`;
        }
      }

      if (clientEncontrado) {
        try {
          await base44.entities.Contract.update(ct.id, {
            client_id: clientEncontrado.id,
            client_nome: clientEncontrado.nome_razao_social || ct.client_nome || clientEncontrado.fantasia,
          });
          contractFixed++;
          addLog(`✓ Contrato #${ct.numero || ct.id} — vinculado ao cliente via ${metodo}.`, "success");
        } catch (e) {
          addLog(`✗ Contrato #${ct.numero || ct.id} — erro ao atualizar: ${e.message}`, "error");
        }
      } else if (!ct.client_id) {
        contractOrfas++;
        addLog(`⚠ Contrato #${ct.numero || ct.id} — cliente não encontrado (nome: "${ct.client_nome || "vazio"}", código: "${codigoCT || "vazio"}"). Registro órfão.`, "warn");
      }
    }

    addLog(`Contratos: ${contractFixed} corrigidos, ${contractOrfas} órfãos sem cliente identificado.`);
    // ---- DEDUPLICAR CÓDIGOS DE CLIENTES ----
    addLog("--- Verificando duplicidade de Códigos de Clientes ---");
    // Recarrega clientes após as correções anteriores
    let clientsForDedup = [];
    try {
      clientsForDedup = await base44.entities.Client.list("created_date", 5000);
    } catch (e) {
      addLog(`Erro ao recarregar clientes: ${e.message}`, "error");
    }

    // Agrupar por código
    const codigoGroups = {};
    for (const c of clientsForDedup) {
      const cod = (c.codigo_cliente || "").trim();
      if (!cod) continue;
      if (!codigoGroups[cod]) codigoGroups[cod] = [];
      codigoGroups[cod].push(c);
    }

    // Encontrar maior código atual para gerar novos
    let maxCodigo = 0;
    for (const c of clientsForDedup) {
      const n = parseInt(c.codigo_cliente, 10);
      if (!isNaN(n) && n > maxCodigo) maxCodigo = n;
    }
    // Conjunto de todos os códigos em uso para evitar novos conflitos
    const usedCodes = new Set(
      clientsForDedup.map(c => c.codigo_cliente).filter(Boolean)
    );

    const getNextFree = () => {
      maxCodigo++;
      while (usedCodes.has(String(maxCodigo))) maxCodigo++;
      usedCodes.add(String(maxCodigo));
      return String(maxCodigo);
    };

    let dedupFixed = 0;
    for (const [cod, group] of Object.entries(codigoGroups)) {
      if (group.length <= 1) continue;
      addLog(`Código ${cod} duplicado em ${group.length} cliente(s). Mantendo o primeiro, renumerando os demais...`, "warn");
      // Ordena por created_date — o mais antigo fica com o código original
      const sorted = [...group].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      for (let i = 1; i < sorted.length; i++) {
        const novoCodigo = getNextFree();
        try {
          await base44.entities.Client.update(sorted[i].id, { codigo_cliente: novoCodigo });
          dedupFixed++;
          addLog(`✓ Cliente "${sorted[i].nome_razao_social}" → código alterado de ${cod} para ${novoCodigo}.`, "success");
        } catch (e) {
          addLog(`✗ Erro ao atualizar cliente ${sorted[i].id}: ${e.message}`, "error");
        }
      }
    }

    if (dedupFixed === 0) {
      addLog("Nenhum código duplicado encontrado.", "success");
    } else {
      addLog(`${dedupFixed} cliente(s) renumerados para eliminar duplicidade.`, "success");
    }

    addLog("✅ Correção concluída!", "success");
    setRunning(false);
    setDone(true);
  };

  const logColor = { info: "text-foreground", success: "text-emerald-700", warn: "text-amber-600", error: "text-destructive" };

  return (
    <div className="max-w-3xl space-y-8">

      {/* ===== SEÇÃO: CORRIGIR SERIAIS PRESOS ===== */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <ScanBarcode className="w-6 h-6 text-violet-600" />
          <div>
            <h2 className="text-lg font-bold font-heading">Corrigir Seriais Presos</h2>
            <p className="text-sm text-muted-foreground">Libera seriais marcados como "Alugado" cujo contrato/OS já foi encerrado</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="pt-4 space-y-1.5 text-sm text-muted-foreground">
            <p>• Varre todos os equipamentos com controle individual de seriais</p>
            <p>• Para cada serial "Alugado", verifica se o contrato ou OS vinculado está <strong>finalizado, cancelado ou devolvido</strong></p>
            <p>• Libera automaticamente seriais com <code className="bg-muted px-1 rounded text-xs">contrato_id="pending"</code> (bug antigo de gravação)</p>
            <p>• Libera seriais com vínculos "fantasma" (contrato/OS inexistentes no banco)</p>
            <p>• Preserva o histórico de movimentações — apenas muda o status ativo</p>
            <p>• <strong>Seguro de executar múltiplas vezes</strong> — só corrige o que precisa</p>
          </CardContent>
        </Card>

        <div className="flex gap-3 mb-4">
          <Button
            onClick={runFixSerials}
            disabled={runningSerials}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {runningSerials ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanBarcode className="w-4 h-4" />}
            {runningSerials ? "Corrigindo seriais..." : "Corrigir Seriais Presos"}
          </Button>
          {doneSerials && (
            <Button variant="outline" onClick={runFixSerials} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Executar novamente
            </Button>
          )}
        </div>

        {logSerials.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                {doneSerials
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  : <Loader2 className="w-4 h-4 animate-spin text-violet-600" />}
                Log — Correção de Seriais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-xl p-3 max-h-[400px] overflow-y-auto space-y-0.5 font-mono text-xs">
                {logSerials.map((entry, i) => (
                  <div key={i} className={`flex gap-2 ${logColor[entry.type] || "text-foreground"}`}>
                    <span className="text-muted-foreground shrink-0">{entry.ts}</span>
                    <span>{entry.msg}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {logSerials.length === 0 && !runningSerials && (
          <div className="text-center py-10 text-muted-foreground">
            <ScanBarcode className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>Clique em "Corrigir Seriais Presos" para iniciar a verificação</p>
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* ===== SEÇÃO: MIGRAÇÃO DE CLIENTES ===== */}
      <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold font-heading">Script de Correção de Migração</h1>
          <p className="text-sm text-muted-foreground">Vincula clientes em OS e contratos migrados sem client_id</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">O que este script faz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Percorre todas as OSs e contratos no sistema</p>
          <p>• Identifica registros sem <code className="bg-muted px-1 rounded text-xs">client_id</code> válido</p>
          <p>• Tenta vincular pelo <strong>código do cliente</strong> (campo <code className="bg-muted px-1 rounded text-xs">codigo_cliente</code>)</p>
          <p>• Se não encontrar, tenta vincular pelo <strong>nome do cliente</strong></p>
          <p>• Atualiza apenas os registros que precisam de correção — registros já corretos são ignorados</p>
          <p>• <strong>Não cria</strong> novos clientes — apenas vincula existentes</p>
          <p>• Relatório completo de tudo que foi corrigido ou não encontrado</p>
          <p>• <strong>Detecta e corrige códigos de clientes duplicados</strong> — mantém o cliente mais antigo com o código original e renumera os demais automaticamente</p>
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-4">
        <Button
          onClick={runFix}
          disabled={running}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Executando..." : "Executar Correção"}
        </Button>
        {done && (
          <Button variant="outline" onClick={runFix} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Executar novamente
          </Button>
        )}
      </div>

      {log.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              Log de Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-xl p-3 max-h-[500px] overflow-y-auto space-y-0.5 font-mono text-xs">
              {log.map((entry, i) => (
                <div key={i} className={`flex gap-2 ${logColor[entry.type] || "text-foreground"}`}>
                  <span className="text-muted-foreground shrink-0">{entry.ts}</span>
                  <span>{entry.msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {log.length === 0 && !running && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Clique em "Executar Correção" para iniciar</p>
        </div>
      )}
      </div>
    </div>
  );
}