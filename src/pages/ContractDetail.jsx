import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import WhatsAppButton from "../components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Pencil, Truck, HandMetal, RotateCcw, CheckCircle2,
  DollarSign, RefreshCcw, FileDown, Calendar, MapPin, Package, PackageCheck, PenLine,
  XCircle, MessageSquare, Lock, History, GitBranch, ShieldAlert, Upload, Paperclip, Clock, ScanBarcode, Images, ArrowLeftRight
} from "lucide-react";
import PhotoGallery from "../components/PhotoGallery";
import SerialSelector from "../components/equipment/SerialSelector";
import { OpenLocationButton } from "../components/LocationField";
import { differenceInDays, parseISO, format, addDays, addMonths } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { showError } from "../lib/errorHandler";
import { usePermissions } from "@/lib/usePermissions";
import SaleReciboButton from "../components/sales/SaleReciboButton";
import { generateReciboPDF } from "../lib/generateRecibo";
import { generateContractPDF } from "../lib/generateContractPDF";
import { generateContractQuitadoPDF } from "../lib/generateQuitadoPDF";
import WhatsAppSendDialog from "../components/WhatsAppSendDialog";
import { getNextNumber } from "../lib/sequentialNumber";
import SignatureDialog from "../components/SignatureDialog";
import DynamicBillingCard from "../components/contracts/DynamicBillingCard";
import BillingRestartInfo from "../components/BillingRestartInfo";
import { calcContractTotal, getDiasContrato, calcValorMinimoLocacao } from "../lib/contractCalc";
import ContractAuditTab from "../components/contracts/ContractAuditTab";
import ContractVersionsTab from "../components/contracts/ContractVersionsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateReciboDevolucaoPDF } from "../lib/generateReciboDevolucao";
import ReciboDevolucaoButton from "../components/devolucao/ReciboDevolucaoButton";
import HistoricoDevolucoes from "../components/devolucao/HistoricoDevolucoes";
import TrocaEquipamentoDialog from "../components/troca/TrocaEquipamentoDialog";
import HistoricoTrocas from "../components/troca/HistoricoTrocas";
import ContractAuditCard from "../components/contracts/ContractAuditCard";
import SyncContractSaldo from "../components/contracts/SyncContractSaldo";
import ContractInfoCards from "../components/contracts/ContractInfoCards";
import AlterarStatusDialog from "../components/operacional/AlterarStatusDialog";
import { releaseEquipmentSerials } from "../lib/releaseEquipmentSerials";
export default function ContractDetail() {
  const navigate = useNavigate();
  const { id: contractId } = useParams();
  const { can, user: permUser, isAdmin: permIsAdmin } = usePermissions();

  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [devDialog, setDevDialog] = useState(false);
  const [devObs, setDevObs] = useState("");
  const [devItens, setDevItens] = useState([]); // [{idx, quantidade}]
  const [payDialog, setPayDialog] = useState(false);
  const [payValor, setPayValor] = useState("");
  const [payForma, setPayForma] = useState("pix");
  const [payDesconto, setPayDesconto] = useState("");
  const [payDescontoTipo, setPayDescontoTipo] = useState("reais"); // "reais" | "percentual"
  const [payValorRecebido, setPayValorRecebido] = useState("");
  const [payComprovanteUrl, setPayComprovanteUrl] = useState("");
  const [payComprovanteLoading, setPayComprovanteLoading] = useState(false);
  const [recolhaMotorista, setRecolhaMotorista] = useState("");
  const [recolhaData, setRecolhaData] = useState("");
  const [recolhaDialog, setRecolhaDialog] = useState(false);
  const [recolhaTipo, setRecolhaTipo] = useState("total");
  const [recolhaItens, setRecolhaItens] = useState([]); // [{idx, quantidade}] para parcial
  const [drivers, setDrivers] = useState([]);
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnObs, setReturnObs] = useState("");
  const [signatureDialog, setSignatureDialog] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [settings, setSettings] = useState(null);
  const [pendingPaymentReqs, setPendingPaymentReqs] = useState([]);
  const [activeTab, setActiveTab] = useState("contrato");
  const [unlockDialog, setUnlockDialog] = useState(false);
  const [unlockMotivo, setUnlockMotivo] = useState("");
  const [whatsDialog, setWhatsDialog] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [lastDevolucao, setLastDevolucao] = useState(null);
  const [historicoDevolucoes, setHistoricoDevolucoes] = useState([]);
  const [trocaDialog, setTrocaDialog] = useState(false);
  const [cancelRecolhaDialog, setCancelRecolhaDialog] = useState(false);
  const [cancelRecolhaMotivo, setCancelRecolhaMotivo] = useState("");
  const [enrichedItens, setEnrichedItens] = useState(null);
  const [alterarStatusDialog, setAlterarStatusDialog] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    base44.entities.CompanySettings.list().then((l) => setSettings(l[0] || null));
    base44.entities.Driver.list().then((d) => setDrivers(d.filter(x => x.status === "ativo")));
  }, []);

  const load = async () => {
    let c = null;
    try {
      const res = await base44.entities.Contract.filter({ id: contractId });
      c = res?.[0] || null;
    } catch { /* ignore */ }

    if (!c) {
      try {
        const all = await base44.entities.Contract.list("-created_date", 2000);
        c = all.find(x => x.id === contractId) || null;
      } catch { /* ignore */ }
    }

    setContract(c);

    if (!c) { setLoading(false); return; }

    let cl = null;
    if (c?.client_id) {
      try {
        const res = await base44.entities.Client.filter({ id: c.client_id });
        cl = res?.[0] || null;
      } catch { /* ignore */ }
    }
    if (!cl && (c?.client_codigo || c?.codigo_cliente)) {
      try {
        const codigo = c.client_codigo || c.codigo_cliente;
        const res = await base44.entities.Client.filter({ codigo_cliente: codigo });
        cl = res?.[0] || null;
        if (cl) {
          await base44.entities.Contract.update(contractId, {
            client_id: cl.id,
            client_nome: cl.nome_razao_social || c.client_nome || cl.fantasia,
          });
        }
      } catch { /* ignore */ }
    }
    if (!cl && c?.client_nome) {
      try {
        const allClients = await base44.entities.Client.list("-created_date", 500);
        cl = allClients.find(x =>
          x.nome_razao_social?.toLowerCase() === c.client_nome?.toLowerCase() ||
          x.fantasia?.toLowerCase() === c.client_nome?.toLowerCase()
        ) || null;
        if (cl && !c.client_id) {
          await base44.entities.Contract.update(contractId, { client_id: cl.id });
        }
      } catch { /* ignore */ }
    }
    setClient(cl);
    const allReqs = await base44.entities.PaymentRequest.list("-created_date", 50);
    const pendentes = allReqs.filter(r =>
      r.status === "aguardando_confirmacao" &&
      (r.itens || []).some(i => i.id === contractId || i.numero === c?.numero)
    );
    setPendingPaymentReqs(pendentes);
    setHistoricoDevolucoes(c?.historico_devolucoes || []);
    if (c?.itens?.length) {
      const itensNeedEnrich = c.itens.some(i => i.equipamento_id && i.aplica_valor_minimo === undefined);
      if (itensNeedEnrich) {
        const enriched = await Promise.all(c.itens.map(async (item) => {
          if (!item.equipamento_id || item.aplica_valor_minimo !== undefined) return item;
          try {
            const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
            if (!eq) return item;
            return {
              ...item,
              aplica_valor_minimo: eq.aplica_valor_minimo === true,
              dias_minimos_proprio: item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : (eq.dias_minimos_proprio || 0),
              valor_diario: item.valor_diario > 0 ? item.valor_diario : (eq.valor_diario || 0),
            };
          } catch { return item; }
        }));
        setEnrichedItens(enriched);
      } else {
        setEnrichedItens(c.itens);
      }
    } else {
      setEnrichedItens([]);
    }
    // ✅ Inicializa signatureDataUrl com assinatura já salva no banco
    // Prioridade: assinatura_entrega_url (motorista) > assinatura do locatário salva em base64
    if (c?.assinatura_entrega_url) {
      setSignatureDataUrl(c.assinatura_entrega_url);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [contractId]);

  useEffect(() => {
    if (!contract || contract.data_recolha) return;
    if (!["aguardando_recolha", "devolvido_parcial"].includes(contract.status)) return;
    const fb = contract.data_prevista_termino || format(new Date(), "yyyy-MM-dd");
    base44.entities.Contract.update(contractId, { data_recolha: fb })
      .then(() => setContract(p => p ? { ...p, data_recolha: fb } : p));
  }, [contract?.id, contract?.status, contract?.data_recolha]);

  const updateEquipmentStock = async (action) => {
    if (!contract?.itens?.length) return;
    for (const item of contract.itens) {
      if (!item.equipamento_id) continue;
      const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
      if (!eq) continue;
      const qty = item.quantidade_retirada || 0;
      if (action === "reservar") {
        await base44.entities.Equipment.update(item.equipamento_id, {
          status_item: "alugado",
          quantidade_disponivel: Math.max(0, (eq.quantidade_disponivel || 0) - qty),
          quantidade_alugada: (eq.quantidade_alugada || 0) + qty,
        });
      } else if (action === "liberar") {
        await base44.entities.Equipment.update(item.equipamento_id, {
          status_item: (eq.quantidade_disponivel || 0) + qty >= (eq.quantidade_total || 0) ? "disponivel" : "alugado",
          quantidade_disponivel: (eq.quantidade_disponivel || 0) + qty,
          quantidade_alugada: Math.max(0, (eq.quantidade_alugada || 0) - qty),
        });
      }
    }
  };

  const updateStatus = async (status, extraData = {}) => {
    if (status === "em_transito" && !contract.motorista_entrega) {
      toast.error("Atribua um motorista antes de enviar para entrega!");
      return;
    }
    try {
      await base44.entities.Contract.update(contractId, { status, ...extraData });
      if (status === "em_transito" && contract.status === "rascunho") {
        await updateEquipmentStock("reservar");
        // Registra timestamp real de saída para entrega
        await base44.entities.Contract.update(contractId, {
          data_entrega_real: format(new Date(), "dd/MM/yyyy HH:mm"),
        });
      } else if (status === "na_obra" && contract.status === "em_transito") {
        // Registra timestamp real de confirmação de entrega
        await base44.entities.Contract.update(contractId, {
          data_confirmacao_entrega: format(new Date(), "dd/MM/yyyy HH:mm"),
        });
      } else if (status === "finalizado") {
        await releaseEquipmentSerials(
          (contract.itens || []).map(item => ({
            equipamento_id: item.equipamento_id,
            quantidade: item.quantidade_retirada || 0,
            seriais_devolvidos: [], // lista vazia = libera tudo vinculado ao contrato
          })).filter(x => x.equipamento_id),
          {
            contratoId: contractId,
            contratoNumero: contract.numero,
            usuarioNome: currentUser?.full_name || currentUser?.email || "—",
            evento: "Retorno da locação",
          }
        );
      }
      toast.success("Status atualizado!");
      load();
    } catch (err) {
      showError(err, "contrato", "Não foi possível atualizar o status");
    }
  };

  const confirmPayment = async () => {
    const saldoAtual = saldoPagarCorreto || contract.saldo_pagar || 0;
    const descontoNum = parseFloat(payDesconto) || 0;
    const descontoAplicado = payDescontoTipo === "percentual"
      ? (saldoAtual * descontoNum / 100)
      : descontoNum;
    const valorFinal = Math.max(0, saldoAtual - descontoAplicado);
    const valorRecebido = parseFloat(payValor) || 0;
    if (valorRecebido <= 0) { toast.error("Informe o valor recebido"); return; }

    try {
    // Criar solicitação de pagamento — aguarda aprovação financeira
    await base44.entities.PaymentRequest.create({
      client_id: contract.client_id,
      client_nome: contract.client_nome,
      itens: [{
        tipo: "contrato",
        numero: contract.numero,
        id: contractId,
        valor: Math.min(valorRecebido, valorFinal),
        descricao: `Contrato #${contract.numero}`,
        valor_original: saldoAtual,
        desconto: descontoAplicado,
        valor_final: valorFinal,
        forma_pagamento: payForma,
      }],
      valor_total: Math.min(valorRecebido, valorFinal),
      data: format(new Date(), "yyyy-MM-dd"),
      comprovante_url: payComprovanteUrl || "",
      observacoes: `Forma: ${payForma}${descontoAplicado > 0 ? ` | Desconto: R$ ${descontoAplicado.toFixed(2)}` : ""}${payForma === "dinheiro" ? ` | Recebido: R$ ${valorRecebido.toFixed(2)}` : ""}`,
      status: "aguardando_confirmacao",
      registrado_por: currentUser?.full_name || currentUser?.email || "—",
    });

    // Salva dados do último pagamento para gerar recibo
    setLastPayment({
      valorPago: Math.min(valorRecebido, valorFinal),
      formaPagamento: payForma,
      dataPagamento: format(new Date(), "dd/MM/yyyy HH:mm"),
      responsavel: currentUser?.full_name || currentUser?.email || "",
    });
    setPayDialog(false);
    setPayValor("");
    setPayDesconto("");
    setPayValorRecebido("");
    setPayComprovanteUrl("");
    toast.success("Solicitação de pagamento criada! Aguardando aprovação financeira.");
    load();
    } catch (err) {
      showError(err, "pagamento", "Não foi possível registrar o pagamento");
    }
  };

  const applyPaymentApproval = async (valorRecebido, payForma, descontoAplicado) => {
    const saldoAtual = saldoPagarCorreto || contract.saldo_pagar || 0;
    const valorFinal = Math.max(0, saldoAtual - (descontoAplicado || 0));
    const novoValorPago = (contract.valor_pago || 0) + Math.min(valorRecebido, valorFinal);
    const novoSaldo = Math.max(0, valorFinal - valorRecebido);
    const novoStatusFin = novoSaldo === 0 ? "pago" : novoValorPago > 0 ? "parcial" : "pendente";
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const updates = {
      status_financeiro: novoStatusFin,
      valor_pago: novoValorPago,
      saldo_pagar: novoSaldo,
      forma_pagamento: payForma,
      valor_recebido_ultima_baixa: valorRecebido,
      dinamico_data_base: hojeStr,
      dinamico_dias_em_aberto: 0,
      dinamico_valor_em_aberto: 0,
      dinamico_valor_pago_acumulado: (contract.dinamico_valor_pago_acumulado || 0) + valorRecebido,
      dinamico_ultima_atualizacao: new Date().toISOString(),
    };
    if (novoSaldo === 0 && contract.status === "devolvido_pendente") {
      updates.status = "finalizado";
    }
    await base44.entities.Contract.update(contractId, updates);
  };

  const handleLogisticReturn = async () => {
    // Libera estoque + seriais individuais para TODOS os itens do contrato
    await releaseEquipmentSerials(
      (contract.itens || []).map(item => ({
        equipamento_id: item.equipamento_id,
        quantidade: item.quantidade_retirada || 0,
        seriais_devolvidos: [],
      })),
      {
        contratoId: contractId,
        contratoNumero: contract.numero,
        usuarioNome: currentUser?.full_name || currentUser?.email || "—",
        evento: "Retorno da locação",
      }
    );

    // Calcula o saldo final congelado no momento da devolução
    const saldoFinal = Math.max(0, contract.dinamico_valor_em_aberto ?? contract.saldo_pagar ?? 0);
    const hasSaldo = saldoFinal > 0;

    // Monta itens para recibo de devolução total
    const itensDevolucaoTotal = (contract.itens || []).map((item) => ({
      nome: item.equipamento_nome || "—",
      quantidade: item.quantidade_retirada || 1,
      unidade: "un.",
      observacao: "",
    }));
    const novaDevolucao = {
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      tipo: "total",
      motorista: contract.motorista_recolha || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: returnObs || "",
      itens: itensDevolucaoTotal,
      status: "concluido",
      assinatura_responsavel_url: currentUser?.assinatura_usuario || null,
    };
    const historicoDevAtualizado = [...(contract.historico_devolucoes || []), novaDevolucao];

    // REGRA: após devolução, congela cobrança dinâmica e define saldo final fixo
    // Contrato só vai para "finalizado" se saldo for zero
    const dataRecolhaReal = format(new Date(), "dd/MM/yyyy HH:mm");
    await base44.entities.Contract.update(contractId, {
      status: hasSaldo ? "devolvido_pendente" : "finalizado",
      observacao_devolucao: returnObs,
      historico_devolucoes: historicoDevAtualizado,
      data_recolha_real: dataRecolhaReal,
      // Congela cobrança: pausa automática e registra saldo final
      cobranca_pausada: true,
      saldo_pagar: saldoFinal,
      dinamico_valor_em_aberto: saldoFinal,
      // Registra data de encerramento para referência
      data_encerramento_cobranca: dataRecolhaReal,
    });

    setLastDevolucao({
      tipoDevolucao: "total",
      itensDevolucao: itensDevolucaoTotal,
      motorista: contract.motorista_recolha || "",
      usuario: currentUser?.full_name || currentUser?.email || "",
      observacoes: returnObs || "",
      numeroDevolucao: historicoDevAtualizado.length,
    });
    setHistoricoDevolucoes(historicoDevAtualizado);

    setReturnDialog(false);
    toast.success(hasSaldo ? "Equipamentos liberados! Contrato aguarda pagamento." : "Contrato finalizado!");
    load();
  };

  const openRecolhaDialog = () => {
    const initial = (contract.itens || []).map((item, idx) => ({
      idx,
      quantidade: 0,
      max: (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0),
    }));
    setRecolhaItens(initial);
    setRecolhaTipo("total");
    setRecolhaMotorista("");
    setRecolhaData(contract.data_recolha || "");
    setRecolhaDialog(true);
  };

  const handleCancelarRecolha = async () => {
    if (!cancelRecolhaMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    // Registra o cancelamento no histórico sem apagar o histórico existente
    const historicoCancelamento = {
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      motorista: contract.motorista_recolha || "—",
      tipo: "cancelamento",
      status: "cancelado",
      motivo: cancelRecolhaMotivo,
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: `CANCELADO: ${cancelRecolhaMotivo}`,
      itens: [],
    };
    const historicoAtual = [...(contract.historico_recolhas || []), historicoCancelamento];
    await base44.entities.Contract.update(contractId, {
      status: "na_obra",
      recolha_parcial_pendente: false,
      recolha_parcial_itens: null,
      historico_recolhas: historicoAtual,
    });
    setCancelRecolhaDialog(false);
    setCancelRecolhaMotivo("");
    toast.success("Solicitação de recolha cancelada. Contrato voltou para Na Obra.");
    load();
  };

  const handleSolicitarRecolha = async () => {
    const dataRecolhaFinal = recolhaData || format(new Date(), "yyyy-MM-dd");
    if (recolhaTipo === "parcial") {
      const toRecolher = recolhaItens.filter((r) => r.quantidade > 0);
      if (toRecolher.length === 0) { toast.error("Selecione ao menos um item para recolha parcial"); return; }
      const historicoRecolha = {
        data: format(new Date(), "dd/MM/yyyy HH:mm"),
        motorista: recolhaMotorista || "A definir",
        tipo: "parcial",
        itens: toRecolher.map((r) => ({ nome: contract.itens[r.idx]?.equipamento_nome || "—", quantidade: r.quantidade, idx: r.idx })),
        status: "pendente",
      };
      const recolhaUpdate = {
        status: "aguardando_recolha",
        historico_recolhas: [...(contract.historico_recolhas || []), historicoRecolha],
        recolha_parcial_pendente: true,
        recolha_parcial_itens: toRecolher.map((r) => ({ idx: r.idx, quantidade: r.quantidade })),
        data_recolha: dataRecolhaFinal,
        data_prevista_termino: dataRecolhaFinal,
      };
      if (recolhaMotorista) recolhaUpdate.motorista_recolha = recolhaMotorista;
      await base44.entities.Contract.update(contractId, recolhaUpdate);
      setRecolhaDialog(false);
      toast.success("Recolha parcial solicitada! Aparecerá no calendário e quadro logístico.");
      load();
    } else {
      const recolhaUpdate = {
        status: "aguardando_recolha",
        recolha_parcial_pendente: false,
        recolha_parcial_itens: null,
        data_recolha: dataRecolhaFinal,
        data_prevista_termino: dataRecolhaFinal,
      };
      if (recolhaMotorista) recolhaUpdate.motorista_recolha = recolhaMotorista;
      await base44.entities.Contract.update(contractId, recolhaUpdate);
      setRecolhaDialog(false);
      setRecolhaMotorista("");
      setRecolhaData("");
      toast.success(recolhaMotorista ? "Recolha total solicitada com motorista!" : "Recolha total solicitada! Motorista será definido pela logística.");
      load();
    }
  };

  const handleConfirmarRecolhaParcial = async () => {
    // Chamado quando o motorista confirma a recolha parcial no campo
    const itensParaRecolher = contract.recolha_parcial_itens || [];
    if (itensParaRecolher.length === 0) { toast.error("Nenhum item definido para recolha parcial"); return; }

    // Atualiza quantidade_devolvida
    const updatedItens = (contract.itens || []).map((item, idx) => {
      const r = itensParaRecolher.find((d) => d.idx === idx);
      const qtdRecolhida = r ? r.quantidade : 0;
      return { ...item, quantidade_devolvida: (item.quantidade_devolvida || 0) + qtdRecolhida };
    });

    // Libera estoque + seriais dos itens recolhidos
    await releaseEquipmentSerials(
      itensParaRecolher.map(r => ({
        equipamento_id: contract.itens[r.idx]?.equipamento_id,
        quantidade: r.quantidade,
        seriais_devolvidos: r.seriais_devolvidos || [],
      })).filter(x => x.equipamento_id),
      {
        contratoId: contractId,
        contratoNumero: contract.numero,
        usuarioNome: currentUser?.full_name || currentUser?.email || "—",
        evento: "Recolha Parcial",
      }
    );

    const allReturned = updatedItens.every(
      (item) => (item.quantidade_devolvida || 0) >= (item.quantidade_retirada || 0)
    );
    const saldoFinalRecolha = Math.max(0, contract.dinamico_valor_em_aberto ?? contract.saldo_pagar ?? 0);
    const hasSaldo = saldoFinalRecolha > 0;

    const newStatus = allReturned ? (hasSaldo ? "devolvido_pendente" : "finalizado") : "na_obra";

    // Atualiza histórico — marca última recolha como concluída
    const historicoAtualizado = (contract.historico_recolhas || []).map((h, i) =>
      i === (contract.historico_recolhas.length - 1) ? { ...h, status: "concluido" } : h
    );

    // Monta itens para recibo
    const itensDevolucaoRecolha = itensParaRecolher.map((r) => ({
      nome: contract.itens[r.idx]?.equipamento_nome || "—",
      quantidade: r.quantidade,
      unidade: "un.",
      observacao: "",
    }));
    const novaDevolucaoRecolha = {
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      tipo: allReturned ? "total" : "parcial",
      motorista: contract.motorista_recolha || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: "",
      itens: itensDevolucaoRecolha,
      status: "concluido",
      assinatura_responsavel_url: currentUser?.assinatura_usuario || null,
    };
    const historicoDevRecolha = [...(contract.historico_devolucoes || []), novaDevolucaoRecolha];

    await base44.entities.Contract.update(contractId, {
      itens: updatedItens,
      status: newStatus,
      recolha_parcial_pendente: false,
      recolha_parcial_itens: null,
      historico_recolhas: historicoAtualizado,
      historico_devolucoes: historicoDevRecolha,
      data_recolha_real: format(new Date(), "dd/MM/yyyy HH:mm"),
    });

    setLastDevolucao({
      tipoDevolucao: allReturned ? "total" : "parcial",
      itensDevolucao: itensDevolucaoRecolha,
      motorista: contract.motorista_recolha || "",
      usuario: currentUser?.full_name || currentUser?.email || "",
      observacoes: "",
      numeroDevolucao: historicoDevRecolha.length,
    });
    setHistoricoDevolucoes(historicoDevRecolha);

    toast.success(allReturned ? "Todos os itens recolhidos! Contrato encerrado." : "Recolha parcial confirmada! Contrato retornou para Entregue.");
    load();
  };

  const handleUploadComprovante = async (file) => {
    setPayComprovanteLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPayComprovanteUrl(file_url);
    setPayComprovanteLoading(false);
  };

  const renewContract = async () => {
    const newEnd = contract.prazo_tipo === "meses"
      ? addMonths(parseISO(contract.data_prevista_termino), contract.prazo_valor || 1)
      : addDays(parseISO(contract.data_prevista_termino), contract.prazo_valor || 30);

    await base44.entities.Contract.update(contractId, {
      data_prevista_termino: format(newEnd, "yyyy-MM-dd"),
      status: "na_obra",
    });
    toast.success("Contrato renovado!");
    load();
  };

  const openPartialReturn = () => {
    const initial = (contract.itens || []).map((item, idx) => ({
      idx,
      quantidade: 0,
      max: (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0),
      seriais_devolvidos: [],
      controle_individual: item.controle_individual || false,
      seriais_no_contrato: item.seriais_selecionados || [],
    }));
    setDevItens(initial);
    setDevObs("");
    setDevDialog(true);
  };

  const handlePartialReturn = async () => {
    const toReturn = devItens.filter((d) => d.quantidade > 0);
    if (toReturn.length === 0) { toast.error("Selecione ao menos um item para devolver"); return; }

    // Update each item's quantidade_devolvida and update stock
    const updatedItens = (contract.itens || []).map((item, idx) => {
      const devItem = devItens.find((d) => d.idx === idx);
      const qtdDevolvida = devItem ? devItem.quantidade : 0;
      return { ...item, quantidade_devolvida: (item.quantidade_devolvida || 0) + qtdDevolvida };
    });

    // Libera estoque + seriais dos itens devolvidos (parcial)
    await releaseEquipmentSerials(
      toReturn.map(d => ({
        equipamento_id: contract.itens[d.idx]?.equipamento_id,
        quantidade: d.quantidade,
        seriais_devolvidos: d.seriais_devolvidos || [],
      })).filter(x => x.equipamento_id),
      {
        contratoId: contractId,
        contratoNumero: contract.numero,
        usuarioNome: currentUser?.full_name || currentUser?.email || "—",
        evento: "Devolução Parcial",
      }
    );

    // Check if ALL items are fully returned
    const allReturned = updatedItens.every(
      (item) => (item.quantidade_devolvida || 0) >= (item.quantidade_retirada || 0)
    );

    const saldoFinalParcial = Math.max(0, contract.dinamico_valor_em_aberto ?? contract.saldo_pagar ?? 0);
    const hasSaldo = saldoFinalParcial > 0;
    const newStatus = allReturned
      ? (hasSaldo ? "devolvido_pendente" : "finalizado")
      : "devolvido_parcial";

    // Monta registro de devolução para histórico
    const itensDevolucaoParaRecibo = toReturn.map((d) => ({
      nome: contract.itens[d.idx]?.equipamento_nome || "—",
      quantidade: d.quantidade,
      unidade: "un.",
      observacao: "",
    }));
    const novaDevolucao = {
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      tipo: allReturned ? "total" : "parcial",
      motorista: contract.motorista_recolha || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: devObs || "",
      itens: itensDevolucaoParaRecibo,
      status: "concluido",
      assinatura_responsavel_url: currentUser?.assinatura_usuario || null,
    };
    const historicoDevAtualizado = [...(contract.historico_devolucoes || []), novaDevolucao];

    await base44.entities.Contract.update(contractId, {
      itens: updatedItens,
      status: newStatus,
      observacao_devolucao: devObs || contract.observacao_devolucao,
      historico_devolucoes: historicoDevAtualizado,
      data_recolha_real: format(new Date(), "dd/MM/yyyy HH:mm"),
    });

    // Gera recibo automaticamente
    const numeroDev = historicoDevAtualizado.length;
    setLastDevolucao({
      tipoDevolucao: allReturned ? "total" : "parcial",
      itensDevolucao: itensDevolucaoParaRecibo,
      motorista: contract.motorista_recolha || "",
      usuario: currentUser?.full_name || currentUser?.email || "",
      observacoes: devObs || "",
      numeroDevolucao: numeroDev,
    });
    setHistoricoDevolucoes(historicoDevAtualizado);

    setDevDialog(false);
    if (allReturned) {
      toast.success(hasSaldo ? "Todos os itens devolvidos! Aguardando pagamento." : "Contrato finalizado — todos os itens retornaram!");
    } else {
      toast.success("Devolução parcial registrada! Recibo disponível abaixo.");
    }
    load();
  };

  const enrichContractItens = async (itens) => {
    if (!itens?.length) return itens || [];
    const enriched = await Promise.all(itens.map(async (item) => {
      if (!item.equipamento_id) return item;
      try {
        const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
        if (!eq) return item;
        return {
          ...item,
          aplica_valor_minimo: eq.aplica_valor_minimo === true,
          dias_minimos_proprio: eq.dias_minimos_proprio > 0 ? eq.dias_minimos_proprio : (item.dias_minimos_proprio || 0),
          valor_indenizacao: eq.valor_indenizacao || item.valor_indenizacao || 0,
        };
      } catch { return item; }
    }));
    return enriched;
  };

  const generatePDF = async () => {
    if (!contract) return;
    const enrichedItens = await enrichContractItens(contract.itens);
    const enrichedContract = { ...contract, itens: enrichedItens };
    const doc = generateContractPDF({ contract: enrichedContract, client, settings, signatureDataUrl });
    doc.save(`contrato_${contract.numero || contract.id}.pdf`);
    toast.success("PDF gerado!");
  };

  const generateQuitadoPDF = async () => {
    if (!contract) return;
    const enrichedItens = await enrichContractItens(contract.itens);
    const enrichedContract = { ...contract, itens: enrichedItens };
    const doc = generateContractQuitadoPDF({ contract: enrichedContract, client, settings, signatureDataUrl });
    doc.save(`contrato_quitado_${contract.numero || contract.id}.pdf`);
    toast.success("PDF Quitado gerado!");
  };

  const handleGeneratePDFForDialog = async (tipo) => {
    const enrichedItens = await enrichContractItens(contract?.itens);
    const enrichedContract = { ...contract, itens: enrichedItens };
    if (tipo === "quitado") return generateContractQuitadoPDF({ contract: enrichedContract, client, settings, signatureDataUrl });
    return generateContractPDF({ contract: enrichedContract, client, settings, signatureDataUrl });
  };

  const handleSignAndExport = () => {
    setSignatureDialog(true);
  };

  const onSignatureConfirmed = async (dataUrl) => {
    setSignatureDataUrl(dataUrl);
    const dataHoraAssinatura = format(new Date(), "dd/MM/yyyy HH:mm");
    await base44.entities.Contract.update(contractId, { assinatura_data: dataHoraAssinatura });
    await base44.entities.ActivityLog.create({
      usuario: contract.client_nome || "Cliente",
      acao: "Assinatura do cliente",
      modulo: "contrato",
      referencia_id: contractId,
      referencia_numero: contract.numero,
      detalhes: `Contrato assinado pelo cliente em ${dataHoraAssinatura}. Edição bloqueada automaticamente.`,
      data_hora: new Date().toISOString(),
    });
    const freshSettings = await base44.entities.CompanySettings.list().then((l) => l[0] || null);
    const enrichedItens = await enrichContractItens(contract.itens);
    const enrichedContract = { ...contract, itens: enrichedItens };
    const doc = generateContractPDF({ contract: enrichedContract, client, settings: freshSettings, signatureDataUrl: dataUrl });
    doc.save(`contrato_assinado_${contract.numero || contract.id}.pdf`);
    toast.success("Contrato assinado e PDF gerado! Edição bloqueada.");
    load();
  };

  const handleCancel = async () => {
    if (!cancelMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    try {
    // Libera estoque + seriais ao cancelar
    await releaseEquipmentSerials(
      (contract.itens || []).map(item => ({
        equipamento_id: item.equipamento_id,
        quantidade: item.quantidade_retirada || 0,
        seriais_devolvidos: [], // lista vazia = libera tudo vinculado ao contrato
      })).filter(x => x.equipamento_id),
      {
        contratoId: contractId,
        contratoNumero: contract.numero,
        usuarioNome: currentUser?.full_name || currentUser?.email || "—",
        evento: "Cancelamento de contrato",
      }
    );
    await base44.entities.Contract.update(contractId, {
      status: "cancelado",
      cobranca_pausada: true,
      saldo_pagar: 0,
      dinamico_valor_em_aberto: 0,
      dinamico_dias_em_aberto: 0,
      observacao_devolucao: `CANCELADO: ${cancelMotivo} — por ${currentUser?.full_name || currentUser?.email || "—"} em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    });
    // Log
    await base44.entities.ActivityLog.create({
      usuario: currentUser?.full_name || currentUser?.email || "—",
      acao: "Cancelamento de contrato",
      modulo: "contrato",
      referencia_id: contractId,
      referencia_numero: contract.numero,
      detalhes: cancelMotivo,
      data_hora: new Date().toISOString(),
    });
    setCancelDialog(false);
    toast.success("Contrato cancelado e estoque liberado.");
    load();
    } catch (err) {
      showError(err, "contrato", "Não foi possível cancelar o contrato");
    }
  };

  const buildWhatsappMsg = () => {
    if (!contract) return "";
    const template = settings?.mensagem_whatsapp_contrato || "Olá {{nome_cliente}}, segue o contrato nº {{numero_contrato}} da {{nome_empresa}}. Prazo: {{data_fim}}.";
    return template
      .replace("{{nome_cliente}}", contract.client_nome || "")
      .replace("{{numero_contrato}}", contract.numero || "")
      .replace("{{nome_empresa}}", settings?.nome_fantasia || settings?.nome_social || "")
      .replace("{{valor_total}}", `R$ ${(contract.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
      .replace("{{data_fim}}", (() => {
        if (!contract.data_prevista_termino) return "—";
        try {
          const d = parseISO(contract.data_prevista_termino);
          return isNaN(d) ? "—" : format(d, "dd/MM/yyyy");
        } catch {
          return "—";
        }
      })());
  };

  const whatsappDebt = contract && (contract.saldo_pagar || 0) > 0
    ? `Olá ${contract.client_nome}, o saldo devedor do contrato nº ${contract.numero || ""} é de R$ ${(contract.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Por favor, regularize o pagamento. Andaimes Costa do Sol.`
    : "";
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground font-medium">Contrato não encontrado ou não acessível.</p>
        <Button variant="outline" onClick={() => navigate("/contratos")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar para Contratos
        </Button>
      </div>
    );
  }

  const daysLeft = contract.data_prevista_termino
    ? differenceInDays(parseISO(contract.data_prevista_termino), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
  // devolvido_pendente fecha logística mas mantém financeiro aberto
  const isClosed = ["finalizado", "cancelado", "devolvido_pendente"].includes(contract.status);
  // Bloqueio de edição: contrato assinado pelo cliente só pode ser editado por admin com motivo
  const isSignedLocked = !!contract.assinatura_data && !contract._editUnlocked;
  // Usa permUser do usePermissions (sem race condition) com fallback para currentUser
  const activeUser = permUser || currentUser;
  const isAdmin = permIsAdmin || ["admin", "Admin"].includes(activeUser?.role || "");
  const isAtendente = activeUser?.role === "atendente";
  const isOperacional = activeUser?.role === "operacional";
  const isMotorista = activeUser?.role === "motorista";
  // isOperador: atendente, operacional, admin ou permissão customizada de editar contratos
  const isOperador = isAdmin || isAtendente || isOperacional || can("contratos", "editar");

  const handleUnlockEdit = async () => {
    if (!unlockMotivo.trim()) { toast.error("Informe o motivo para desbloquear a edição"); return; }
    // Registra log de desbloqueio e navega para edição
    await base44.entities.ActivityLog.create({
      usuario: currentUser?.full_name || currentUser?.email || "—",
      acao: "Desbloqueio de edição (Admin)",
      modulo: "contrato",
      referencia_id: contractId,
      referencia_numero: contract.numero,
      detalhes: `Motivo: ${unlockMotivo}`,
      data_hora: new Date().toISOString(),
    });
    setUnlockDialog(false);
    navigate(`/contratos/editar/${contractId}`);
    toast.warning("Edição liberada por Admin. Alterações serão registradas no log.");
  };

  const whatsappMsg = buildWhatsappMsg();
  // Status financeiro correto: se saldo ≤ 0 mas ainda marcado como "parcial" → exibe "pago"
  const statusFinanceiroExibido = ((contract.saldo_pagar ?? 0) <= 0 && ["parcial", "pendente"].includes(contract.status_financeiro || "")) ? "pago" : (contract.status_financeiro || "pendente");
  const isEncerrado = ["finalizado", "cancelado"].includes(contract.status);

  // Calcula valores corretos respeitando mínimo — fonte de verdade para exibição
  const _itensCalc = enrichedItens || contract?.itens || [];
  const _diasCalc = getDiasContrato(contract);
  const _s = settings || {};
  const _calcResult = calcContractTotal({
    itens: _itensCalc,
    diasContrato: _diasCalc,
    diasMinimos: _s.minimo_dias || 5,
    valorMinimoContrato: _s.valor_minimo_contrato || 0,
    frete: contract.frete || 0,
    sinal: contract.sinal || 0,
    valorPago: contract.valor_pago || 0,
    regrasDesconto: _s.regras_desconto_tempo || [],
  });
  const valorTotalCorreto = _calcResult.valorTotal;
  // Prioriza dinamico_valor_em_aberto para contratos ativos — fonte de verdade em tempo real
  // devolvido_pendente: saldo já foi congelado, não recalcular dinamicamente
  const _isAtivoDinamico = !["finalizado", "cancelado", "rascunho", "devolvido_pendente"].includes(contract.status);
  const saldoPagarCorreto = (_isAtivoDinamico && contract.dinamico_ultima_atualizacao && contract.dinamico_valor_em_aberto != null)
    ? Math.max(0, contract.dinamico_valor_em_aberto)
    : _calcResult.saldoPagar;

  return (
    <div>
      <PageHeader
        title={`Contrato #${contract.numero || "—"}`}
        subtitle={contract.client_nome + (client?.codigo_cliente ? ` — Cód. ${client.codigo_cliente}` : "")}
      >
        <Button variant="outline" onClick={() => navigate("/contratos")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        {isSignedLocked ? (
          isAdmin ? (
            <Button variant="outline" onClick={() => setUnlockDialog(true)} className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50">
              <ShieldAlert className="w-4 h-4" /> Editar (Admin)
            </Button>
          ) : (
            <Button variant="outline" disabled className="gap-2 opacity-50 cursor-not-allowed">
              <Lock className="w-4 h-4" /> Bloqueado
            </Button>
          )
        ) : (
          <Button variant="outline" onClick={() => navigate(`/contratos/editar/${contractId}`)} className="gap-2">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        )}
      </PageHeader>

      {/*Lock*/}
      {isSignedLocked && (
        <div className="max-w-5xl mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Este contrato foi <strong>assinado pelo cliente em {contract.assinatura_data}</strong> e está bloqueado para edição.{isAdmin ? " Apenas administradores podem desbloquear." : ""}</span>
        </div>
      )}

      <SyncContractSaldo contract={contract} enrichedItens={enrichedItens} settings={settings} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-5xl">
        <TabsList className="mb-4">
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" />Histórico</TabsTrigger>
          <TabsTrigger value="versoes" className="gap-1.5"><GitBranch className="w-3.5 h-3.5" />Versões</TabsTrigger>
        </TabsList>

        <TabsContent value="historico">
          <ContractAuditTab contractId={contractId} contractNumero={contract?.numero} />
        </TabsContent>

        <TabsContent value="versoes">
          <ContractVersionsTab contractId={contractId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="contrato">

      <div className="space-y-6">
        {/* Status & Alerts */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={contract.status} />
          <StatusBadge status={statusFinanceiroExibido} />
          {!isEncerrado && isOverdue && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
              ⚠ VENCIDO — {Math.abs(daysLeft)} dias atrás
            </span>
          )}
          {!isEncerrado && isNearExpiry && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              ⏰ Vence em {daysLeft} dia(s)
            </span>
          )}
        </div>

        {/* Info Cards */}
        <ContractInfoCards contract={contract} valorTotalCorreto={valorTotalCorreto} calcResult={_calcResult} />

        {/* Dynamic Billing Card */}
        <DynamicBillingCard contract={contract} onUpdate={load} />

        {/* Items */}
        {contract.itens?.length > 0 && (() => {
          const diasContrato = getDiasContrato(contract);
          const settingsForCalc = settings || {};
          const itensParaCalc = enrichedItens || contract.itens;
          const calcResult = calcContractTotal({
            itens: itensParaCalc,
            diasContrato,
            diasMinimos: settingsForCalc.minimo_dias || 5,
            valorMinimoContrato: settingsForCalc.valor_minimo_contrato || 0,
            frete: contract.frete || 0,
            sinal: contract.sinal || 0,
            valorPago: contract.valor_pago || 0,
            regrasDesconto: settingsForCalc.regras_desconto_tempo || [],
          });
          const todosItens = calcResult.itensCalculados;
          const grupoA = calcResult.grupoA;
          const ItemRow = ({ item }) => {
            const temMinimo = item._temMinimo === true;
            const diasMin = item._diasMinUsados || item.dias_minimos_proprio || 5;
            const diasEfetivos = item._diasEfetivos || diasContrato;
            const minimoAplicado = item._minimoAplicado === true;
            const subtotal = item._subtotal ?? ((item.valor_unitario || 0) * (item.quantidade_retirada || 1) - (item.desconto || 0));
            return (
              <tr className="border-b border-dashed last:border-0">
                <td className="py-2.5 font-medium">
                  <div>{item.equipamento_nome || "—"}</div>
                  {temMinimo && minimoAplicado ? (
                    <div className="text-[10px] text-blue-600 mt-0.5 leading-tight">
                      ⚠ Cobrança mínima aplicada: {diasMin} dias mínimos
                    </div>
                  ) : temMinimo ? (
                    <div className="text-[10px] text-emerald-600 mt-0.5">Mínimo de {diasMin} dias — cobrado por {diasEfetivos} dias reais</div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground mt-0.5">Cobrado por dias reais de uso</div>
                  )}
                </td>
                <td className="py-2.5 text-right">{item.quantidade_retirada}</td>
                <td className="py-2.5 text-right">R$ {(item.valor_diario || item.valor_unitario || 0).toFixed(2)}</td>
                <td className="py-2.5 text-right text-xs text-muted-foreground">
                  {temMinimo
                    ? <span className={minimoAplicado ? "text-blue-600 font-medium" : ""}>{diasEfetivos} dias{minimoAplicado ? " (mín.)" : ""}</span>
                    : `${diasContrato} dias`}
                </td>
                <td className="py-2.5 text-right">R$ {(item.desconto || 0).toFixed(2)}</td>
                <td className="py-2.5 text-right">{item.quantidade_devolvida || 0}</td>
                <td className="py-2.5 text-right font-semibold">
                  R$ {subtotal.toFixed(2)}
                </td>
              </tr>
            );
          };

          return (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Package className="w-4 h-4" /> Itens do Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">Equipamento / Regra</th>
                        <th className="text-right py-2 font-medium">Qtd</th>
                        <th className="text-right py-2 font-medium">Valor Diário</th>
                        <th className="text-right py-2 font-medium">Dias Cobrados</th>
                        <th className="text-right py-2 font-medium">Desconto</th>
                        <th className="text-right py-2 font-medium">Devolvida</th>
                        <th className="text-right py-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todosItens.map((item, i) => <ItemRow key={i} item={item} />)}
                    </tbody>
                  </table>
                </div>
                {grupoA.length > 0 && (
                  <p className="text-[10px] text-blue-600 italic mt-1">
                    * Caso o período seja inferior ao mínimo configurado, será cobrado o valor mínimo do equipamento.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Resumo Financeiro */}
        {(() => {
          const s = settings || {};
          const itensParaCalc = enrichedItens || contract.itens || [];
          const calcResult = _calcResult || { grupoA: [], saldoPagar: 0, valorTotal: 0, descontoInfo: null };
          const temGrupoA = calcResult.grupoA.length > 0;
          const minimoAplicadoEmAlgum = calcResult.grupoA.some(i => i._minimoAplicado);
          const totalFinal = valorTotalCorreto;
          return (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Resumo Financeiro</p>
                <div className="space-y-1.5 text-sm">
                  {/* Valor da locação diária — SEMPRE visível (soma das diárias reais dos itens × qtd) */}
                  {(() => {
                    const valorDiarioPuro = itensParaCalc.reduce((sum, item) => {
                      const diaria = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
                      return sum + diaria * (item.quantidade_retirada || 1);
                    }, 0);
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor da locação diária:</span>
                        <span>R$ {valorDiarioPuro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })()}

                  {/* Valor mínimo de locação — somente quando existe Grupo A */}
                  {temGrupoA && (() => {
                    const diasMinLabel = calcResult.grupoA.reduce((max, i) => Math.max(max, i._diasMinUsados || i.dias_minimos_proprio || (s.minimo_dias || 5)), 0);
                    const valorMinimo = calcValorMinimoLocacao(calcResult.grupoA, s.minimo_dias || 5, s.valor_minimo_contrato || 0);
                    return (
                      <div className="flex justify-between text-slate-500">
                        <span>Valor mínimo de locação ({diasMinLabel} dias mín.):</span>
                        <span className="font-medium">R$ {valorMinimo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })()}

                  {/* Aviso se mínimo foi aplicado */}
                  {temGrupoA && minimoAplicadoEmAlgum && (
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                      ⚠ Cobrança mínima aplicada ({calcResult.grupoA.find(i => i._minimoAplicado)?._diasMinUsados || s.minimo_dias || 5} dias mínimos)
                    </div>
                  )}
                  {calcResult.descontoInfo && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Desconto ({calcResult.descontoInfo.descricao}):</span>
                      <span>− R$ {calcResult.descontoInfo.valorDesconto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {(contract.frete || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete:</span>
                      <span>R$ {(contract.frete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                    <span>Total:</span>
                    <span>R$ {totalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(contract.valor_pago || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Valor pago:</span>
                      <span>R$ {(contract.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {saldoPagarCorreto > 0 && (
                    <div className="flex justify-between text-destructive font-semibold">
                      <span>Saldo a pagar:</span>
                      <span>R$ {saldoPagarCorreto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Solicitante + Auditoria */}
        {(contract.solicitante_nome || contract.criado_por || contract.created_date || contract.editado_por || contract.assinatura_data) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <ContractAuditCard contract={contract} />

              {/* Assinaturas do motorista */}
              {(contract.assinatura_entrega_url || contract.assinatura_devolucao_url) && (
                <div className="mt-4 pt-4 border-t grid sm:grid-cols-2 gap-4">
                  {contract.assinatura_entrega_url && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-1">✍ Assinatura de Entrega</p>
                      <img src={contract.assinatura_entrega_url} alt="Assinatura entrega" className="max-h-24 border rounded-lg bg-white p-1" />
                      {contract.assinatura_entrega_motorista && (
                        <p className="text-[10px] text-muted-foreground mt-1">Motorista: {contract.assinatura_entrega_motorista}</p>
                      )}
                      {contract.assinatura_entrega_data && (
                        <p className="text-[10px] text-muted-foreground">{new Date(contract.assinatura_entrega_data).toLocaleString("pt-BR")}</p>
                      )}
                    </div>
                  )}
                  {contract.assinatura_devolucao_url && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1">✍ Assinatura de Devolução</p>
                      <img src={contract.assinatura_devolucao_url} alt="Assinatura devolução" className="max-h-24 border rounded-lg bg-white p-1" />
                      {contract.assinatura_devolucao_motorista && (
                        <p className="text-[10px] text-muted-foreground mt-1">Motorista: {contract.assinatura_devolucao_motorista}</p>
                      )}
                      {contract.assinatura_devolucao_data && (
                        <p className="text-[10px] text-muted-foreground">{new Date(contract.assinatura_devolucao_data).toLocaleString("pt-BR")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recibo da última devolução — aparece logo após registrar */}
        {lastDevolucao && (
          <Card className="border-0 shadow-sm border-l-4 border-l-purple-400">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-purple-800">
                  ✅ {lastDevolucao.tipoDevolucao === "total" ? "Devolução Total" : "Devolução Parcial"} registrada
                </p>
                <p className="text-xs text-muted-foreground">Recibo disponível para impressão</p>
              </div>
              <ReciboDevolucaoButton
                doc={contract}
                client={client}
                settings={settings}
                tipo="contrato"
                tipoDevolucao={lastDevolucao.tipoDevolucao}
                itensDevolucao={lastDevolucao.itensDevolucao}
                motorista={lastDevolucao.motorista}
                usuario={lastDevolucao.usuario}
                observacoes={lastDevolucao.observacoes}
                numeroDevolucao={lastDevolucao.numeroDevolucao}
              />
            </CardContent>
          </Card>
        )}

        {/* Histórico de Devoluções com recibos */}
        {historicoDevolucoes.length > 0 && !lastDevolucao && (
          <HistoricoDevolucoes
            historico={historicoDevolucoes}
            doc={contract}
            client={client}
            settings={settings}
            tipo="contrato"
          />
        )}

        {/* Histórico de Trocas */}
        <HistoricoTrocas
          historico={contract?.historico_trocas || []}
          doc={contract}
          client={client}
          settings={settings}
        />

        {/* Histórico de Recolhas */}
        {contract.historico_recolhas?.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <History className="w-4 h-4" /> Histórico de Recolhas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.historico_recolhas.map((rec, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted/40 border text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{rec.tipo === "parcial" ? "🔄 Recolha Parcial" : "📦 Recolha Total"}</span>
                    <span className="text-xs text-muted-foreground">{rec.data}</span>
                  </div>
                  {rec.tipo === "cancelamento" && rec.motivo && (
                    <p className="text-xs text-red-700 font-medium">Motivo: {rec.motivo}</p>
                  )}
                  {rec.motorista && rec.tipo !== "cancelamento" && <p className="text-xs text-muted-foreground">Motorista: {rec.motorista}</p>}
                  {rec.itens?.length > 0 && rec.tipo !== "cancelamento" && (
                    <ul className="text-xs space-y-0.5 mt-1">
                      {rec.itens.map((it, j) => (
                        <li key={j} className="flex justify-between">
                          <span>{it.nome}</span>
                          <span className="font-medium">{it.quantidade} un.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rec.observacao && rec.tipo !== "cancelamento" && <p className="text-xs text-muted-foreground italic">{rec.observacao}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Registro Fotográfico */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Images className="w-4 h-4 text-blue-500" /> Registro Fotográfico
              {(contract.fotos || []).length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground font-normal">{(contract.fotos || []).length} foto(s)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Fotos de Entrega */}
            {(() => {
              const fotosEntrega = (contract.fotos || []).filter(f => f.tipo === "entrega");
              const fotosOutras = (contract.fotos || []).filter(f => !f.tipo);
              return (
                <>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">📷 Fotos de Entrega
                      {fotosEntrega.length > 0 && <span className="ml-1 text-blue-500 font-normal">({fotosEntrega.length})</span>}
                    </p>
                    <PhotoGallery
                      photos={fotosEntrega}
                      currentUser={currentUser}
                      canDelete={isOperador}
                      onAdd={async (newPhotos) => {
                        const fotosRecolha = (contract.fotos || []).filter(f => f.tipo === "recolha");
                        const outrasExistentes = (contract.fotos || []).filter(f => !f.tipo);
                        const tagged = newPhotos.map(p => p.tipo ? p : { ...p, tipo: "entrega" });
                        await base44.entities.Contract.update(contractId, { fotos: [...outrasExistentes, ...tagged, ...fotosRecolha] });
                        load();
                      }}
                      onRemove={async (idx) => {
                        const allFotos = contract.fotos || [];
                        const urlToRemove = fotosEntrega[idx]?.url;
                        const updated = allFotos.filter(f => f.url !== urlToRemove);
                        await base44.entities.Contract.update(contractId, { fotos: updated });
                        load();
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">📷 Fotos de Recolha
                      {(() => { const fr = (contract.fotos || []).filter(f => f.tipo === "recolha"); return fr.length > 0 ? <span className="ml-1 text-amber-500 font-normal">({fr.length})</span> : null; })()}
                    </p>
                    <PhotoGallery
                      photos={(contract.fotos || []).filter(f => f.tipo === "recolha")}
                      currentUser={currentUser}
                      canDelete={isOperador}
                      onAdd={async (newPhotos) => {
                        const fotosEntregaExist = (contract.fotos || []).filter(f => f.tipo === "entrega");
                        const outrasExistentes = (contract.fotos || []).filter(f => !f.tipo);
                        const tagged = newPhotos.map(p => p.tipo ? p : { ...p, tipo: "recolha" });
                        await base44.entities.Contract.update(contractId, { fotos: [...outrasExistentes, ...fotosEntregaExist, ...tagged] });
                        load();
                      }}
                      onRemove={async (idx) => {
                        const fotosRecolha = (contract.fotos || []).filter(f => f.tipo === "recolha");
                        const urlToRemove = fotosRecolha[idx]?.url;
                        const updated = (contract.fotos || []).filter(f => f.url !== urlToRemove);
                        await base44.entities.Contract.update(contractId, { fotos: updated });
                        load();
                      }}
                    />
                  </div>
                  {fotosOutras.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">📁 Outras fotos ({fotosOutras.length})</p>
                      <PhotoGallery
                        photos={fotosOutras}
                        currentUser={currentUser}
                        canDelete={isOperador}
                        onAdd={async (newPhotos) => {
                          const fotosTyped = (contract.fotos || []).filter(f => f.tipo);
                          await base44.entities.Contract.update(contractId, { fotos: [...fotosTyped, ...newPhotos] });
                          load();
                        }}
                        onRemove={async (idx) => {
                          const urlToRemove = fotosOutras[idx]?.url;
                          const updated = (contract.fotos || []).filter(f => f.url !== urlToRemove);
                          await base44.entities.Contract.update(contractId, { fotos: updated });
                          load();
                        }}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Observação de Devolução */}
        {contract.observacao_devolucao && (
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1">Observação de Devolução</p>
              <p className="text-sm">{contract.observacao_devolucao}</p>
            </CardContent>
          </Card>
        )}

        {/* Logistics Actions */}
        {!isClosed && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Ações Logísticas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {contract.status === "rascunho" && (
                <div className="flex flex-col gap-1">
                  <Button onClick={() => updateStatus("em_transito")} className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={!contract.motorista_entrega}>
                    <Truck className="w-4 h-4" /> Saída / Em Trânsito
                  </Button>
                  {!contract.motorista_entrega && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">⚠ Atribua um motorista no quadro logístico antes de enviar</p>
                  )}
                </div>
              )}
              {contract.status === "em_transito" && (
                <Button onClick={() => updateStatus("na_obra")} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Entrega
                </Button>
              )}
              {["na_obra", "devolvido_parcial", "aguardando_recolha"].includes(contract.status) && (
                <>
                  {/* Se há recolha parcial pendente (aguardando motorista confirmar no campo) */}
                  {contract.status === "aguardando_recolha" && contract.recolha_parcial_pendente && (
                    <div className="w-full p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">🔄 Recolha Parcial Aguardando Confirmação</p>
                      {(contract.recolha_parcial_itens || []).map((r, i) => {
                        const item = contract.itens?.[r.idx];
                        return (
                          <div key={i} className="flex justify-between text-xs text-blue-700">
                            <span>{item?.equipamento_nome || "Item"}</span>
                            <span className="font-semibold">{r.quantidade} un.</span>
                          </div>
                        );
                      })}
                      <Button onClick={handleConfirmarRecolhaParcial} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-sm">
                        <CheckCircle2 className="w-4 h-4" /> Confirmar Recolha Parcial
                      </Button>
                    </div>
                  )}
                  {/* Recolha total pendente */}
                  {contract.status === "aguardando_recolha" && !contract.recolha_parcial_pendente && !isMotorista && (
                    <Button onClick={() => setReturnDialog(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                      <PackageCheck className="w-4 h-4" /> Registrar Devolução Total
                    </Button>
                  )}
                  {/* Ações quando na obra ou devolvido parcial */}
                  {["na_obra", "devolvido_parcial"].includes(contract.status) && !isMotorista && (
                    <Button onClick={openRecolhaDialog} variant="outline" className="gap-2">
                      <HandMetal className="w-4 h-4" /> Solicitar Recolha
                    </Button>
                  )}
                  {["na_obra", "devolvido_parcial"].includes(contract.status) && !isMotorista && (
                    <Button onClick={openPartialReturn} variant="outline" className="gap-2">
                      <RotateCcw className="w-4 h-4" /> Devolução Parcial
                    </Button>
                  )}
                  {["na_obra", "devolvido_parcial"].includes(contract.status) && !isMotorista && (
                    <Button onClick={() => setReturnDialog(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                      <PackageCheck className="w-4 h-4" /> Registrar Devolução
                    </Button>
                  )}
                  {/* Nova solicitação de recolha quando aguardando (total) */}
                  {contract.status === "aguardando_recolha" && !contract.recolha_parcial_pendente && !isMotorista && (
                    <Button onClick={openRecolhaDialog} variant="outline" className="gap-2">
                      <HandMetal className="w-4 h-4" /> Nova Recolha
                    </Button>
                  )}
                  {/* Cancelar Recolha */}
                  {contract.status === "aguardando_recolha" && !isMotorista && (
                    <Button onClick={() => setCancelRecolhaDialog(true)} variant="outline" className="gap-2 border-red-300 text-red-700 hover:bg-red-50">
                      <XCircle className="w-4 h-4" /> Cancelar Recolha
                    </Button>
                  )}
                </>
              )}
              <Button onClick={renewContract} variant="outline" className="gap-2">
                <RefreshCcw className="w-4 h-4" /> Renovar Contrato
              </Button>
              <Button onClick={() => setTrocaDialog(true)} variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"><ArrowLeftRight className="w-4 h-4" /> Troca de Equipamento</Button>
            </CardContent>
          </Card>
        )}

        {/* Financial Actions */}
        {contract.status_financeiro !== "pago" && contract.status !== "cancelado" && (
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-400">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2 text-emerald-700">
                <DollarSign className="w-4 h-4" /> Ações Financeiras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BillingRestartInfo contract={contract} />
              <div className="flex flex-wrap gap-2">
                {pendingPaymentReqs.length > 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>⏳ Pagamento já enviado para aprovação financeira. Aguardando confirmação.</span>
                  </div>
                ) : (
                  <Button onClick={() => setPayDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="w-4 h-4" /> Confirmar Pagamento
                  </Button>
                )}
                {client?.telefone1 && whatsappDebt && (
                  <WhatsAppButton phone={client.telefone1} message={whatsappDebt} />
                )}
                {lastPayment && (
                  <SaleReciboButton
                    contract={contract}
                    client={client}
                    settings={settings}
                    pagamento={lastPayment}
                  />
                )}
              </div>
              {/* Recibo de pagamentos já registrados — sempre visível se há valor pago */}
              {!lastPayment && (contract?.valor_pago || 0) > 0 && (
                <SaleReciboButton
                  contract={contract}
                  client={client}
                  settings={settings}
                  pagamento={{
                    valorPago: contract.valor_pago || 0,
                    formaPagamento: contract.forma_pagamento || "—",
                    dataPagamento: "",
                    responsavel: "",
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Export + Assinatura */}
        <div className="flex flex-wrap gap-2 pb-4">
          <Button onClick={generatePDF} variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" /> Gerar PDF
          </Button>
          {contract.status_financeiro === "pago" && (
            <Button onClick={generateQuitadoPDF} variant="outline" className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
              <FileDown className="w-4 h-4" /> Gerar PDF Quitado
            </Button>
          )}
          <Button onClick={handleSignAndExport} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
            <PenLine className="w-4 h-4" /> Assinar e Exportar PDF
          </Button>
          {client?.telefone1 && (
            <Button onClick={() => setWhatsDialog(true)} variant="outline" className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
              <MessageSquare className="w-4 h-4" /> Enviar WhatsApp
            </Button>
          )}
          {signatureDataUrl && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
              ✓ Assinado
            </span>
          )}
        </div>

        {!isClosed && (
          <div className="pb-8 flex flex-wrap items-center gap-4">
            <button onClick={() => setCancelDialog(true)} className="text-xs text-destructive hover:underline flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Cancelar contrato</button>
            {isAdmin && <Button onClick={() => setAlterarStatusDialog(true)} variant="outline" size="sm" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"><ShieldAlert className="w-3.5 h-3.5" /> Correção Operacional</Button>}
          </div>
        )}
        {isEncerrado && isAdmin && <div className="pb-4"><Button onClick={() => setAlterarStatusDialog(true)} variant="outline" size="sm" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"><ShieldAlert className="w-3.5 h-3.5" /> Correção Operacional</Button></div>}
      </div>
        </TabsContent>
      </Tabs>

      {/* Logistic Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Registrar Devolução do Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Os equipamentos serão marcados como <strong>Disponível</strong> no inventário imediatamente.</p>
            {(contract?.saldo_pagar || 0) > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                ⚠ Há saldo devedor de <strong>R$ {(contract.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>. O contrato ficará como <em>Devolvido - Pendente de Pagamento</em> até a baixa financeira.
              </div>
            )}
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea value={returnObs} onChange={(e) => setReturnObs(e.target.value)} rows={3} placeholder="Ex: Todo material retornou em bom estado..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(false)}>Cancelar</Button>
            <Button onClick={handleLogisticReturn} className="bg-purple-600 hover:bg-purple-700">Confirmar Devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onOpenChange={(open) => { setPayDialog(open); if (!open) { setPayValor(""); setPayDesconto(""); setPayValorRecebido(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const saldoAtual = saldoPagarCorreto || contract?.saldo_pagar || 0;
              const descontoNum = parseFloat(payDesconto) || 0;
              const descontoAplicado = payDescontoTipo === "percentual"
                ? (saldoAtual * descontoNum / 100)
                : descontoNum;
              const valorFinal = Math.max(0, saldoAtual - descontoAplicado);
              const valorPago = parseFloat(payValor) || 0;
              const troco = payForma === "dinheiro" ? Math.max(0, valorPago - valorFinal) : 0;
              const novoSaldo = Math.max(0, valorFinal - valorPago);
              return (
                <>
                  <div className="p-3 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">Saldo em aberto</p>
                    <p className="text-xl font-bold text-destructive">R$ {saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>

                  {/* Desconto */}
                  <div>
                    <Label className="text-xs">Desconto (opcional)</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        <button type="button" onClick={() => setPayDescontoTipo("reais")} className={`px-3 py-1.5 font-medium ${payDescontoTipo === "reais" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>R$</button>
                        <button type="button" onClick={() => setPayDescontoTipo("percentual")} className={`px-3 py-1.5 font-medium ${payDescontoTipo === "percentual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>%</button>
                      </div>
                      <Input type="number" step="0.01" value={payDesconto} onChange={(e) => setPayDesconto(e.target.value)} placeholder="0,00" className="flex-1" />
                    </div>
                    {descontoAplicado > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">Desconto: − R$ {descontoAplicado.toFixed(2)} → Valor final: R$ {valorFinal.toFixed(2)}</p>
                    )}
                  </div>

                  {/* Valor recebido */}
                  <div>
                    <Label className="text-xs">Valor Recebido (R$)</Label>
                    <Input type="number" value={payValor} onChange={(e) => setPayValor(e.target.value)} placeholder={valorFinal.toFixed(2)} className="mt-1" />
                  </div>

                  {/* Forma de pagamento */}
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {["pix","dinheiro","cartao","transferencia","boleto"].map(f => (
                        <button key={f} type="button" onClick={() => setPayForma(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            payForma === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
                          }`}>
                          {f === "pix" ? "PIX" : f === "cartao" ? "Cartão" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comprovante (PIX / Transferência) */}
                  {["pix", "transferencia"].includes(payForma) && (
                    <div>
                      <Label className="text-xs">Comprovante (opcional)</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all ${payComprovanteUrl ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-dashed border-border hover:border-primary/50"}`}>
                          <Paperclip className="w-3.5 h-3.5" />
                          {payComprovanteLoading ? "Enviando..." : payComprovanteUrl ? "Comprovante anexado ✓" : "Anexar imagem/PDF"}
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files[0] && handleUploadComprovante(e.target.files[0])} />
                        </label>
                        {payComprovanteUrl && (
                          <button type="button" onClick={() => setPayComprovanteUrl("")} className="text-xs text-destructive hover:underline">Remover</button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Resumo */}
                  {valorPago > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor final:</span>
                        <span className="font-medium">R$ {valorFinal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recebido:</span>
                        <span className="font-medium">R$ {valorPago.toFixed(2)}</span>
                      </div>
                      {troco > 0 && (
                        <div className="flex justify-between font-bold text-emerald-700 border-t border-emerald-200 pt-1 mt-1">
                          <span>Troco:</span>
                          <span>R$ {troco.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1">
                        <span className="text-muted-foreground">Saldo restante:</span>
                        <span className={`font-bold ${novoSaldo === 0 ? "text-emerald-700" : "text-destructive"}`}>
                          R$ {novoSaldo.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            ⏳ O pagamento será enviado para <strong>aprovação financeira</strong> antes de ser lançado no caixa.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>Cancelar</Button>
            <Button onClick={confirmPayment} className="bg-emerald-600 hover:bg-emerald-700">Enviar para Aprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recolha Dialog */}
      <Dialog open={recolhaDialog} onOpenChange={setRecolhaDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <HandMetal className="w-4 h-4" /> Solicitar Recolha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tipo de recolha */}
            <div>
              <Label className="text-xs font-semibold">Tipo de Recolha</Label>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setRecolhaTipo("total")}
                  className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${recolhaTipo === "total" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border hover:border-amber-300"}`}
                >
                  <PackageCheck className="w-4 h-4 mx-auto mb-1" />
                  Recolha Total
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">Recolher todos os equipamentos</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRecolhaTipo("parcial")}
                  className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${recolhaTipo === "parcial" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-border hover:border-blue-300"}`}
                >
                  <RotateCcw className="w-4 h-4 mx-auto mb-1" />
                  Recolha Parcial
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">Selecionar itens a recolher</p>
                </button>
              </div>
            </div>

            {/* Itens para recolha parcial */}
            {recolhaTipo === "parcial" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Selecione os itens e quantidades:</Label>
                {(contract?.itens || []).map((item, idx) => {
                  const emAberto = (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0);
                  if (emAberto <= 0) return null;
                  const rItem = recolhaItens.find((r) => r.idx === idx);
                  const qtd = rItem?.quantidade || 0;
                  const restante = emAberto - qtd;
                  return (
                    <div key={idx} className="p-3 rounded-xl bg-muted/50 border space-y-2">
                      <p className="text-sm font-medium">{item.equipamento_nome || "Equipamento"}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block font-semibold text-foreground">{item.quantidade_retirada || 0}</span>
                          Contratado
                        </div>
                        <div>
                          <span className="block font-semibold text-amber-700">{qtd}</span>
                          Recolher agora
                        </div>
                        <div>
                          <span className={`block font-semibold ${restante > 0 ? "text-blue-700" : "text-emerald-700"}`}>{restante}</span>
                          Restante na obra
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRecolhaItens((prev) => prev.map((r) => r.idx === idx ? { ...r, quantidade: Math.max(0, r.quantidade - 1) } : r))}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-background font-bold"
                        >−</button>
                        <span className="w-10 text-center font-semibold text-sm">{qtd}</span>
                        <button
                          type="button"
                          onClick={() => setRecolhaItens((prev) => prev.map((r) => r.idx === idx ? { ...r, quantidade: Math.min(emAberto, r.quantidade + 1) } : r))}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-background font-bold"
                        >+</button>
                        <button
                          type="button"
                          onClick={() => setRecolhaItens((prev) => prev.map((r) => r.idx === idx ? { ...r, quantidade: emAberto } : r))}
                          className="text-xs text-primary hover:underline ml-1"
                        >Todos</button>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const total = recolhaItens.reduce((s, r) => s + r.quantidade, 0);
                  const maxTotal = (contract?.itens || []).reduce((s, item) => s + Math.max(0, (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0)), 0);
                  if (total === maxTotal && maxTotal > 0) {
                    return <p className="text-xs text-emerald-600 font-medium">✓ Todos os itens serão recolhidos — contrato será encerrado.</p>;
                  }
                  if (total > 0) {
                    return <p className="text-xs text-blue-600 font-medium">ℹ Recolha parcial — contrato continuará ativo com itens restantes na obra.</p>;
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Data de Recolha */}
            <div>
              <Label className="text-xs">Data Prevista de Recolha <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="date" className="mt-1" value={recolhaData} onChange={(e) => setRecolhaData(e.target.value)} />
              {recolhaData && <p className="text-xs text-amber-700 mt-0.5">A recolha aparecerá no calendário nesta data.</p>}
            </div>
            {/* Motorista */}
            <div>
              <Label className="text-xs">Motorista de Recolha <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={recolhaMotorista} onValueChange={setRecolhaMotorista}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Definir depois pela logística..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}{d.veiculo ? ` — ${d.veiculo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!recolhaMotorista && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                <HandMetal className="w-3.5 h-3.5 shrink-0" />
                Motorista ficará como <strong>"A definir"</strong> até ser atribuído pela logística
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecolhaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSolicitarRecolha} className="bg-amber-600 hover:bg-amber-700">Confirmar Recolha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancelar Contrato #{contract?.numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Esta ação irá cancelar o contrato, liberar o estoque dos equipamentos e registrar o motivo no log de auditoria.</p>
            <div>
              <Label className="text-xs">Motivo do Cancelamento *</Label>
              <Textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Voltar</Button>
            <Button onClick={handleCancel} variant="destructive" className="gap-2">
              <XCircle className="w-4 h-4" /> Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Edit Dialog */}
      <Dialog open={unlockDialog} onOpenChange={setUnlockDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading text-amber-700 flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Desbloquear Edição — Admin</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Contrato assinado. Qualquer edição será registrada no log.</p>
            <div><Label className="text-xs">Motivo obrigatório *</Label><Textarea value={unlockMotivo} onChange={(e) => setUnlockMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo..." className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialog(false)}>Cancelar</Button>
            <Button onClick={handleUnlockEdit} className="bg-amber-600 hover:bg-amber-700 gap-2"><ShieldAlert className="w-4 h-4" /> Confirmar e Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar Recolha Dialog */}
      <Dialog open={cancelRecolhaDialog} onOpenChange={setCancelRecolhaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading text-destructive flex items-center gap-2"><XCircle className="w-5 h-5" /> Cancelar Solicitação de Recolha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">A recolha será cancelada e o contrato voltará para <strong>"Na Obra"</strong>. Histórico preservado.</p>
            <div><Label className="text-xs">Motivo *</Label><Textarea value={cancelRecolhaMotivo} onChange={(e) => setCancelRecolhaMotivo(e.target.value)} rows={3} placeholder="Ex: cliente desistiu, obra continua, reagendamento..." className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelRecolhaDialog(false)}>Voltar</Button>
            <Button onClick={handleCancelarRecolha} variant="destructive" className="gap-2"><XCircle className="w-4 h-4" /> Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Troca de Equipamento Dialog */}
      <TrocaEquipamentoDialog
        open={trocaDialog}
        onClose={() => setTrocaDialog(false)}
        doc={contract}
        docTipo="contrato"
        client={client}
        settings={settings}
        currentUser={currentUser}
        onSaved={load}
      />

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureDialog}
        onOpenChange={setSignatureDialog}
        onConfirm={onSignatureConfirmed}
        title={`Assinatura — Contrato Nº ${contract?.numero || ""}`}
      />

      {/* WhatsApp Send Dialog */}
      <WhatsAppSendDialog
        open={whatsDialog}
        onOpenChange={setWhatsDialog}
        phone={client?.telefone1}
        clientNome={contract?.client_nome}
        docTipo="contrato"
        docNumero={contract?.numero}
        docId={contractId}
        valorTotal={contract?.valor_total}
        valorPago={contract?.valor_pago}
        statusFinanceiro={contract?.status_financeiro}
        formaPagamento={contract?.forma_pagamento}
        settings={settings}
        onGeneratePDF={handleGeneratePDFForDialog}
        currentUser={currentUser}
      />

      <AlterarStatusDialog open={alterarStatusDialog} onClose={() => setAlterarStatusDialog(false)} doc={contract} docTipo="contrato" currentUser={currentUser} onSaved={load} />
      {/* Partial Return Dialog */}
      <Dialog open={devDialog} onOpenChange={setDevDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Devolução Parcial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe a quantidade a devolver por item:</p>
            <div className="space-y-3">
              {(contract?.itens || []).map((item, idx) => {
                const emAberto = (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0);
                if (emAberto <= 0) return null;
                const devItem = devItens.find((d) => d.idx === idx);
                const qtd = devItem?.quantidade || 0;
                const temControleIndividual = item.controle_individual && (item.seriais_selecionados || []).length > 0;
                return (
                  <div key={idx} className="p-3 rounded-xl bg-muted/50 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.equipamento_nome || "Equipamento"}</p>
                        <p className="text-xs text-muted-foreground">Em aberto: {emAberto} unid.</p>
                      </div>
                      {!temControleIndividual && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setDevItens((prev) => prev.map((d) => d.idx === idx ? { ...d, quantidade: Math.max(0, d.quantidade - 1) } : d))}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-background font-bold text-lg"
                          >−</button>
                          <span className="w-8 text-center font-semibold text-sm">{qtd}</span>
                          <button
                            type="button"
                            onClick={() => setDevItens((prev) => prev.map((d) => d.idx === idx ? { ...d, quantidade: Math.min(emAberto, d.quantidade + 1) } : d))}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-background font-bold text-lg"
                          >+</button>
                        </div>
                      )}
                    </div>
                    {/* Seleção de seriais para devolução */}
                    {temControleIndividual && (() => {
                      const serialsAtivos = (item.seriais_selecionados || []).filter(s => {
                        const devolvidos = (contract.historico_recolhas || []).flatMap(h =>
                          (h.itens || []).filter(it => it.idx === idx).flatMap(it => it.seriais_devolvidos || [])
                        );
                        return !devolvidos.includes(s);
                      });
                      const numsMock = serialsAtivos.map(s => ({ serial: s, status: "alugado" }));
                      const selecionados = devItem?.seriais_devolvidos || [];
                      return (
                        <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-200 space-y-2">
                          <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                            <ScanBarcode className="w-3.5 h-3.5" /> Seriais que retornam
                          </p>
                          <SerialSelector
                            numeracoes={numsMock}
                            selected={selecionados}
                            onChange={(v) => setDevItens(prev => prev.map(d =>
                              d.idx === idx ? { ...d, seriais_devolvidos: v, quantidade: v.length } : d
                            ))}
                            max={serialsAtivos.length}
                          />
                          {selecionados.length > 0 && (
                            <p className="text-[10px] text-emerald-600">{selecionados.length} serial(is) serão marcados como disponível.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea value={devObs} onChange={(e) => setDevObs(e.target.value)} rows={2} placeholder="Ex: Materiais em bom estado..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevDialog(false)}>Cancelar</Button>
            <Button onClick={handlePartialReturn} className="bg-amber-600 hover:bg-amber-700">Confirmar Devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}