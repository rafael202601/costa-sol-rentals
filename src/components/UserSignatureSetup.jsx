import { useRef, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eraser, Upload, Check, PenLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Reduz o tamanho do base64 da assinatura para evitar problemas de armazenamento.
 * Redimensiona para no máximo 600x168px e comprime como JPEG com qualidade 0.85.
 */
function compressSignature(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 600;
      const MAX_H = 168;
      let { width, height } = img;
      if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W; }
      if (height > MAX_H) { width = Math.round(width * MAX_H / height); height = MAX_H; }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl); // fallback sem compressão
    img.src = dataUrl;
  });
}

export default function UserSignatureSetup() {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("draw"); // "draw" | "upload"
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [currentSignature, setCurrentSignature] = useState(null);
  const [saving, setSaving] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u?.assinatura_usuario) setCurrentSignature(u.assinatura_usuario);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === "draw") setTimeout(() => initCanvas(), 50);
  }, [mode]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    setHasSignature(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setDrawing(false);
  const clearCanvas = () => initCanvas();

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Valida tipo
    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido. Envie uma imagem PNG, JPG ou similar.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCurrentSignature(ev.target.result);
      setHasSignature(true);
    };
    reader.onerror = () => toast.error("Falha ao ler o arquivo. Tente novamente.");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    let dataUrl = null;

    if (mode === "draw") {
      if (!hasSignature) {
        toast.error("Desenhe sua assinatura antes de salvar.");
        return;
      }
      dataUrl = canvasRef.current.toDataURL("image/png");
    } else {
      if (!currentSignature) {
        toast.error("Faça upload de uma imagem de assinatura.");
        return;
      }
      dataUrl = currentSignature;
    }

    setSaving(true);
    try {
      // Comprime antes de salvar para evitar payload muito grande
      const compressed = await compressSignature(dataUrl);
      await base44.auth.updateMe({ assinatura_usuario: compressed });
      setCurrentSignature(compressed);
      toast.success("Assinatura salva com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar assinatura:", err);
      const msg = err?.message || "";
      if (msg.includes("permission") || msg.includes("403")) {
        toast.error("Permissão negada. Verifique se você está autenticado.");
      } else if (msg.includes("upload") || msg.includes("storage")) {
        toast.error("Falha no upload da assinatura. Tente novamente.");
      } else {
        toast.error("Erro ao salvar assinatura. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ assinatura_usuario: "" });
      setCurrentSignature(null);
      initCanvas();
      toast.success("Assinatura removida.");
    } catch (err) {
      console.error("Erro ao remover assinatura:", err);
      toast.error("Erro ao remover assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <PenLine className="w-4 h-4" /> Minha Assinatura
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Esta assinatura será inserida automaticamente nos contratos, OSs, devoluções e recibos que você criar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assinatura atual */}
        {currentSignature && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assinatura atual</p>
            <div className="border rounded-xl bg-white p-3 inline-block">
              <img src={currentSignature} alt="Assinatura atual" className="h-16 max-w-[280px] object-contain" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={saving}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Eraser className="w-3.5 h-3.5" /> Remover assinatura
            </Button>
          </div>
        )}

        {!currentSignature && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Você ainda não tem assinatura cadastrada. Os contratos serão criados sem ela.
          </div>
        )}

        {/* Modo de cadastro */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              mode === "draw"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" /> Desenhar
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              mode === "upload"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>

        {mode === "draw" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Assine com o mouse, dedo, caneta ou mesa digitalizadora:
            </p>
            <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white touch-none select-none">
              <canvas
                ref={canvasRef}
                width={500}
                height={140}
                className="w-full cursor-crosshair"
                style={{ display: "block", touchAction: "none" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
              />
            </div>
            <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5">
              <Eraser className="w-3.5 h-3.5" /> Limpar
            </Button>
          </div>
        )}

        {mode === "upload" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Envie uma imagem PNG/JPG da sua assinatura:</p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-border text-sm font-medium hover:bg-muted transition-colors">
              <Upload className="w-4 h-4" />
              Selecionar imagem
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            {currentSignature && mode === "upload" && (
              <div className="border rounded-xl bg-white p-3 inline-block ml-2">
                <img src={currentSignature} alt="Preview" className="h-14 max-w-[220px] object-contain" />
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Check className="w-4 h-4" />
          {saving ? "Salvando..." : currentSignature ? "Atualizar Assinatura" : "Salvar Assinatura"}
        </Button>
      </CardContent>
    </Card>
  );
}