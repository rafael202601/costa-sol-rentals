import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Gera e toca um som de notificação usando Web Audio API.
 * Funciona sem arquivo externo, diretamente no browser/mobile.
 */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784]; // Dó, Mi, Sol — acorde positivo
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch (_) {}
}

function matchDriver(field, driverName, driverEmail) {
  if (!field) return false;
  const f = field.trim().toLowerCase();
  if (driverName && f === driverName.trim().toLowerCase()) return true;
  if (driverEmail && f === driverEmail.trim().toLowerCase()) return true;
  return false;
}

/**
 * Hook que escuta eventos em tempo real de Contract e ServiceOrder.
 * Quando um registro novo/atualizado é vinculado ao motorista logado,
 * toca som e exibe notificação visual.
 *
 * @param {object} params
 * @param {string} params.driverName   — nome do motorista
 * @param {string} params.driverEmail  — email do motorista
 * @param {boolean} params.soundEnabled — controle on/off do som
 * @param {function} params.onUpdate   — callback chamado quando há novidade (para refresh da lista)
 */
export function useDriverNotifications({ driverName, driverEmail, soundEnabled = true, onUpdate }) {
  const knownIds = useRef(new Set());
  const mounted = useRef(true);

  const handleEvent = useCallback((event, tipo) => {
    if (!mounted.current) return;
    if (event.type !== "create" && event.type !== "update") return;

    const data = event.data;
    if (!data) return;

    const isVinculado =
      matchDriver(data.motorista_entrega, driverName, driverEmail) ||
      matchDriver(data.motorista_recolha, driverName, driverEmail) ||
      matchDriver(data.motorista_recolhimento, driverName, driverEmail);

    if (!isVinculado) return;

    const docId = event.id;

    // Evita disparar múltiplos alertas para o mesmo evento num curto intervalo
    const chave = `${docId}-${event.type}-${Date.now()}`;
    if (knownIds.current.has(docId) && event.type === "update") {
      // Só notifica update se mudou motorista (nova atribuição)
      const wasKnown = knownIds.current.has(docId);
      if (wasKnown) {
        // Para updates, notifica apenas se status mudou para algo relevante
        const statusRelevante = ["em_transito", "aguardando_recolha", "rascunho", "pendente"].includes(data.status);
        if (!statusRelevante) return;
      }
    }

    knownIds.current.add(docId);

    const numero = data.numero || docId.slice(0, 6);
    const clienteNome = data.client_nome || "—";
    const tipoLabel = tipo === "contrato" ? "Contrato" : "OS";
    const statusLabel = {
      rascunho: "Novo contrato — aguardando saída",
      em_transito: "Em rota",
      na_obra: "Entregue",
      pendente: "Nova OS — aguardando saída",
      aguardando_recolha: "Recolha solicitada",
    }[data.status] || data.status;

    if (soundEnabled) playNotificationSound();

    toast(`🚚 ${tipoLabel} #${numero} — ${statusLabel}`, {
      description: `Cliente: ${clienteNome}`,
      duration: 8000,
      action: {
        label: "Ver",
        onClick: () => {
          const path = tipo === "contrato"
            ? `/contratos/${docId}`
            : `/ordens-servico/${docId}`;
          window.location.href = path;
        },
      },
    });

    onUpdate?.();
  }, [driverName, driverEmail, soundEnabled, onUpdate]);

  useEffect(() => {
    if (!driverName && !driverEmail) return;
    mounted.current = true;

    const unsubContract = base44.entities.Contract.subscribe((event) =>
      handleEvent(event, "contrato")
    );
    const unsubOS = base44.entities.ServiceOrder.subscribe((event) =>
      handleEvent(event, "os")
    );

    console.log("[DriverNotifications] 🔔 Escutando atualizações para:", driverName, driverEmail);

    return () => {
      mounted.current = false;
      unsubContract?.();
      unsubOS?.();
    };
  }, [driverName, driverEmail, handleEvent]);
}