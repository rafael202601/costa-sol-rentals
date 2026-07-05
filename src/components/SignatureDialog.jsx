import { useRef, useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Minimize2, Maximize2 } from "lucide-react";

/**
 * Dialog para captura de assinatura digital via canvas.
 * Suporta: mouse, touch, pen/stylus, mesa digitalizadora USB (via PointerEvents API).
 * Abre automaticamente em fullscreen para facilitar assinatura.
 */
export default function SignatureDialog({ open, onOpenChange, onConfirm, title = "Assinatura do Locatário" }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [fullscreen, setFullscreen] = useState(true); // abre fullscreen por padrão
  const lastPos = useRef(null);
  const animFrame = useRef(null);
  const pendingDraw = useRef(null);

  // Inicializa canvas ao abrir
  useEffect(() => {
    if (open) {
      setFullscreen(true);
      setTimeout(() => initCanvas(), 80);
    } else {
      setHasSignature(false);
      setDrawing(false);
    }
  }, [open]);

  // Reinicia canvas ao trocar fullscreen
  useEffect(() => {
    if (open) setTimeout(() => initCanvas(), 80);
  }, [fullscreen]);

  const PADDING = 24; // padding interno para evitar corte nas bordas

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Preenche branco (inclui área de padding)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Linha guia horizontal — posicionada mais acima para dar espaço abaixo
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    const lineY = canvas.height * 0.65;
    ctx.beginPath();
    ctx.moveTo(PADDING, lineY);
    ctx.lineTo(canvas.width - PADDING, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Texto "Assine acima desta linha"
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${fullscreen ? 14 : 11}px Inter, sans-serif`;
    ctx.fillText("Assine acima desta linha", PADDING + 4, lineY + (fullscreen ? 22 : 16));
    setHasSignature(false);
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Clamp para garantir que coordenadas ficam dentro do canvas (evita corte)
    const x = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));
    return { x, y };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    setDrawing(true);
    setHasSignature(true);
    lastPos.current = getPos(e);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getPos(e);

    // Usa requestAnimationFrame para suavidade máxima
    pendingDraw.current = { pos, pressure: e.pressure !== undefined && e.pressure > 0 ? e.pressure : 1 };
    if (animFrame.current) return;
    animFrame.current = requestAnimationFrame(() => {
      animFrame.current = null;
      if (!pendingDraw.current || !lastPos.current) return;
      const { pos: p, pressure } = pendingDraw.current;
      const ctx = canvas.getContext("2d");
      const lineWidth = Math.max(1.5, 1.5 + pressure * 2.5);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "transparent";
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPos.current = p;
    });
  }, [drawing]);

  const stopDraw = useCallback((e) => {
    if (animFrame.current) { cancelAnimationFrame(animFrame.current); animFrame.current = null; }
    if (e?.pointerId !== undefined && canvasRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    setDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = () => {
    if (animFrame.current) { cancelAnimationFrame(animFrame.current); animFrame.current = null; }
    initCanvas();
  };

  const handleConfirm = () => {
    if (!hasSignature) return;
    if (animFrame.current) { cancelAnimationFrame(animFrame.current); animFrame.current = null; }
    // Captura o canvas inteiro — sem crop, preserva tudo incluindo bordas
    const dataUrl = canvasRef.current.toDataURL("image/png", 1.0);
    onConfirm(dataUrl);
    onOpenChange(false);
  };

  // Dimensões do canvas: maiores para garantir área de assinatura sem corte
  // Altura aumentada para dar espaço suficiente em todas as direções
  const canvasW = fullscreen ? 1400 : 800;
  const canvasH = fullscreen ? 480 : 260;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); }}>
      <DialogContent
        className={
          fullscreen
            ? "max-w-[96vw] w-full"
            : "max-w-lg"
        }
        style={fullscreen ? { width: "96vw" } : {}}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="font-heading text-base">{title}</DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                🖊 Mouse · Dedo · Caneta · Mesa digitalizadora
              </span>
              <button
                onClick={() => setFullscreen(v => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                title={fullscreen ? "Modo compacto" : "Tela cheia"}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Área de assinatura */}
          <div
            className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white touch-none select-none"
            style={{ cursor: "crosshair" }}
          >
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              className="w-full block"
              style={{ touchAction: "none", display: "block" }}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={stopDraw}
              onPointerLeave={stopDraw}
              onPointerCancel={stopDraw}
            />
          </div>

          {/* Status */}
          {hasSignature ? (
            <p className="text-xs text-emerald-600 text-center font-medium">
              ✓ Assinatura capturada — clique em <strong>Confirmar</strong> para salvar
            </p>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              ✏ Use o campo acima para assinar · Compatível com mesa digitalizadora e touchscreen
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={clearCanvas} className="gap-2">
            <Eraser className="w-4 h-4" /> Limpar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!hasSignature} className="gap-2 bg-primary">
            <Check className="w-4 h-4" /> Confirmar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}