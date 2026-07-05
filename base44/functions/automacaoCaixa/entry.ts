import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Valida que é chamada interna de automação (sem usuário logado)
    const configs = await base44.asServiceRole.entities.CashAutoConfig.list();
    if (!configs || configs.length === 0) {
      return Response.json({ ok: true, msg: "Nenhuma configuração de automação encontrada." });
    }

    const config = configs[0];
    const agora = new Date();
    const hojeStr = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const horarioAtual = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const agora_sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

    const registros = await base44.asServiceRole.entities.CashRegister.list("-data_abertura", 5);
    const caixaAberto = registros.find(r => r.status === "aberto");
    const ultimoFechado = registros.find(r => r.status === "fechado");

    const historico = config.historico || [];
    const novasEntradas = [];

    // ── FECHAMENTO AUTOMÁTICO ──────────────────────────────────────────
    if (config.fechamento_ativo && caixaAberto) {
      let deveFechari = false;

      if (config.fechamento_tipo === "horario") {
        // Verifica se passou do horário hoje e ainda não fechou hoje
        const [h, m] = (config.fechamento_horario || "18:00").split(":").map(Number);
        const horarioFechamento = new Date(agora_sp);
        horarioFechamento.setHours(h, m, 0, 0);

        // Verifica se já fechou hoje automaticamente
        const jaFechouHoje = historico.some(h =>
          h.tipo === "fechamento" && h.status === "sucesso" && h.data_hora?.includes(hojeStr)
        );

        if (agora_sp >= horarioFechamento && !jaFechouHoje) {
          deveFechari = true;
        }
      } else if (config.fechamento_tipo === "horas_apos_abertura") {
        const dataAbertura = new Date(caixaAberto.data_abertura);
        const horasAberto = (agora_sp - dataAbertura) / 3600000;
        if (horasAberto >= (config.fechamento_horas || 12)) {
          deveFechari = true;
        }
      }

      if (deveFechari) {
        // Calcula saldo final
        const entries = await base44.asServiceRole.entities.CashEntry.filter({ caixa_id: caixaAberto.id });
        const confirmadas = entries.filter(e => e.status === "confirmado");
        const entradas = confirmadas.filter(e => e.tipo === "receita").reduce((s, e) => s + (e.valor || 0), 0);
        const saidas = confirmadas.filter(e => e.tipo === "despesa").reduce((s, e) => s + (e.valor || 0), 0);
        const sangrias = confirmadas.filter(e => e.tipo === "sangria").reduce((s, e) => s + (e.valor || 0), 0);
        const suprimentos = confirmadas.filter(e => e.tipo === "suprimento").reduce((s, e) => s + (e.valor || 0), 0);
        const saldoFinal = (caixaAberto.valor_inicial || 0) + entradas - saidas - sangrias + suprimentos;

        await base44.asServiceRole.entities.CashRegister.update(caixaAberto.id, {
          data_fechamento: agora.toISOString(),
          total_entradas: entradas,
          total_saidas: saidas,
          saldo_final: saldoFinal,
          status: "fechado",
          observacoes: (caixaAberto.observacoes || "") + `\n[Fechamento automático em ${agora_sp.toLocaleString("pt-BR")}]`,
        });

        novasEntradas.push({
          tipo: "fechamento",
          data_hora: agora_sp.toLocaleString("pt-BR"),
          status: "sucesso",
          detalhe: `Fechado automaticamente às ${horarioAtual}. Saldo final: R$ ${saldoFinal.toFixed(2)}`,
          usuario: config.configurado_por_nome || config.configurado_por || "Sistema",
        });
      }
    }

    // ── ABERTURA AUTOMÁTICA ────────────────────────────────────────────
    // Recarrega para ver se caixa foi fechado agora mesmo
    const registrosApos = await base44.asServiceRole.entities.CashRegister.list("-data_abertura", 5);
    const caixaAbertoApos = registrosApos.find(r => r.status === "aberto");
    const ultimoFechadoApos = registrosApos.find(r => r.status === "fechado");

    if (config.abertura_ativa && !caixaAbertoApos) {
      let deveAbrir = false;

      if (config.abertura_tipo === "horario") {
        const [h, m] = (config.abertura_horario || "07:00").split(":").map(Number);
        const horarioAbertura = new Date(agora_sp);
        horarioAbertura.setHours(h, m, 0, 0);

        const jaAbriuHoje = historico.some(hr =>
          hr.tipo === "abertura" && hr.status === "sucesso" && hr.data_hora?.includes(hojeStr)
        );

        // Janela de 10 minutos após o horário configurado
        const diff = (agora_sp - horarioAbertura) / 60000;
        if (diff >= 0 && diff <= 10 && !jaAbriuHoje) {
          deveAbrir = true;
        }
      } else if (config.abertura_tipo === "horas_apos_fechamento" && ultimoFechadoApos?.data_fechamento) {
        const dataFechamento = new Date(ultimoFechadoApos.data_fechamento);
        const horasDesde = (agora_sp - dataFechamento) / 3600000;

        const jaAbriuAposEste = historico.some(hr => {
          if (hr.tipo !== "abertura" || hr.status !== "sucesso") return false;
          const hrDate = new Date(hr.data_hora);
          return hrDate > dataFechamento;
        });

        if (horasDesde >= (config.abertura_horas || 13) && !jaAbriuAposEste) {
          deveAbrir = true;
        }
      }

      if (deveAbrir) {
        await base44.asServiceRole.entities.CashRegister.create({
          data_abertura: agora.toISOString(),
          responsavel: config.abertura_responsavel || config.configurado_por_nome || "Sistema (automático)",
          valor_inicial: config.abertura_valor_inicial || 0,
          status: "aberto",
          observacoes: `Abertura automática em ${agora_sp.toLocaleString("pt-BR")}`,
        });

        novasEntradas.push({
          tipo: "abertura",
          data_hora: agora_sp.toLocaleString("pt-BR"),
          status: "sucesso",
          detalhe: `Aberto automaticamente às ${horarioAtual}. Valor inicial: R$ ${(config.abertura_valor_inicial || 0).toFixed(2)}`,
          usuario: config.configurado_por_nome || config.configurado_por || "Sistema",
        });
      }
    }

    // Atualiza histórico
    if (novasEntradas.length > 0) {
      const historicoAtualizado = [...historico, ...novasEntradas].slice(-100); // máx 100 entradas
      await base44.asServiceRole.entities.CashAutoConfig.update(config.id, {
        historico: historicoAtualizado,
      });
    }

    return Response.json({
      ok: true,
      executado_em: agora_sp.toLocaleString("pt-BR"),
      acoes: novasEntradas.map(e => `${e.tipo}: ${e.status}`),
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});