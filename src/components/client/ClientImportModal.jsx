import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Download } from "lucide-react";

const HEADER_MAP = {
  // Padrão novo (inglês)
  "external_id": "external_id",
  "nome": "nome_razao_social",
  "trade_name": "fantasia",
  "cpf_cnpj": "cpf_cnpj",
  "type": "tipo_csv",
  "email": "email",
  "phone": "telefone1",
  "phone2": "telefone2",
  "phone3": "telefone3",
  "birth_date": "data_nascimento",
  "street": "endereco_entrega_rua",
  "number": "endereco_entrega_numero",
  "neighborhood": "endereco_entrega_bairro",
  "city": "endereco_entrega_cidade",
  "state": "endereco_entrega_uf",
  "zip_code": "endereco_entrega_cep",
  "notes": "observacoes",
  "father_name": "nome_pai",
  "mother_name": "nome_mae",
  // Legado (português)
  "codigo": "codigo_cliente", "código": "codigo_cliente", "cod": "codigo_cliente", "codigo_cliente": "codigo_cliente",
  "razao_social": "nome_razao_social", "nome_razao_social": "nome_razao_social",
  "fantasia": "fantasia", "nome_fantasia": "fantasia",
  "cpf": "cpf_cnpj", "cnpj": "cpf_cnpj", "documento": "cpf_cnpj",
  "telefone": "telefone1", "telefone1": "telefone1", "celular": "telefone1", "fone": "telefone1",
  "telefone2": "telefone2", "fone2": "telefone2",
  "rua": "endereco_entrega_rua", "logradouro": "endereco_entrega_rua", "endereco": "endereco_entrega_rua",
  "numero": "endereco_entrega_numero", "número": "endereco_entrega_numero",
  "complemento": "endereco_entrega_complemento",
  "bairro": "endereco_entrega_bairro",
  "cidade": "endereco_entrega_cidade", "municipio": "endereco_entrega_cidade",
  "uf": "endereco_entrega_uf", "estado": "endereco_entrega_uf",
  "cep": "endereco_entrega_cep",
  "observacoes": "observacoes", "observações": "observacoes", "obs": "observacoes",
  "nome_pai": "nome_pai", "pai": "nome_pai",
  "nome_mae": "nome_mae", "mae": "nome_mae",
  "data_nascimento": "data_nascimento", "nascimento": "data_nascimento",
  "tipo_perfil": "tipo_csv",
  "data_renovacao": "data_renovacao", "renovacao": "data_renovacao", "data_validade": "data_renovacao",
  "data_validade_cadastro": "data_validade_cadastro",
};

// Converte datas nos formatos DD/MM/YYYY, YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS para YYYY-MM-DD
function parseDate(val) {
  if (!val || !val.trim()) return null;
  const v = val.trim();
  // DD/MM/YYYY
  const dmyMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  // YYYY-MM-DD ou YYYY-MM-DDTHH:...
  const isoMatch = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return null;
}

function mapTipoPerfil(tipo_csv, cpf_cnpj) {
  const t = (tipo_csv || "").toUpperCase().trim();
  if (t === "PJ" || t === "CNPJ") return "cnpj";
  if (t === "EMPREITEIRO") return "empreiteiro";
  const digits = (cpf_cnpj || "").replace(/\D/g, "");
  if (digits.length === 14) return "cnpj";
  return "comum";
}

async function readFileText(file) {
  // Tenta UTF-8; se houver caractere de substituição, relê como Latin-1
  let text = await file.text();
  if (text.includes("\uFFFD")) {
    text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsText(file, "ISO-8859-1");
    });
  }
  return text;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
  const headers = rawHeaders.map(h => HEADER_MAP[h] || h);
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v.trim()));
}

