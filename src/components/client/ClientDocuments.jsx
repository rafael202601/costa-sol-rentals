import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Eye, Download, FileText, Image, File, Camera } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["Contrato", "Documento Pessoal", "Comprovante", "RG/CPF", "CNH", "Outros"];

function FileIcon({ nome }) {
  const ext = (nome || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <Image className="w-4 h-4 text-blue-500" />;
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

export default function ClientDocuments({ clientId, fotoUrl, onFotoChange }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [tipoNovo, setTipoNovo] = useState("Outros");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    if (clientId) loadDocs();
  }, [clientId]);

  const loadDocs = () => {
    // Armazenamos docs como array no campo do cliente para simplicidade
    base44.entities.Client.filter({ id: clientId }).then(([c]) => {
      if (c) setDocs(c.documentos || []);
    });
  };

  const saveDocs = async (newDocs) => {
    await base44.entities.Client.update(clientId, { documentos: newDocs });
    setDocs(newDocs);
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Client.update(clientId, { foto_url: file_url });
    onFotoChange?.(file_url);
    toast.success("Foto atualizada!");
    setUploadingFoto(false);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo deve ter no máximo 20MB"); return; }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const user = currentUser;
    const newDoc = {
      nome: file.name,
      url: file_url,
      tipo: tipoNovo,
      data: new Date().toISOString(),
      usuario: user?.full_name || user?.email || "Sistema",
    };
    const updated = [...docs, newDoc];
    await saveDocs(updated);
    toast.success("Documento enviado!");
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (idx) => {
    if (!confirm("Excluir este documento?")) return;
    const updated = docs.filter((_, i) => i !== idx);
    await saveDocs(updated);
    toast.success("Documento excluído.");
  };

  const isAdmin = ["admin", "Admin"].includes(currentUser?.role || "");

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          📁 Foto e Documentos do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* FOTO */}
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
            {fotoUrl ? (
              <img src={fotoUrl} alt="Foto do cliente" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-muted-foreground/40" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto do Cliente</p>
            <p className="text-xs text-muted-foreground">JPG, PNG. Máx 5MB.</p>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors ${uploadingFoto ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-3.5 h-3.5" />
                {uploadingFoto ? "Enviando..." : fotoUrl ? "Trocar Foto" : "Enviar Foto"}
              </span>
            </label>
            {fotoUrl && (
              <button onClick={async () => { await base44.entities.Client.update(clientId, { foto_url: "" }); onFotoChange?.(""); toast.success("Foto removida."); }}
                className="text-xs text-destructive hover:underline block">
                Remover foto
              </button>
            )}
          </div>
        </div>

        {/* DOCUMENTOS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Documentos Anexos</p>
          </div>

          {/* Upload */}
          <div className="flex gap-2 mb-4">
            <Select value={tipoNovo} onValueChange={setTipoNovo}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="cursor-pointer flex-1">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleDocUpload} disabled={uploading} />
              <span className={`flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-lg border border-dashed text-xs font-medium hover:bg-muted transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Enviando..." : "Selecionar Arquivo"}
              </span>
            </label>
          </div>

          {/* Lista */}
          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl">Nenhum documento anexado</p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <FileIcon nome={doc.nome} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.tipo} · {doc.data ? new Date(doc.data).toLocaleDateString("pt-BR") : ""} · {doc.usuario}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <a href={doc.url} download={doc.nome}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => handleDelete(idx)} title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}