/**
 * releaseEquipmentSerials — libera seriais/numerações e atualiza estoque
 *
 * Chamado em TODOS os cenários de devolução/recolha/finalização/cancelamento.
 *
 * @param {Array} itensParaLiberar — [{ equipamento_id, quantidade, seriais_devolvidos? }]
 * @param {Object} opts — { contratoId?, contratoNumero?, osId?, usuarioNome?, evento? }
 */
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export async function releaseEquipmentSerials(itensParaLiberar = [], opts = {}) {
  const agora = format(new Date(), "dd/MM/yyyy HH:mm");
  const evento = opts.evento || "Devolução";
  const usuario = opts.usuarioNome || "—";
  const contratoNumero = opts.contratoNumero || "";
  const contratoId = opts.contratoId || "";
  const osId = opts.osId || "";

  for (const item of itensParaLiberar) {
    if (!item.equipamento_id) continue;

    let eq = null;
    try {
      const res = await base44.entities.Equipment.filter({ id: item.equipamento_id });
      eq = res?.[0] || null;
    } catch { continue; }
    if (!eq) continue;

    const qty = item.quantidade || 0;
    const novaDisp = (eq.quantidade_disponivel || 0) + qty;
    const novoAlug = Math.max(0, (eq.quantidade_alugada || 0) - qty);

    const updates = {
      quantidade_disponivel: novaDisp,
      quantidade_alugada: novoAlug,
      status_item: novoAlug === 0 ? "disponivel" : "alugado",
    };

    // Libera seriais individuais
    if (eq.controle_individual && eq.numeracoes?.length) {
      const serialsExplicitos = item.seriais_devolvidos || [];

      updates.numeracoes = eq.numeracoes.map((n) => {
        if (n.status !== "alugado") return n; // só mexe em seriais alugados

        // 1. Lista explícita de seriais passada — libera diretamente pelo nome do serial
        const liberarPorLista = serialsExplicitos.length > 0 && serialsExplicitos.includes(n.serial);

        // 2. Vínculo por contrato_id
        const liberarPorContratoId =
          contratoId &&
          n.contrato_id &&
          (n.contrato_id === contratoId || n.contrato_id === "pending");

        // 3. Vínculo por número do contrato (fallback para IDs divergentes)
        const liberarPorContratoNumero =
          contratoNumero &&
          n.contrato_numero &&
          n.contrato_numero === contratoNumero;

        // 4. Vínculo por OS
        const liberarPorOsId =
          osId && n.os_id && n.os_id === osId;

        // Quando lista vazia → devolução total: libera todos vinculados ao contrato/OS
        // Quando lista preenchida → libera os da lista OU os vinculados ao mesmo contrato
        const vinculadoAoContrato = liberarPorContratoId || liberarPorContratoNumero || liberarPorOsId;

        // Se lista vazia E não tem contrato vinculado no serial (dados inconsistentes/legado),
        // libera qualquer alugado deste equipamento se informamos contratoId ou contratoNumero
        // (assumindo que são todos deste contrato, já que a lista vazia = devolução total)
        const liberarPorFallbackTotal =
          serialsExplicitos.length === 0 &&
          (contratoId || contratoNumero || osId) &&
          !n.contrato_id &&
          !n.contrato_numero &&
          !n.os_id;

        // Libera se: serial está na lista explícita OU vinculado ao contrato/OS OU fallback total
        const deveLiberar =
          liberarPorLista ||
          (serialsExplicitos.length === 0 && vinculadoAoContrato) ||
          liberarPorFallbackTotal;

        if (deveLiberar) {
          return {
            ...n,
            status: "disponivel",
            contrato_id: "",
            contrato_numero: "",
            os_id: "",
            historico: [
              ...(n.historico || []),
              {
                data: agora,
                evento: evento || "Retorno da locação",
                contrato_numero: contratoNumero || n.contrato_numero || "",
                usuario,
              },
            ],
          };
        }
        return n;
      });
    }

    await base44.entities.Equipment.update(item.equipamento_id, updates);
  }
}