export default function ClientImportModal({ open, onClose, onDone }) {
  const [step, setStep] = useState("upload");
  const [rows, setRows] = useState([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileText(file);
    const parsed = parseCSV(text);
    setRows(parsed);
    setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");
    let created = 0;
    let updated = 0;
    const errors = [];

    // Normaliza CPF/CNPJ removendo tudo que não é dígito
    const normDoc = (v) => (v || "").replace(/\D/g, "").toLowerCase();
    // Normaliza strings de chave (lower + trim)
    const normKey = (v) => (v || "").trim().toLowerCase();

    // Busca TODOS os clientes em páginas de 500 para não perder nenhum
    setProgress(1);
    const existingClients = [];
    let page = 0;
    const PAGE_SIZE = 500;
    while (true) {
      const chunk = await base44.entities.Client.list("-created_date", PAGE_SIZE, page * PAGE_SIZE).catch(() => []);
      existingClients.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
      page++;
    }

    // Monta índices de busca rápida para evitar O(n²)
    const idxCpf = new Map();
    const idxExtId = new Map();
    const idxCodigo = new Map();
    for (const c of existingClients) {
      const cpfNorm = normDoc(c.cpf_cnpj);
      const extNorm = normKey(c.external_id);
      const codNorm = normKey(c.codigo_cliente);
      if (cpfNorm) idxCpf.set(cpfNorm, c);
      if (extNorm) idxExtId.set(extNorm, c);
      if (codNorm) idxCodigo.set(codNorm, c);
    }

    // Pré-deduplica o próprio CSV: mantém a última ocorrência por chave
    const csvDeduped = [];
    const csvSeen = new Map(); // key → index em csvDeduped
    for (const row of rows) {
      const nome = (row.nome_razao_social || "").trim();
      if (!nome) continue;
      const cpfNorm = normDoc(row.cpf_cnpj);
      const extNorm = normKey(row.external_id);
      const codNorm = normKey(row.codigo_cliente);
      const dedupeKey = cpfNorm || extNorm || codNorm || nome.toLowerCase();
      if (csvSeen.has(dedupeKey)) {
        // Substitui linha anterior pela mais recente
        csvDeduped[csvSeen.get(dedupeKey)] = row;
      } else {
        csvSeen.set(dedupeKey, csvDeduped.length);
        csvDeduped.push(row);
      }
    }

    setProgress(5);

    for (let i = 0; i < csvDeduped.length; i++) {
      const row = csvDeduped[i];
      setProgress(5 + Math.round(((i + 1) / csvDeduped.length) * 95));

      const nome = (row.nome_razao_social || "").trim();
      if (!nome) continue;

      const dataToSave = {
        nome_razao_social: nome,
        tipo_perfil: mapTipoPerfil(row.tipo_csv, row.cpf_cnpj),
        fantasia: row.fantasia || "",
        cpf_cnpj: row.cpf_cnpj || "",
        external_id: row.external_id || "",
        email: row.email || "",
        telefone1: row.telefone1 || "",
        telefone2: row.telefone2 || "",
        telefone3: row.telefone3 || "",
        data_nascimento: row.data_nascimento || "",
        endereco_entrega_rua: row.endereco_entrega_rua || "",
        endereco_entrega_numero: row.endereco_entrega_numero || "",
        endereco_entrega_complemento: row.endereco_entrega_complemento || "",
        endereco_entrega_bairro: row.endereco_entrega_bairro || "",
        endereco_entrega_cidade: row.endereco_entrega_cidade || "",
        endereco_entrega_uf: row.endereco_entrega_uf || "",
        endereco_entrega_cep: row.endereco_entrega_cep || "",
        observacoes: row.observacoes || "",
        nome_pai: row.nome_pai || "",
        nome_mae: row.nome_mae || "",
        codigo_cliente: row.codigo_cliente || "",
      };

      // Datas: só adiciona ao payload se vier preenchido no CSV e for uma data válida
      const dataValidade = parseDate(row.data_validade_cadastro);
      if (dataValidade) dataToSave.data_validade_cadastro = dataValidade;

      const dataRenovacao = parseDate(row.data_renovacao);
      if (dataRenovacao) dataToSave.data_renovacao = dataRenovacao;

      // Remove campos vazios para não sobrescrever com ""
      Object.keys(dataToSave).forEach(k => { if (!dataToSave[k]) delete dataToSave[k]; });

      // Busca nos índices por qualquer chave-chave
      const cpfNorm = normDoc(dataToSave.cpf_cnpj);
      const extNorm = normKey(dataToSave.external_id);
      const codNorm = normKey(dataToSave.codigo_cliente);

      const existing =
        (cpfNorm && idxCpf.get(cpfNorm)) ||
        (extNorm && idxExtId.get(extNorm)) ||
        (codNorm && idxCodigo.get(codNorm));

      try {
        if (existing) {
          await base44.entities.Client.update(existing.id, dataToSave);
          // Atualiza os índices com os novos valores do CSV
          const newCpf = normDoc(dataToSave.cpf_cnpj);
          const newExt = normKey(dataToSave.external_id);
          const newCod = normKey(dataToSave.codigo_cliente);
          if (newCpf) idxCpf.set(newCpf, existing);
          if (newExt) idxExtId.set(newExt, existing);
          if (newCod) idxCodigo.set(newCod, existing);
          Object.assign(existing, dataToSave);
          updated++;
        } else {
          const newClient = await base44.entities.Client.create(dataToSave);
          // Indexa o novo cliente imediatamente para bloquear duplicatas no mesmo lote
          if (newClient) {
            const nCpf = normDoc(newClient.cpf_cnpj);
            const nExt = normKey(newClient.external_id);
            const nCod = normKey(newClient.codigo_cliente);
            if (nCpf) idxCpf.set(nCpf, newClient);
            if (nExt) idxExtId.set(nExt, newClient);
            if (nCod) idxCodigo.set(nCod, newClient);
          }
          created++;
        }
      } catch (err) {
        errors.push({ row: i + 2, nome, reason: err?.message || "Erro ao importar" });
      }
    }

    setResult({ created, updated, errors });
    setStep("result");
  };

  const reset = () => {
    setStep("upload");
    setRows([]);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const csv =
      "external_id;nome;trade_name;cpf_cnpj;type;email;phone;phone2;birth_date;street;number;neighborhood;city;state;zip_code;notes;father_name;mother_name\r\n" +
      "CLI001;João da Silva;;123.456.789-09;PF;joao@email.com;(11) 99999-9999;;1985-05-10;Rua A;123;Centro;São Paulo;SP;01001-000;Observação;Carlos Silva;Maria Silva\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_importacao_clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Clientes (CSV)
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Formato: CSV separado por vírgula ou ponto-e-vírgula</p>
              <p className="text-xs font-mono">Colunas: external_id, nome, trade_name, cpf_cnpj, type, email, phone, street, neighborhood, city, state, zip_code, notes, father_name, mother_name</p>
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
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/50 text-sm">
              <span className="font-semibold">{rows.length} registro(s)</span> encontrado(s) no arquivo.
            </div>
            <div className="overflow-x-auto rounded-xl border text-xs">
              <table className="w-full min-w-max">
                <thead className="bg-muted">
                  <tr>
                    {["External ID", "Nome", "CPF/CNPJ", "Telefone", "Cidade"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{row.external_id || "—"}</td>
                      <td className="px-3 py-1.5 font-medium">{row.nome_razao_social || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{row.cpf_cnpj || "—"}</td>
                      <td className="px-3 py-1.5">{row.telefone1 || "—"}</td>
                      <td className="px-3 py-1.5">{row.endereco_entrega_cidade || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && (
                <p className="text-xs text-muted-foreground text-center py-2">... e mais {rows.length - 8} registro(s)</p>
              )}
            </div>
          </div>
        )}

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
                <p className="text-xs text-red-600 mt-1">Com erro</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border divide-y text-xs">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-3 py-2 flex gap-3">
                    <span className="text-muted-foreground shrink-0">Linha {e.row}</span>
                    <span className="font-medium truncate">{e.nome}</span>
                    <span className="text-destructive ml-auto shrink-0">{e.reason}</span>
                  </div>
                ))}
              </div>
            )}
            {(result.created > 0 || result.updated > 0) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {result.created > 0 && <span>{result.created} criado(s)</span>}
                {result.created > 0 && result.updated > 0 && <span>·</span>}
                {result.updated > 0 && <span>{result.updated} atualizado(s)</span>}
                <span>sem duplicatas!</span>
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
              <Button onClick={runImport} disabled={rows.length === 0}>
                Importar {rows.length} registro(s)
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Nova Importação</Button>
              <Button onClick={() => { reset(); onClose(); onDone?.(); }}>Concluir</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}