import { useState, useRef } from "react";
import { Camera, Images, Loader2, X, ZoomIn, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * DriverPhotoUpload — botão compacto para o motorista anexar fotos durante entrega/recolha.
 * Salva diretamente no contrato/OS no campo `fotos`, com metadado de tipo (entrega|recolha).
 *
 * Props:
 *   docTipo: "contrato" | "os"
 *   docId: string
 *   tipoFoto: "entrega" | "recolha"
 *   driverName: string
 *   currentFotos: array de fotos já existentes
 *   onUploaded: () => void — callback para recarregar dados
 */
export default function DriverPhotoUpload({ docTipo, docId, tipoFoto, driverName, currentFotos = [], onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const inputRef = useRef(null);

  // Filtra apenas fotos do tipo desta seção
  const fotosDoTipo = currentFotos.filter(f => f.tipo === tipoFoto);
  const label = tipoFoto === "entrega" ? "Entrega" : "Recolha";
  const color = tipoFoto === "entrega" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700";
  const colorLight = tipoFoto === "entrega" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-200 text-amber-800";

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const now = format(new Date(), "dd/MM/yyyy HH:mm");
    const usuario = driverName || "Motorista";

    const newEntries = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} muito grande (máx 20MB)`);
        continue;
      }
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newEntries.push({
          url: file_url,
          data_hora: now,
          usuario,
          descricao: `${label} — ${file.name}`,
          tipo: tipoFoto,
        });
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (newEntries.length > 0) {
      // Busca fotos atuais diretamente do banco antes de salvar
      // Evita sobrescrever fotos existentes caso currentFotos esteja desatualizado
      const entity = docTipo === "contrato" ? base44.entities.Contract : base44.entities.ServiceOrder;
      const allDocs = await entity.list().catch(() => []);
      const docAtual = allDocs.find(d => d.id === docId);
      const fotosAtuais = docAtual?.fotos || currentFotos;

      const todasFotos = [...fotosAtuais, ...newEntries];
      await entity.update(docId, { fotos: todasFotos });
      toast.success(`${newEntries.length} foto(s) de ${label.toLowerCase()} salva(s)!`);
      onUploaded?.();
    }
    setUploading(false);
  };

  const prev = () => setLightbox(i => (i > 0 ? i - 1 : fotosDoTipo.length - 1));
  const next = () => setLightbox(i => (i < fotosDoTipo.length - 1 ? i + 1 : 0));

  return (
    <div className="space-y-2">
      {/* Botões de ação */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Câmera (mobile-first: capture=environment) */}
        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer ${color} transition-all active:scale-95`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {uploading ? "Enviando..." : `📷 Foto de ${label}`}
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>

        {/* Galeria / arquivo */}
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer hover:bg-muted transition-all active:scale-95">
          <Images className="w-4 h-4" />
          Galeria
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>

        {/* Contador de fotos deste tipo */}
        {fotosDoTipo.length > 0 && (
          <button
            onClick={() => setShowGallery(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${colorLight}`}
          >
            <Images className="w-3.5 h-3.5" />
            {fotosDoTipo.length} foto(s) — {showGallery ? "Ocultar" : "Ver"}
          </button>
        )}
      </div>

      {/* Mini galeria inline */}
      {showGallery && fotosDoTipo.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {fotosDoTipo.map((foto, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted shadow-sm cursor-pointer group"
              onClick={() => setLightbox(i)}
            >
              <img
                src={foto.url}
                alt={foto.descricao || `Foto ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <ZoomIn className="w-5 h-5 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {foto.data_hora}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && fotosDoTipo[lightbox] && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {fotosDoTipo.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3">
            <img
              src={fotosDoTipo[lightbox].url}
              alt={fotosDoTipo[lightbox].descricao}
              className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-white/80 text-sm text-center space-y-1">
              <p className="font-semibold">{fotosDoTipo[lightbox].descricao}</p>
              <p className="text-xs text-white/60">{fotosDoTipo[lightbox].usuario} · {fotosDoTipo[lightbox].data_hora}</p>
              <div className="flex items-center gap-3 justify-center mt-2">
                <a
                  href={fotosDoTipo[lightbox].url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
                <span className="text-white/40 text-xs">{lightbox + 1} / {fotosDoTipo.length}</span>
              </div>
            </div>
          </div>

          {fotosDoTipo.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}