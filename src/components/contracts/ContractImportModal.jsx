import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { getNextNumber } from "@/lib/sequentialNumber";

// Mapeamento de cabeçalhos CSV → campos internos
const HEADER_MAP = {
  // Contrato
  "numero": "numero", "numero_contrato": "numero", "contrato": "numero",
  "status": "status",
  "status_financeiro": "status_financeiro",
  "tipo_entrega": "tipo_entrega",
  // Cliente
  "cliente_cpf_cnpj": "client_cpf_cnpj", "cpf_cnpj": "client_cpf_cnpj", "cliente_documento": "client_cpf_cnpj",
  "cliente_codigo": "client_codigo", "codigo_cliente": "client_codigo",
  "cliente_nome": "client_nome", "cliente": "client_nome",
  // Solicitante / Obra
  "solicitante_nome": "solicitante_nome", "solicitante": "solicitante_nome",
  "solicitante_tipo": "solicitante_tipo",
  "obra_nome": "obra_nome", "obra": "obra_nome",
  "obra_endereco": "obra_endereco", "endereco_obra": "obra_endereco",
  // Endereço de entrega
  "endereco_entrega": "endereco_entrega", "endereco": "endereco_entrega",
  // Datas
  "data_inicio": "data_inicio", "data_inicio_contrato": "data_inicio",
  "prazo_valor": "prazo_valor", "prazo": "prazo_valor",
  "prazo_tipo": "prazo_tipo",
  "data_prevista_termino": "data_prevista_termino", "data_termino": "data_prevista_termino",
  // Financeiro
  "frete": "frete",
  "sinal": "sinal",
  "valor_pago": "valor_pago",
  "valor_total": "valor_total",
  // Equipamentos (uma linha por equipamento)
  "equipamento_codigo": "equipamento_codigo", "codigo_equipamento": "equipamento_codigo",
  "equipamento_nome": "equipamento_nome",
  "quantidade": "quantidade_retirada", "qtd": "quantidade_retirada", "quantidade_retirada": "quantidade_retirada",
  "valor_unitario": "valor_unitario", "valor_diario": "valor_unitario",
  "desconto_item": "desconto_item", "desconto": "desconto_item",
  "tipo_cobranca": "tipo_cobranca",
  // Logística
  "motorista_entrega": "motorista_entrega", "motorista": "motorista_entrega",
  "veiculo_entrega": "veiculo_entrega", "veiculo": "veiculo_entrega",
  // Observações
  "observacoes": "observacoes", "observações": "observacoes", "obs": "observacoes",
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const headers = rawHeaders.map(h => HEADER_MAP[h] || h);
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { if (vals[i] !== undefined && vals[i] !== "") obj[h] = vals[i]; });
    return obj;
  }).filter(row => Object.values(row).some(v => v));
}

// Agrupa linhas pelo número do contrato (para múltiplos equipamentos)
function groupByContract(rows) {
  const map = new Map();
  const order = [];
  rows.forEach(row => {
    const key = row.numero || row.client_cpf_cnpj || row.client_codigo || row.client_nome || `row_${Math.random()}`;
    if (!map.has(key)) {
      map.set(key, { ...row, _itens: [] });
      order.push(key);
    }
    const base = map.get(key);
    // Se tem campo de equipamento, adicionar como item
    if (row.equipamento_codigo || row.equipamento_nome) {
      base._itens.push({
        equipamento_codigo: row.equipamento_codigo || "",
        equipamento_nome: row.equipamento_nome || "",
        quantidade_retirada: parseFloat(row.quantidade_retirada) || 1,
        valor_unitario: parseFloat(row.valor_unitario) || 0,
        desconto: parseFloat(row.desconto_item) || 0,
        tipo_cobranca: row.tipo_cobranca || "diario",
        quantidade_devolvida: 0,
      });
    }
  });
  return order.map(k => map.get(k));
}

