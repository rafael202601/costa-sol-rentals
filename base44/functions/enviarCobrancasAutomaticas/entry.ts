/**
 * Função de envio automático de cobranças para clientes com saldo em aberto.
 * Executa via automação agendada de acordo com horário configurado.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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

    // Buscar configurações
    const settingsList = await db.entities.CompanySettings.list();
    const settings = settingsList[0];

    if (!settings) {
      return Response.json({ erro: "Configurações não encontradas" }, { status: 400 });
    }

    // Verificar se cobrança automática está ativa
    if (!settings.cobranca_automatica_ativa) {
      return Response.json({ mensagem: "Cobrança automática desativada nas configurações." });
    }

    const intervalo = settings.cobranca_intervalo_dias || 1;
    const valorMinimo = settings.cobranca_valor_minimo || 0;
    const template = settings.mensagem_whatsapp_cobranca || 
      "Olá, {{nome_cliente}}! Seu contrato nº {{numero_contrato}} possui um valor em aberto de R$ {{valor_em_aberto}}. Por favor, regularize o pagamento. Obrigado!";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split("T")[0];

    // Buscar contratos ativos com saldo em aberto
    const statusAtivos = ["em_transito", "na_obra", "aguardando_recolha", "devolvido_parcial", "devolvido_pendente"];
    let contratos = [];
    for (const status of statusAtivos) {
      const lote = await db.entities.Contract.filter({ status });
      contratos = contratos.concat(lote);
    }

    let enviados = 0;
    const detalhes = [];

    for (const contrato of contratos) {
      try {
        // Pular se cobrança pausada neste contrato
        if (contrato.cobranca_pausada) continue;

        const saldo = contrato.saldo_pagar || 0;
        if (saldo < valorMinimo || saldo <= 0) continue;

        // Verificar intervalo de envio
        if (contrato.ultima_cobranca_enviada) {
          const ultimaData = new Date(contrato.ultima_cobranca_enviada + "T00:00:00");
          ultimaData.setHours(0, 0, 0, 0);
          const diffDias = Math.floor((hoje - ultimaData) / (1000 * 60 * 60 * 24));
          if (diffDias < intervalo) continue;
        }

        // Buscar dados do cliente para telefone/email
        const clienteList = await db.entities.Client.filter({ id: contrato.client_id });
        const cliente = clienteList[0];

        const valorFormatado = saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const diasEmAberto = contrato.dinamico_dias_em_aberto || 0;

        // Montar mensagem personalizada
        const mensagem = template
          .replace(/\{\{nome_cliente\}\}/g, contrato.client_nome || "Cliente")
          .replace(/\{\{numero_contrato\}\}/g, contrato.numero || "—")
          .replace(/\{\{valor_em_aberto\}\}/g, `R$ ${valorFormatado}`)
          .replace(/\{\{data_atual\}\}/g, hojeStr.split("-").reverse().join("/"))
          .replace(/\{\{dias_em_aberto\}\}/g, String(diasEmAberto))
          .replace(/\{\{nome_empresa\}\}/g, settings.nome_fantasia || settings.nome_social || "");

        // Registrar no log de atividades
        await db.entities.ActivityLog.create({
          usuario: "Sistema",
          acao: `Cobrança automática enviada — Saldo: R$ ${valorFormatado}`,
          modulo: "contrato",
          referencia_id: contrato.id,
          referencia_numero: contrato.numero,
          detalhes: `Canal: WhatsApp | Tel: ${cliente?.telefone1 || "—"} | Mensagem: ${mensagem.substring(0, 200)}`,
          data_hora: new Date().toISOString(),
        });

        // Atualizar data de último envio
        await db.entities.Contract.update(contrato.id, {
          ultima_cobranca_enviada: hojeStr,
        });

        // Enviar e-mail se configurado
        if ((settings.cobranca_canal === "email" || settings.cobranca_canal === "ambos") && cliente?.email) {
          await db.integrations.Core.SendEmail({
            to: cliente.email,
            subject: `Cobrança - Contrato Nº ${contrato.numero}`,
            body: mensagem.replace(/\n/g, "<br>"),
          });
        }

        enviados++;
        detalhes.push({
          contrato: contrato.numero,
          cliente: contrato.client_nome,
          saldo: valorFormatado,
          telefone: cliente?.telefone1 || "—",
          mensagem,
        });
      } catch (e) {
        detalhes.push({ contrato: contrato.numero, erro: e.message });
      }
    }

    return Response.json({
      sucesso: true,
      data: hojeStr,
      total_verificados: contratos.length,
      enviados,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});