import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, ZoomIn, Download, ChevronLeft, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * PhotoGallery — componente reutilizável para anexar/visualizar fotos
 *
 * Props:
 *   photos: array de { url, data_hora, usuario, descricao }
 *   onAdd: (newPhotos) => void  — recebe o array atualizado
 *   onRemove: (index) => void
 *   canDelete: boolean
 *   currentUser: object
 *   readOnly: boolean
 */
export default function PhotoGallery({ photos = [], onAdd, onRemove, canDelete = true, currentUser, readOnly = false }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index do item aberto
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const now = format(new Date(), "dd/MM/yyyy HH:mm");
    const usuario = currentUser?.full_name || currentUser?.email || "—";

    const newEntries = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} muito grande (máx 20MB)`); continue; }
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newEntries.push({ url: file_url, data_hora: now, usuario, descricao: file.name });
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (newEntries.length > 0) {
      onAdd?.([...photos, ...newEntries]);
      toast.success(`${newEntries.length} foto(s) adicionada(s)!`);
    }
    setUploading(false);
  }, [photos, onAdd, currentUser]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const prev = () => setLightbox((i) => (i > 0 ? i - 1 : photos.length - 1));
  const next = () => setLightbox((i) => (i < photos.length - 1 ? i + 1 : 0));

  return (
    <div className="space-y-3">
      {/* Upload zone — hidden in readOnly */}
      {!readOnly && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="w-6 h-6 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground text-center">
            {uploading ? "Enviando fotos..." : "Clique ou arraste fotos aqui"}
          </p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, PDF — até 20MB cada</p>

          <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90">
              <Camera className="w-3.5 h-3.5" />
              Câmera / Galeria
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer hover:bg-muted">
              <Upload className="w-3.5 h-3.5" />
              Arquivo
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {/* Grid de miniaturas */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border bg-muted shadow-sm">
              {photo.url?.endsWith(".pdf") || photo.descricao?.endsWith(".pdf") ? (
                <div
                  className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/60 p-2"
                  onClick={() => window.open(photo.url, "_blank")}
                >
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-center truncate w-full">{photo.descricao || "PDF"}</span>
                </div>
              ) : (
                <img
                  src={photo.url}
                  alt={photo.descricao || `Foto ${i + 1}`}
                  className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                  onClick={() => setLightbox(i)}
                  loading="lazy"
                />
              )}

              {/* Overlay hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                {!(photo.url?.endsWith(".pdf")) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                    className="p-1.5 rounded-full bg-white/80 hover:bg-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-gray-700" />
                  </button>
                )}
                <a
                  href={photo.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-full bg-white/80 hover:bg-white"
                >
                  <Download className="w-3.5 h-3.5 text-gray-700" />
                </a>
                {canDelete && !readOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove?.(i); }}
                    className="p-1.5 rounded-full bg-red-100/90 hover:bg-red-200"
                  >
                    <X className="w-3.5 h-3.5 text-red-600" />
                  </button>
                )}
              </div>

              {/* Legenda data/usuario */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {photo.usuario} · {photo.data_hora}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma foto registrada.</p>
      )}

      {/* Lightbox */}
      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Fechar */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Imagem */}
          <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3">
            <img
              src={photos[lightbox].url}
              alt={photos[lightbox].descricao || `Foto ${lightbox + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-white/80 text-sm text-center">
              <p className="font-medium">{photos[lightbox].descricao || `Foto ${lightbox + 1}`}</p>
              <p className="text-xs text-white/60">
                {photos[lightbox].usuario} · {photos[lightbox].data_hora}
              </p>
              <div className="flex gap-3 mt-2 justify-center">
                <a
                  href={photos[lightbox].url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
                <p className="text-white/40 text-xs flex items-center">{lightbox + 1} / {photos.length}</p>
              </div>
            </div>
          </div>

          {/* Next */}
          {photos.length > 1 && (
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