const TEMPLATE_HEADER = "numero;status;status_financeiro;tipo_entrega;cliente_cpf_cnpj;cliente_codigo;cliente_nome;solicitante_nome;solicitante_tipo;obra_nome;obra_endereco;endereco_entrega;data_inicio;prazo_valor;prazo_tipo;data_prevista_termino;frete;sinal;valor_pago;motorista_entrega;veiculo_entrega;equipamento_codigo;equipamento_nome;quantidade;valor_unitario;desconto_item;tipo_cobranca;observacoes";
const TEMPLATE_ROW1 = ";rascunho;pendente;entrega;123.456.789-09;0001;João da Silva;João da Silva;cliente;Obra Central;Rua A, 100;Rua A, 100 - Centro;2026-05-01;30;dias;2026-05-31;50;0;0;Motorista 1;ABC-1234;ANDAIME-01;Andaime Tubular;10;5.00;0;diario;Observações gerais";
const TEMPLATE_ROW2 = ";;;;;;;;;;;;;;;;;;;;;;ANDAIME-02;Andaime Fachadeiro;5;4.50;0;diario;";

export default function ContractImportModal({ open, onClose, onDone }) {
  const [step, setStep] = useState("upload");
  const [rows, setRows] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    const grp = groupByContract(parsed);
    setRows(parsed);
    setGrouped(grp);
    setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");

    // Pré-carregar clientes e equipamentos
    const [allClients, allEquipment, allContracts] = await Promise.all([
      base44.entities.Client.list("-created_date", 2000).catch(() => []),
      base44.entities.Equipment.list().catch(() => []),
      base44.entities.Contract.list("-created_date", 2000).catch(() => []),
    ]);

    const clientByDoc = {};
    const clientByCodigo = {};
    allClients.forEach(c => {
      if (c.cpf_cnpj) clientByDoc[c.cpf_cnpj.replace(/\D/g, "")] = c;
      if (c.codigo_cliente) clientByCodigo[c.codigo_cliente.trim()] = c;
    });

    const equipByCodigo = {};
    const equipByNome = {};
    allEquipment.forEach(e => {
      if (e.codigo) equipByCodigo[e.codigo.trim().toLowerCase()] = e;
      if (e.nome) equipByNome[e.nome.trim().toLowerCase()] = e;
    });

    const contractByNumero = {};
    allContracts.forEach(c => {
      if (c.numero) contractByNumero[c.numero.trim()] = c;
    });

    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < grouped.length; i++) {
      const row = grouped[i];
      setProgress(Math.round(((i + 1) / grouped.length) * 100));
      const lineNum = i + 2;
      const label = row.numero || row.client_nome || `#${lineNum}`;

      // Localizar cliente
      let clientRecord = null;
      if (row.client_cpf_cnpj) {
        const digits = row.client_cpf_cnpj.replace(/\D/g, "");
        clientRecord = clientByDoc[digits] || null;
      }
      if (!clientRecord && row.client_codigo) {
        clientRecord = clientByCodigo[row.client_codigo.trim()] || null;
      }
      if (!clientRecord && row.client_nome) {
        clientRecord = allClients.find(c => c.nome_razao_social?.toLowerCase() === row.client_nome?.toLowerCase()) || null;
      }
      if (!clientRecord) {
        errors.push({ row: lineNum, nome: label, reason: "Cliente não encontrado (verifique CPF/CNPJ, código ou nome)" });
        continue;
      }

      // Resolver equipamentos
      const itens = (row._itens || []).map((item, idx) => {
        const codigoKey = (item.equipamento_codigo || "").toLowerCase();
        const nomeKey = (item.equipamento_nome || "").toLowerCase();
        const eq = equipByCodigo[codigoKey] || equipByNome[nomeKey] || null;
        return {
          equipamento_id: eq?.id || "",
          equipamento_nome: eq?.nome || item.equipamento_nome || "",
          equipamento_foto: eq?.foto_url || "",
          equipamento_tipo: eq?.tipo || "",
          quantidade_retirada: item.quantidade_retirada || 1,
          valor_unitario: item.valor_unitario || eq?.valor_diario || 0,
          valor_diario: eq?.valor_diario || 0,
          desconto: item.desconto || 0,
          tipo_cobranca: item.tipo_cobranca || "diario",
          quantidade_devolvida: 0,
          aplica_valor_minimo: eq?.aplica_valor_minimo !== false,
          dias_minimos_proprio: eq?.dias_minimos_proprio || 0,
          _equipNaoEncontrado: !eq,
          _equipLabel: item.equipamento_codigo || item.equipamento_nome,
        };
      });

      // Avisar sobre equipamentos não encontrados (mas não bloquear)
      const naoEncontrados = itens.filter(it => it._equipNaoEncontrado && it._equipLabel);
      if (naoEncontrados.length > 0) {
        errors.push({ row: lineNum, nome: label, reason: `Equipamento(s) não encontrado(s): ${naoEncontrados.map(e => e._equipLabel).join(", ")} — item importado sem vínculo` });
      }

      // Montar dados do contrato
      const dataToSave = {
        client_id: clientRecord.id,
        client_nome: clientRecord.nome_razao_social,
        solicitante_nome: row.solicitante_nome || clientRecord.nome_razao_social,
        solicitante_tipo: row.solicitante_tipo || "cliente",
        obra_nome: row.obra_nome || "",
        obra_endereco: row.obra_endereco || "",
        endereco_entrega: row.endereco_entrega || "",
        data_inicio: row.data_inicio || new Date().toISOString().split("T")[0],
        prazo_valor: parseFloat(row.prazo_valor) || 30,
        prazo_tipo: row.prazo_tipo || "dias",
        data_prevista_termino: row.data_prevista_termino || "",
        frete: parseFloat(row.frete) || 0,
        sinal: parseFloat(row.sinal) || 0,
        valor_pago: parseFloat(row.valor_pago) || 0,
        valor_total: parseFloat(row.valor_total) || 0,
        saldo_pagar: (parseFloat(row.valor_total) || 0) - (parseFloat(row.valor_pago) || 0),
        status: row.status || "rascunho",
        status_financeiro: row.status_financeiro || "pendente",
        tipo_entrega: row.tipo_entrega || "entrega",
        motorista_entrega: row.motorista_entrega || "",
        veiculo_entrega: row.veiculo_entrega || "",
        observacoes: row.observacoes || "",
        itens: itens.map(({ _equipNaoEncontrado, _equipLabel, ...rest }) => rest),
      };

      // Verificar se contrato já existe pelo número
      const existingContract = row.numero ? contractByNumero[row.numero.trim()] : null;

      if (existingContract) {
        if (updateExisting) {
          try {
            await base44.entities.Contract.update(existingContract.id, dataToSave);
            contractByNumero[row.numero.trim()] = { ...existingContract, ...dataToSave };
            updated++;
          } catch {
            errors.push({ row: lineNum, nome: label, reason: "Erro ao atualizar contrato" });
          }
        } else {
          errors.push({ row: lineNum, nome: label, reason: `Contrato #${row.numero} já existe (atualização desativada)` });
        }
      } else {
        try {
          if (!dataToSave.numero) {
            const num = await getNextNumber("contrato");
            dataToSave.numero = String(num);
          }
          const novo = await base44.entities.Contract.create(dataToSave);
          if (dataToSave.numero) contractByNumero[dataToSave.numero] = novo;
          created++;
        } catch {
          errors.push({ row: lineNum, nome: label, reason: "Erro ao criar contrato" });
        }
      }
    }

    setResult({ created, updated, errors });
    setStep("result");
  };

  const reset = () => {
    setStep("upload");
    setRows([]);
    setGrouped([]);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const content = [TEMPLATE_HEADER, TEMPLATE_ROW1, TEMPLATE_ROW2].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_contratos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Contratos (CSV)
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-2">
              <p className="font-semibold">Formato: CSV (separado por ponto-e-vírgula ou vírgula)</p>
              <p>Use <strong>uma linha por equipamento</strong> do mesmo contrato. Repita o número do contrato em cada linha para agrupamento automático.</p>
              <p className="text-xs font-mono">Campos obrigatórios: <strong>cliente_cpf_cnpj</strong> (ou <strong>cliente_codigo</strong> ou <strong>cliente_nome</strong>) + <strong>data_inicio</strong></p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="gap-2 flex-1" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> Baixar Modelo CSV
              </Button>
              <label className="flex-1">
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                <span className="flex items-center justify-center gap-2 w-full h-9 px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <FileText className="w-4 h-4" /> Selecionar Arquivo CSV
                </span>
              </label>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground mb-1">Colunas suportadas:</p>
              <p><strong>Identificação:</strong> numero, status, status_financeiro, tipo_entrega</p>
              <p><strong>Cliente:</strong> cliente_cpf_cnpj, cliente_codigo, cliente_nome</p>
              <p><strong>Obra/Solicitante:</strong> solicitante_nome, solicitante_tipo, obra_nome, obra_endereco, endereco_entrega</p>
              <p><strong>Datas:</strong> data_inicio, prazo_valor, prazo_tipo, data_prevista_termino</p>
              <p><strong>Financeiro:</strong> frete, sinal, valor_pago, valor_total</p>
              <p><strong>Equipamentos:</strong> equipamento_codigo, equipamento_nome, quantidade, valor_unitario, desconto_item, tipo_cobranca</p>
              <p><strong>Logística:</strong> motorista_entrega, veiculo_entrega</p>
              <p><strong>Outros:</strong> observacoes</p>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === "preview" && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-muted/50 text-sm">
              <span className="font-semibold">{grouped.length} contrato(s)</span> encontrado(s) no arquivo ({rows.length} linha(s) total).
            </div>

            <div className="overflow-x-auto rounded-xl border text-xs">
              <table className="w-full min-w-max">
                <thead className="bg-muted">
                  <tr>
                    {["Nº", "Cliente", "Obra", "Data Início", "Equipamentos", "Valor Total"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.slice(0, 6).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{row.numero || "—"}</td>
                      <td className="px-3 py-1.5">{row.client_nome || row.client_cpf_cnpj || "—"}</td>
                      <td className="px-3 py-1.5">{row.obra_nome || "—"}</td>
                      <td className="px-3 py-1.5">{row.data_inicio || "—"}</td>
                      <td className="px-3 py-1.5">{row._itens?.length || 0} item(s)</td>
                      <td className="px-3 py-1.5">{row.valor_total ? `R$ ${row.valor_total}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {grouped.length > 6 && (
                <p className="text-xs text-muted-foreground text-center py-2">... e mais {grouped.length - 6} contrato(s)</p>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-xl border bg-muted/30">
              <p className="text-sm font-semibold">Opções de importação</p>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Atualizar contratos existentes (UPSERT)</Label>
                  <p className="text-xs text-muted-foreground">Se o nº do contrato já existir, atualiza os dados</p>
                </div>
                <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} />
              </div>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === "importing" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <RefreshCw className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium">Importando... {progress}%</p>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Não feche esta janela</p>
          </div>
        )}

        {/* STEP: RESULT */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                <p className="text-xs text-emerald-600 mt-1">Criados</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600 mt-1">Atualizados</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                <p className="text-xs text-red-600 mt-1">Com aviso/erro</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Avisos e erros
                </p>
                <div className="max-h-48 overflow-y-auto rounded-xl border divide-y text-xs">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2 flex gap-3">
                      <span className="text-muted-foreground shrink-0">Linha {e.row}</span>
                      <span className="font-medium truncate">{e.nome}</span>
                      <span className="text-destructive ml-auto shrink-0 text-right">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.created + result.updated > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Importação concluída!
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          {step === "upload" && (
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={runImport} disabled={grouped.length === 0}>
                Importar {grouped.length} contrato(s)
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Nova Importação</Button>
              <Button onClick={() => { reset(); onClose(); onDone?.(); }}>
                Concluir
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}