import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, FileText, FileSpreadsheet, File, Trash2,
  CheckCircle2, AlertCircle, RefreshCw, Power, PowerOff,
  BookOpen, Pencil, X, Check, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_ACEITOS = ".txt,.pdf,.docx,.xlsx,.csv,.doc,.xls";

const TIPO_ICONE = {
  pdf:  { icon: FileText,        color: "text-red-500",     bg: "bg-red-50"     },
  xlsx: { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-50" },
  xls:  { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-50" },
  csv:  { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-50" },
  docx: { icon: FileText,        color: "text-blue-600",    bg: "bg-blue-50"    },
  doc:  { icon: FileText,        color: "text-blue-600",    bg: "bg-blue-50"    },
  txt:  { icon: FileText,        color: "text-slate-600",   bg: "bg-slate-50"   },
};

function tipoArquivo(nome) {
  return (nome || "").split(".").pop().toLowerCase();
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// Sub-componente para editar a descrição de um arquivo
function DescricaoArquivo({ arq, onSave }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(arq.descricao || "");

  const salvar = () => {
    onSave(arq.id, texto.trim());
    setEditando(false);
  };

  const cancelar = () => {
    setTexto(arq.descricao || "");
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="mt-2 space-y-1.5">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder='Ex: "Tabela oficial de preços de andaimes. Usar sempre para orçamento."'
          className="text-xs min-h-[64px] resize-none bg-indigo-50/50 border-indigo-200 focus-visible:ring-indigo-400"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={salvar}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 transition-colors"
          >
            <Check className="w-3 h-3" /> Salvar contexto
          </button>
          <button
            onClick={cancelar}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3 h-3" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {arq.descricao ? (
        <div
          className="group flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50 border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors"
          onClick={() => { setTexto(arq.descricao || ""); setEditando(true); }}
        >
          <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed flex-1 italic">"{arq.descricao}"</p>
          <Pencil className="w-3 h-3 text-indigo-300 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />
        </div>
      ) : (
        <button
          onClick={() => { setTexto(""); setEditando(true); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-dashed border-border/60 hover:border-indigo-300 transition-all w-full"
        >
          <MessageSquare className="w-3 h-3" />
          <span>+ Adicionar descrição / contexto para a IA</span>
        </button>
      )}
    </div>
  );
}

export default function BaseConhecimentoIA({ arquivos, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [editandoNomeId, setEditandoNomeId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);

    const novos = [...(arquivos || [])];
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        novos.push({
          id: Date.now() + Math.random(),
          nome: file.name,
          descricao: "",
          url: file_url,
          tamanho: file.size,
          tipo: tipoArquivo(file.name),
          data_upload: new Date().toISOString(),
          ativo: true,
          status: "disponivel",
        });
        toast.success(`"${file.name}" enviado com sucesso!`);
      } catch {
        toast.error(`Erro ao enviar "${file.name}"`);
      }
    }
    onUpdate(novos);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAtivo = (id) => {
    onUpdate((arquivos || []).map((a) => a.id === id ? { ...a, ativo: !a.ativo } : a));
  };

  const remover = (id) => {
    onUpdate((arquivos || []).filter((a) => a.id !== id));
  };

  const salvarNome = (id) => {
    if (!editNome.trim()) return;
    onUpdate((arquivos || []).map((a) => a.id === id ? { ...a, nome: editNome.trim() } : a));
    setEditandoNomeId(null);
  };

  const salvarDescricao = (id, descricao) => {
    onUpdate((arquivos || []).map((a) => a.id === id ? { ...a, descricao } : a));
    toast.success("Contexto salvo!");
  };

  const ativos = (arquivos || []).filter((a) => a.ativo).length;
  const comDescricao = (arquivos || []).filter((a) => a.descricao?.trim()).length;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500 bg-indigo-50/30">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          📚 Base de Conhecimento
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Envie arquivos e adicione uma <strong>descrição/contexto</strong> para cada um. A IA usará tanto o conteúdo quanto o contexto ao responder clientes.
        </p>

        {/* Dica */}
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 space-y-1">
          <p className="font-semibold">💡 Dica: descreva cada arquivo para a IA entender melhor</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li><strong>tabela_precos.xlsx</strong> → "Tabela oficial de preços para orçamento"</li>
            <li><strong>regras_entrega.pdf</strong> → "Regras internas de entrega, recolha e cobrança mínima"</li>
            <li><strong>script_vendas.txt</strong> → "Script de abordagem para novos clientes"</li>
          </ul>
        </div>

        {/* Contadores */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-xs font-medium">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            {(arquivos || []).length} arquivo(s)
          </div>
          {ativos > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              {ativos} ativo(s)
            </div>
          )}
          {comDescricao > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
              <MessageSquare className="w-3 h-3" />
              {comDescricao} com contexto
            </div>
          )}
        </div>

        {/* Área de upload */}
        <div
          className="relative border-2 border-dashed border-indigo-300 rounded-xl p-6 text-center hover:border-indigo-500 hover:bg-indigo-50/60 transition-all cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" multiple accept={TIPOS_ACEITOS} className="hidden" onChange={handleUpload} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-indigo-700">Enviando arquivo(s)...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-7 h-7 text-indigo-400" />
              <p className="text-sm font-medium text-foreground">Clique para enviar arquivos</p>
              <p className="text-xs text-muted-foreground">PDF, Word, Excel, CSV, TXT — múltiplos arquivos</p>
            </div>
          )}
        </div>

        {/* Lista de arquivos */}
        {(arquivos || []).length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground opacity-60">
            Nenhum arquivo na base de conhecimento ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {(arquivos || []).map((arq) => {
              const tipo = tipoArquivo(arq.nome);
              const tipoInfo = TIPO_ICONE[tipo] || { icon: File, color: "text-slate-500", bg: "bg-slate-50" };
              const IconeTipo = tipoInfo.icon;
              const estaEditandoNome = editandoNomeId === arq.id;

              return (
                <div
                  key={arq.id}
                  className={`p-3 rounded-xl border transition-all ${
                    arq.ativo ? "bg-white border-border" : "bg-muted/30 border-border/40 opacity-60"
                  }`}
                >
                  {/* Linha superior: ícone + nome + ações */}
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tipoInfo.bg}`}>
                      <IconeTipo className={`w-4 h-4 ${tipoInfo.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {estaEditandoNome ? (
                        <div className="flex items-center gap-2 mb-1">
                          <Input
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="h-7 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") salvarNome(arq.id);
                              if (e.key === "Escape") setEditandoNomeId(null);
                            }}
                          />
                          <button onClick={() => salvarNome(arq.id)} className="p-1 hover:bg-emerald-50 rounded text-emerald-600">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditandoNomeId(null)} className="p-1 hover:bg-slate-100 rounded text-muted-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-medium truncate">{arq.nome}</p>
                          <button
                            onClick={() => { setEditandoNomeId(arq.id); setEditNome(arq.nome); }}
                            className="shrink-0 p-0.5 hover:bg-slate-100 rounded text-muted-foreground/50 hover:text-foreground"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="uppercase font-semibold text-indigo-600">{tipo}</span>
                        <span>{formatBytes(arq.tamanho)}</span>
                        <span>{formatDate(arq.data_upload)}</span>
                        {arq.url && (
                          <a href={arq.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Visualizar
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status + toggle + remover */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {arq.ativo ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Ativo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted border text-muted-foreground font-medium">
                          <AlertCircle className="w-2.5 h-2.5" /> Inativo
                        </span>
                      )}
                      <button
                        onClick={() => toggleAtivo(arq.id)}
                        title={arq.ativo ? "Desativar" : "Ativar"}
                        className={`p-1.5 rounded-lg transition-colors ${arq.ativo ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                      >
                        {arq.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => remover(arq.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Campo de descrição/contexto */}
                  <DescricaoArquivo arq={arq} onSave={salvarDescricao} />
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé informativo */}
        {ativos > 0 && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Base de conhecimento ativa</p>
              <p className="opacity-80 mt-0.5">
                {ativos} arquivo(s) disponível(is). {comDescricao > 0 ? `${comDescricao} com contexto — a IA entenderá melhor a finalidade de cada documento.` : "Adicione descrições para melhorar a interpretação da IA."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}