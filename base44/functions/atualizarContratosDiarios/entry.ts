/**
 * Função de atualização diária dos contratos ativos.
 * Calcula dias_em_aberto e valor_em_aberto RESPEITANDO COBRANÇA MÍNIMA por item (Grupo A).
 *
 * REGRA COBRANÇA MÍNIMA:
 *   Grupo A (aplica_valor_minimo === true):
 *     - dias_efetivos = Math.max(dias_em_aberto, dias_minimos_proprio)
 *     - se valor_total_grupoA < valor_minimo_contrato → usa valor_minimo_contrato
 *   Grupo B (aplica_valor_minimo !== true):
 *     - cobra apenas dias reais de uso (sem mínimo)
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada agendada (sem user) ou por admin
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== "admin") {
        return Response.json({ error: "Acesso negado" }, { status: 403 });
      }
    } catch {
      isScheduled = true;
    }

    const db = isScheduled ? base44.asServiceRole : base44;

    // Buscar configurações globais (valor_minimo_contrato)
    let settings = null;
    try {
      const settingsList = await db.entities.CompanySettings.list();
      settings = settingsList[0] || null;
    } catch (_) {}
    const valorMinimoContrato = settings?.valor_minimo_contrato || 0;
    const diasMinimoGlobal = settings?.minimo_dias || 5;

    // devolvido_pendente NÃO entra aqui — cobrança já foi congelada na devolução
    const statusAtivos = ["em_transito", "na_obra", "aguardando_recolha", "devolvido_parcial"];

    let contratos = [];
    for (const status of statusAtivos) {
      const lote = await db.entities.Contract.filter({ status });
      contratos = contratos.concat(lote);
    }

    // Filtra contratos com cobrança pausada
    contratos = contratos.filter(c => !c.cobranca_pausada);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split("T")[0];

    let atualizados = 0;
    const erros = [];

    for (const contrato of contratos) {
      try {
        const dataBaseStr = contrato.dinamico_data_base || contrato.data_inicio;
        if (!dataBaseStr) continue;

        const dataBase = new Date(dataBaseStr + "T00:00:00");
        dataBase.setHours(0, 0, 0, 0);

        const diasEmAberto = Math.max(0, Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24)));

        const itens = contrato.itens || [];

        // ── GRUPO A: aplica_valor_minimo === true (cobrança mínima) ─────────
        const grupoA = itens.filter(i => i.aplica_valor_minimo === true);
        const grupoB = itens.filter(i => i.aplica_valor_minimo !== true);

        // Calcula valor do Grupo A respeitando dias mínimos por item
        let somaGrupoA = 0;
        for (const item of grupoA) {
          const qtd = item.quantidade_retirada || 0;
          const devolvida = item.quantidade_devolvida || 0;
          const qtdAtiva = Math.max(0, qtd - devolvida);
          if (qtdAtiva <= 0) continue;

          const valorDiario = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
          const desconto = item.desconto || 0;

          // Dias mínimos: usa o do próprio equipamento, senão o global
          const diasMinItem = item.dias_minimos_proprio > 0
            ? item.dias_minimos_proprio
            : diasMinimoGlobal;

          // REGRA CRÍTICA: se usou menos dias que o mínimo → cobra o mínimo
          const diasEfetivos = Math.max(diasEmAberto, diasMinItem);

          if (item.tipo_cobranca === "mensal") {
            const valorDiarioEquiv = valorDiario / 30;
            somaGrupoA += Math.max(0, valorDiarioEquiv * diasEfetivos * qtdAtiva - desconto);
          } else {
            somaGrupoA += Math.max(0, valorDiario * diasEfetivos * qtdAtiva - desconto);
          }
        }

        // Aplica mínimo global sobre o Grupo A
        if (grupoA.length > 0 && valorMinimoContrato > 0 && somaGrupoA < valorMinimoContrato) {
          somaGrupoA = valorMinimoContrato;
        }

        // ── GRUPO B: sem mínimo — cobra dias reais ───────────────────────────
        let somaGrupoB = 0;
        for (const item of grupoB) {
          const qtd = item.quantidade_retirada || 0;
          const devolvida = item.quantidade_devolvida || 0;
          const qtdAtiva = Math.max(0, qtd - devolvida);
          if (qtdAtiva <= 0) continue;

          const valorDiario = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
          const desconto = item.desconto || 0;

          if (item.tipo_cobranca === "mensal") {
            const valorDiarioEquiv = valorDiario / 30;
            somaGrupoB += Math.max(0, valorDiarioEquiv * diasEmAberto * qtdAtiva - desconto);
          } else {
            somaGrupoB += Math.max(0, valorDiario * diasEmAberto * qtdAtiva - desconto);
          }
        }

        // ── Total em aberto = GrupoA + GrupoB + Frete ────────────────────────
        const valorEmAberto = Math.max(0, somaGrupoA + somaGrupoB) + (contrato.frete || 0);

        // Saldo = valor_em_aberto - pagamentos já feitos fora do ciclo atual
        const pagosForaCiclo = contrato.dinamico_valor_pago_acumulado || 0;
        const saldoAtual = Math.max(0, valorEmAberto - Math.max(0, (contrato.valor_pago || 0) - pagosForaCiclo));

        await db.entities.Contract.update(contrato.id, {
          dinamico_dias_em_aberto: diasEmAberto,
          dinamico_valor_em_aberto: parseFloat(valorEmAberto.toFixed(2)),
          saldo_pagar: parseFloat(saldoAtual.toFixed(2)),
          dinamico_ultima_atualizacao: new Date().toISOString(),
        });

        atualizados++;
      } catch (e) {
        erros.push({ id: contrato.id, erro: e.message });
      }
    }

    return Response.json({
      sucesso: true,
      data: hojeStr,
      total_contratos: contratos.length,
      atualizados,
      erros,
      configuracao: {
        valorMinimoContrato,
        diasMinimoGlobal,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});