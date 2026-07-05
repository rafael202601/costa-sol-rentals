import { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, PenLine, CheckCircle2, AlertTriangle, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ContractSignatureDialog({ open, onOpenChange, contract, currentUser, onSigned }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPos = useRef(null);
  const animFrame = useRef(null);
  const pendingDraw = useRef(null);
  // Guarda as linhas desenhadas para re-renderizar sem acumular scale
  const strokes = useRef([]);
  const currentStroke = useRef([]);

  // Bloqueia scroll do body quando aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      strokes.current = [];
      currentStroke.current = [];
      setHasSignature(false);
      setDrawing(false);
      // Aguarda o DOM montar e então ajusta o canvas
      setTimeout(() => resizeAndRedraw(), 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Re-ajusta quando a tela rotaciona ou redimensiona
  useEffect(() => {
    if (!open) return;
    const handler = () => setTimeout(() => resizeAndRedraw(), 150);
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, [open]);

  const resizeAndRedraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    // Seta dimensões físicas (sem acumular scale — cria contexto fresco)
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    redraw(rect.width, rect.height, dpr);
  };

  const redraw = (cssW, cssH, dpr) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Fundo branco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Linha guia (coordenadas CSS × dpr)
    ctx.save();
    ctx.scale(dpr, dpr);
    const lineY = cssH * 0.62;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(32, lineY);
    ctx.lineTo(cssW - 32, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← Assine acima desta linha →", cssW / 2, lineY + 22);
    // Re-desenha traços salvos
    strokes.current.forEach(stroke => {
      if (stroke.length < 2) return;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
    ctx.restore();
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    return { x, y };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const pos = getPos(e);
    currentStroke.current = [pos];
    lastPos.current = pos;
    setDrawing(true);
    setHasSignature(true);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lastPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e);
    const pressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 1;
    currentStroke.current.push(pos);
    pendingDraw.current = { from: lastPos.current, to: pos, pressure };
    lastPos.current = pos;
    if (animFrame.current) return;
    animFrame.current = requestAnimationFrame(() => {
      animFrame.current = null;
      if (!pendingDraw.current) return;
      const { from, to, pressure: p } = pendingDraw.current;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = Math.max(2, 2 + p * 2.5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    });
  }, []);

  const stopDraw = useCallback((e) => {
    if (animFrame.current) { cancelAnimationFrame(animFrame.current); animFrame.current = null; }
    if (e?.pointerId !== undefined && canvasRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (currentStroke.current.length > 0) {
      strokes.current = [...strokes.current, [...currentStroke.current]];
      currentStroke.current = [];
    }
    lastPos.current = null;
    setDrawing(false);
  }, []);

  const handleClear = () => {
    strokes.current = [];
    currentStroke.current = [];
    setHasSignature(false);
    resizeAndRedraw();
  };

  const handleConfirm = async () => {
    if (!hasSignature || saving) return;
    if (animFrame.current) { cancelAnimationFrame(animFrame.current); animFrame.current = null; }
    setSaving(true);
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const agora = new Date().toISOString();
      await base44.entities.Contract.update(contract.id, {
        assinatura_cliente: dataUrl,
        assinatura_data: agora,
        assinatura_entrega_url: dataUrl,
        assinatura_entrega_data: agora,
        assinatura_entrega_motorista: currentUser?.full_name || currentUser?.email || "Cliente (Portal)",
      });
      toast.success("✅ Assinatura salva com sucesso!");
      onOpenChange(false);
      if (onSigned) onSigned(contract.id, dataUrl, agora);
    } catch (err) {
      console.error("Erro ao salvar assinatura:", err);
      toast.error("Erro ao salvar assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const jaAssinado = !!contract?.assinatura_cliente || !!contract?.assinatura_entrega_url;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <PenLine className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              Assinar Contrato #{contract?.numero}
            </p>
            <p className="text-xs text-slate-400 leading-tight truncate">
              {contract?.client_nome}
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors shrink-0 ml-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {jaAssinado ? (
        /* Já assinado */
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 overflow-auto">
          <div className="flex items-center gap-3 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 w-full max-w-md">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-800">Contrato já assinado</p>
              <p className="text-sm text-emerald-700">
                {contract.assinatura_data
                  ? format(new Date(contract.assinatura_data), "dd/MM/yyyy 'às' HH:mm")
                  : "—"}
              </p>
            </div>
          </div>
          {(contract.assinatura_cliente || contract.assinatura_entrega_url) && (
            <div className="border rounded-2xl p-4 bg-white shadow w-full max-w-md">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Assinatura registrada</p>
              <img
                src={contract.assinatura_cliente || contract.assinatura_entrega_url}
                alt="Assinatura"
                className="max-h-32 object-contain"
              />
            </div>
          )}
          <Button onClick={() => onOpenChange(false)} className="w-full max-w-md h-12 text-base">
            Fechar
          </Button>
        </div>
      ) : (
        /* Área de assinatura — ocupa toda a tela restante */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Info compacta */}
          <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 text-xs text-slate-600 min-w-0">
              <span className="truncate">Contrato <strong>#{contract?.numero}</strong></span>
              {contract?.valor_total > 0 && (
                <span className="font-bold text-primary shrink-0">
                  R$ {(contract.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 shrink-0">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Confirma recebimento</span>
            </div>
          </div>

          {/* Instrução */}
          <div className="text-center py-2.5 shrink-0">
            <p className="text-sm font-semibold text-slate-700">✍ Assine no espaço abaixo</p>
            <p className="text-xs text-slate-400">Use o dedo ou caneta para assinar</p>
          </div>

          {/* Canvas — ocupa todo o espaço flexível disponível */}
          <div className="flex-1 mx-3 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden bg-white relative min-h-0"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block"
              style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", cursor: "crosshair" }}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={stopDraw}
              onPointerLeave={stopDraw}
              onPointerCancel={stopDraw}
            />
            {/* Hint quando vazio */}
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center opacity-25">
                  <PenLine className="w-14 h-14 mx-auto mb-2 text-slate-400" />
                  <p className="text-slate-400 text-sm font-medium">Toque aqui para assinar</p>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-center py-1.5 shrink-0 min-h-[22px]">
            {hasSignature ? (
              <p className="text-xs text-emerald-600 font-semibold">
                ✓ Assinatura capturada — clique em Confirmar
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Compatível com toque, mouse e caneta digital
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 px-3 pb-4 shrink-0">
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1 h-12 gap-2 text-sm font-medium"
              disabled={saving}
            >
              <RotateCcw className="w-4 h-4" />
              Limpar
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 px-4 text-sm"
              disabled={saving}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!hasSignature || saving}
              className="flex-[2] h-12 gap-2 text-base font-bold"
            >
              <Check className="w-5 h-5" />
              {saving ? "Salvando..." : "Confirmar Assinatura"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}