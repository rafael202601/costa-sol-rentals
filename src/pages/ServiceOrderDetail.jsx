import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import WhatsAppButton from "../components/WhatsAppButton";
import DriverSelect from "../components/DriverSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Pencil, Truck, CheckCircle2, DollarSign, FileDown,
  MapPin, User, Calendar, Package, PenLine, Lock, ShieldAlert, Upload, X, MessageSquare, XCircle, Clock, Images, ArrowLeftRight
} from "lucide-react";
import PhotoGallery from "../components/PhotoGallery";
import { OpenLocationButton } from "../components/LocationField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { showError } from "../lib/errorHandler";
import { usePermissions } from "@/lib/usePermissions";
import { generateOsPDF } from "../lib/generateOsPDF";
import { generateOsQuitadoPDF } from "../lib/generateQuitadoPDF";
import WhatsAppSendDialog from "../components/WhatsAppSendDialog";
import SignatureDialog from "../components/SignatureDialog";
import ReciboDevolucaoButton from "../components/devolucao/ReciboDevolucaoButton";
import HistoricoDevolucoes from "../components/devolucao/HistoricoDevolucoes";
import TrocaEquipamentoDialog from "../components/troca/TrocaEquipamentoDialog";
import HistoricoTrocas from "../components/troca/HistoricoTrocas";
import AlterarStatusDialog from "../components/operacional/AlterarStatusDialog";
import { releaseEquipmentSerials } from "../lib/releaseEquipmentSerials";

const FORMAS_PGTO = [
  { key: "dinheiro", label: "Dinheiro" }, { key: "pix", label: "PIX" },
  { key: "cartao_debito", label: "Cartão Débito" }, { key: "cartao_credito", label: "Cartão Crédito" },
  { key: "transferencia", label: "Transferência" }, { key: "boleto", label: "Boleto" },
];

export default function ServiceOrderDetail() {
  const navigate = useNavigate();
  const { id: osId } = useParams();
  const { can, user: permUser, isAdmin: permIsAdmin } = usePermissions();

  const [order, setOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingPaymentReqs, setPendingPaymentReqs] = useState([]);
  const [signatureDialog, setSignatureDialog] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [unlockDialog, setUnlockDialog] = useState(false);
  const [unlockMotivo, setUnlockMotivo] = useState("");

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [payForm, setPayForm] = useState({
    valor: "", desconto: "", desconto_tipo: "reais",
    forma_pagamento: "pix", comprovante_url: "", observacoes: "",
  });
  const [uploadingComp, setUploadingComp] = useState(false);

  // Dialogs de recolha — 2 etapas separadas
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  // ETAPA 1: Solicitar Recolha
  const [solicitarDialog, setSolicitarDialog] = useState(false);
  const [solicitarQtd, setSolicitarQtd] = useState(1);
  const [solicitarMotorista, setSolicitarMotorista] = useState("");
  const [solicitarVeiculo, setSolicitarVeiculo] = useState("");
  const [solicitarDataTipo, setSolicitarDataTipo] = useState("especifico");
  const [solicitarData, setSolicitarData] = useState("");
  const [solicitarPeriodo, setSolicitarPeriodo] = useState("");
  const [solicitarObs, setSolicitarObs] = useState("");
  // ETAPA 2: Confirmar Recolha
  const [confirmarDialog, setConfirmarDialog] = useState(false);
  const [confirmarQtd, setConfirmarQtd] = useState(1);
  const [confirmarMotorista, setConfirmarMotorista] = useState("");
  const [confirmarVeiculo, setConfirmarVeiculo] = useState("");
  const [confirmarData, setConfirmarData] = useState("");
  const [confirmarObs, setConfirmarObs] = useState("");
  const [lastDevolucaoOS, setLastDevolucaoOS] = useState(null);
  const [historicoDevolucoes, setHistoricoDevolucoes] = useState([]);
  const [trocaDialog, setTrocaDialog] = useState(false);
  const [cancelRecolhaDialog, setCancelRecolhaDialog] = useState(false);
  const [cancelRecolhaMotivo, setCancelRecolhaMotivo] = useState("");
  const [alterarStatusDialog, setAlterarStatusDialog] = useState(false);

  // legado
  const [recolhaDialog, setRecolhaDialog] = useState(false);
  const [whatsDialog, setWhatsDialog] = useState(false);
  const [osSettings, setOsSettings] = useState(null);
  const [dataRecolha, setDataRecolha] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [obsRecolha, setObsRecolha] = useState("");
  const [qtdRecolhaParcial, setQtdRecolhaParcial] = useState(1);

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); }).catch(() => {});
    base44.entities.CompanySettings.list().then((l) => setOsSettings(l[0] || null));
    base44.entities.Vehicle.filter({ status: "ativo" }).then(setVehicles).catch(() => {});
  }, []);

  const load = async () => {
    // Tenta buscar por filter primeiro, fallback para list completo (compatibilidade com IDs migrados)
    let o = null;
    try {
      const res = await base44.entities.ServiceOrder.filter({ id: osId });
      o = res?.[0] || null;
    } catch {
      // ignore
    }
    // Se não encontrou, tenta buscar diretamente via list e localiza pelo id
    if (!o) {
      try {
        const all = await base44.entities.ServiceOrder.list("-created_date", 2000);
        o = all.find(x => x.id === osId) || null;
      } catch {
        // ignore
      }
    }

    if (!o) {
      setLoading(false);
      return;
    }

    setOrder(o);
    setHistoricoDevolucoes(o?.historico_devolucoes || []);

    // Carrega solicitações pendentes para esta OS
    try {
      const allReqs = await base44.entities.PaymentRequest.list("-created_date", 50);
      const pendentes = allReqs.filter(r =>
        r.status === "aguardando_confirmacao" &&
        (r.itens || []).some(i => i.id === osId || i.numero === o?.numero)
      );
      setPendingPaymentReqs(pendentes);
    } catch {
      // ignore
    }

    // ✅ Inicializa signatureDataUrl com assinatura já salva (prioridade: cliente > motorista)
    if (o?.assinatura_cliente) {
      setSignatureDataUrl(o.assinatura_cliente);
    } else if (o?.assinatura_entrega_url) {
      setSignatureDataUrl(o.assinatura_entrega_url);
    }

    // Busca cliente: tenta por client_id, depois por codigo_cliente, depois por client_nome
    let cl = null;
    if (o?.client_id) {
      try {
        const res = await base44.entities.Client.filter({ id: o.client_id });
        cl = res?.[0] || null;
      } catch { /* ignore */ }
    }
    // Fallback: busca por codigo_cliente se tiver
    if (!cl && (o?.codigo_cliente || o?.client_codigo)) {
      try {
        const codigo = o.codigo_cliente || o.client_codigo;
        const res = await base44.entities.Client.filter({ codigo_cliente: codigo });
        cl = res?.[0] || null;
        // Se encontrou, atualiza client_id na OS para corrigir relacionamento
        if (cl) {
          await base44.entities.ServiceOrder.update(osId, {
            client_id: cl.id,
            client_nome: cl.nome_razao_social || o.client_nome || cl.fantasia,
          });
        }
      } catch { /* ignore */ }
    }
    // Fallback 2: busca por nome do cliente
    if (!cl && o?.client_nome) {
      try {
        const allClients = await base44.entities.Client.list("-created_date", 500);
        cl = allClients.find(c =>
          c.nome_razao_social?.toLowerCase() === o.client_nome?.toLowerCase() ||
          c.fantasia?.toLowerCase() === o.client_nome?.toLowerCase()
        ) || null;
        if (cl && !o.client_id) {
          await base44.entities.ServiceOrder.update(osId, { client_id: cl.id });
        }
      } catch { /* ignore */ }
    }
    setClient(cl);
    setLoading(false);
  };

  useEffect(() => { load(); }, [osId]);

  const updateStatus = async (status, extra = {}) => {
    try {
      await base44.entities.ServiceOrder.update(osId, { status, ...extra });
      toast.success("Status atualizado!");
      load();
    } catch (err) {
      showError(err, "OS", "Não foi possível atualizar o status");
    }
  };

  // Igual ao contrato: envia para PaymentRequest
  const handleSolicitarPagamento = async () => {
    if (!payForm.valor) { toast.error("Informe o valor"); return; }
    const valorBruto = parseFloat(payForm.valor) || 0;
    const descontoVal = parseFloat(payForm.desconto) || 0;
    const valorDesconto = payForm.desconto_tipo === "percentual"
      ? (valorBruto * descontoVal) / 100
      : descontoVal;
    const valorFinal = Math.max(0, valorBruto - valorDesconto);

    try {
    await base44.entities.PaymentRequest.create({
      client_id: order.client_id,
      client_nome: order.client_nome,
      itens: [{
        tipo: "os",
        numero: order.numero || osId,
        id: osId,
        descricao: `OS #${order.numero || osId} — ${order.client_nome}`,
        valor_original: valorBruto,
        desconto: valorDesconto,
        valor_final: valorFinal,
        valor: valorFinal,
        forma_pagamento: payForm.forma_pagamento,
      }],
      valor_total: valorFinal,
      data: format(new Date(), "yyyy-MM-dd"),
      comprovante_url: payForm.comprovante_url || "",
      observacoes: payForm.observacoes || "",
      registrado_por: currentUser?.email || "",
      status: "aguardando_confirmacao",
    });
    toast.success("Solicitação de pagamento enviada para o financeiro!");
    setPaymentDialog(false);
    setPayForm({ valor: "", desconto: "", desconto_tipo: "reais", forma_pagamento: "pix", comprovante_url: "", observacoes: "" });
    } catch (err) {
      showError(err, "pagamento", "Não foi possível registrar o pagamento");
    }
  };

  const handleUploadComprovante = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingComp(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPayForm((p) => ({ ...p, comprovante_url: file_url }));
    setUploadingComp(false);
    toast.success("Comprovante anexado!");
  };

  const handleCancelarRecolhaOS = async () => {
    if (!cancelRecolhaMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    const historicoCancelamento = {
      tipo: "cancelamento",
      data_solicitacao: format(new Date(), "dd/MM/yyyy HH:mm"),
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      quantidade: 0,
      motorista: order.motorista_recolhimento || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: `CANCELADO: ${cancelRecolhaMotivo}`,
      confirmada: false,
      motivo: cancelRecolhaMotivo,
      status: "cancelado",
    };
    const novoHistorico = [...(order.historico_recolhas || []), historicoCancelamento];
    await base44.entities.ServiceOrder.update(osId, {
      status: "entregue",
      historico_recolhas: novoHistorico,
    });
    setCancelRecolhaDialog(false);
    setCancelRecolhaMotivo("");
    toast.success("Solicitação de recolha cancelada. OS voltou para Entregue.");
    load();
  };

  // ETAPA 1 — Registrar SOLICITAÇÃO de recolha (não altera saldo nem estoque)
  const handleSolicitarRecolha = async () => {
    const qtdAtiva = order.quantidade_ativa ?? (order.quantidade_cacambas || 1);
    const qtd = parseInt(solicitarQtd) || 1;
    if (qtd <= 0 || qtd > qtdAtiva) {
      toast.error(`Quantidade inválida. Ativo: ${qtdAtiva} caçamba(s).`);
      return;
    }

    // Monta referência de data/período para a solicitação
    let dataRef = "";
    if (solicitarDataTipo === "especifico" && solicitarData) {
      dataRef = solicitarData;
    } else if (solicitarDataTipo === "periodo" && solicitarData) {
      const periodoLabel = { manha: "Manhã", tarde: "Tarde", noite: "Noite" }[solicitarPeriodo] || solicitarPeriodo;
      dataRef = `${solicitarData.substring(0, 10)} — ${periodoLabel}`;
    }

    const novaSolicitacao = {
      tipo: "solicitacao",
      data_solicitacao: format(new Date(), "dd/MM/yyyy HH:mm"),
      data_prevista: dataRef || "",
      quantidade: qtd,
      motorista: solicitarMotorista || "—",
      veiculo: solicitarVeiculo || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: solicitarObs || "",
      confirmada: false,
    };

    const novoHistorico = [...(order.historico_recolhas || []), novaSolicitacao];

    // Apenas muda status para aguardando_recolha e registra a solicitação — NÃO altera saldo
    await base44.entities.ServiceOrder.update(osId, {
      status: "aguardando_recolha",
      motorista_recolhimento: solicitarMotorista || order.motorista_recolhimento || null,
      historico_recolhas: novoHistorico,
    });

    toast.success(`Solicitação de recolha de ${qtd} caçamba(s) registrada. Aguardando confirmação da recolha física.`);
    setSolicitarDialog(false);
    setSolicitarQtd(1); setSolicitarMotorista(""); setSolicitarVeiculo("");
    setSolicitarData(""); setSolicitarPeriodo(""); setSolicitarObs(""); setSolicitarDataTipo("especifico");
    load();
  };

  // ETAPA 2 — Confirmar que a recolha FÍSICA foi realizada (agora sim baixa saldo/estoque)
  const handleConfirmarRecolha = async () => {
    const qtdAtiva = order.quantidade_ativa ?? (order.quantidade_cacambas || 1);
    const qtd = parseInt(confirmarQtd) || 1;
    if (qtd <= 0 || qtd > qtdAtiva) {
      toast.error(`Quantidade inválida. Ativo: ${qtdAtiva} caçamba(s).`);
      return;
    }

    const novaQtdAtiva = qtdAtiva - qtd;
    const novaQtdRecolhida = (order.quantidade_recolhida || 0) + qtd;
    const isTotal = novaQtdAtiva === 0;

    // Marca a última solicitação pendente como confirmada
    const historicoAtualizado = (order.historico_recolhas || []).map((r, idx, arr) => {
      // Confirma o último item de solicitação não confirmado
      if (!r.confirmada && r.tipo === "solicitacao" && idx === arr.map(x => x.tipo === "solicitacao" && !x.confirmada).lastIndexOf(true)) {
        return { ...r, confirmada: true, data_confirmacao: format(new Date(), "dd/MM/yyyy HH:mm") };
      }
      return r;
    });

    // Adiciona registro de confirmação
    const registroConfirmacao = {
      tipo: "confirmacao",
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      quantidade: qtd,
      motorista: confirmarMotorista || solicitarMotorista || "—",
      veiculo: confirmarVeiculo || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: confirmarObs || "",
    };
    historicoAtualizado.push(registroConfirmacao);

    // Monta registro de devolução para OS
    const itensDevolucaoOS = [{
      nome: order.tipo_cacamba || "Caçamba",
      quantidade: qtd,
      unidade: "un.",
      observacao: confirmarObs || "",
    }];
    const novaDevolucaoOS = {
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      tipo: isTotal ? "total" : "parcial",
      motorista: confirmarMotorista || "—",
      usuario: currentUser?.full_name || currentUser?.email || "—",
      observacao: confirmarObs || "",
      itens: itensDevolucaoOS,
      status: "concluido",
      assinatura_responsavel_url: currentUser?.assinatura_usuario || null,
    };
    const historicoDevOS = [...(order.historico_devolucoes || []), novaDevolucaoOS];

    // Libera estoque + seriais do equipamento da OS
    const equipId = order.cacamba_equipamento_id || (() => {
      // Sem ID direto, não tentamos buscar por nome (risco de match errado)
      return null;
    })();
    if (equipId) {
      await releaseEquipmentSerials(
        [{ equipamento_id: equipId, quantidade: qtd, seriais_devolvidos: [] }],
        {
          osId: osId,
          usuarioNome: currentUser?.full_name || currentUser?.email || "—",
          evento: isTotal ? "Recolha Total (OS)" : "Recolha Parcial (OS)",
        }
      );
    }

    await base44.entities.ServiceOrder.update(osId, {
      status: isTotal ? "recolhida" : "aguardando_recolha",
      quantidade_ativa: novaQtdAtiva,
      quantidade_recolhida: novaQtdRecolhida,
      historico_recolhas: historicoAtualizado,
      historico_devolucoes: historicoDevOS,
      motorista_recolhimento: confirmarMotorista || order.motorista_recolhimento || null,
      data_recolhimento: confirmarData ? new Date(confirmarData).toISOString() : (isTotal ? new Date().toISOString() : order.data_recolhimento || null),
    });

    setLastDevolucaoOS({
      tipoDevolucao: isTotal ? "total" : "parcial",
      itensDevolucao: itensDevolucaoOS,
      motorista: confirmarMotorista || "",
      usuario: currentUser?.full_name || currentUser?.email || "",
      observacoes: confirmarObs || "",
      numeroDevolucao: historicoDevOS.length,
    });
    setHistoricoDevolucoes(historicoDevOS);

    if (isTotal) {
      toast.success("Recolha confirmada! Todas as caçambas foram recolhidas. OS marcada como Recolhida.");
    } else {
      toast.success(`Recolha de ${qtd} caçamba(s) confirmada. Recibo disponível abaixo.`);
    }

    setConfirmarDialog(false);
    setConfirmarQtd(1); setConfirmarMotorista(""); setConfirmarVeiculo(""); setConfirmarData(""); setConfirmarObs("");
    load();
  };

  const handleCancelOS = async () => {
    if (!cancelMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    try {
    // Devolve equipamento ao estoque se a OS estava ativa em campo
    const statusQueTemEquipamento = ["em_transito", "entregue", "aguardando_recolha"];
    if (statusQueTemEquipamento.includes(order.status) && order.cacamba_equipamento_id) {
      const qtdAtiva = order.quantidade_ativa ?? (order.quantidade_cacambas || 1);
      await releaseEquipmentSerials(
        [{ equipamento_id: order.cacamba_equipamento_id, quantidade: qtdAtiva, seriais_devolvidos: [] }],
        {
          osId: osId,
          usuarioNome: currentUser?.full_name || currentUser?.email || "—",
          evento: "Cancelamento de OS",
        }
      );
    }
    await base44.entities.ServiceOrder.update(osId, {
      status: "cancelada",
      status_pagamento: "pendente",
      valor: 0,
      observacoes: (order.observacoes || "") + `\n\nCANCELADA: ${cancelMotivo} — ${currentUser?.full_name || currentUser?.email || "—"} em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    });
    toast.success("OS cancelada e financeiro zerado.");
    setCancelDialog(false);
    setCancelMotivo("");
    load();
    } catch (err) {
      showError(err, "OS", "Não foi possível cancelar a OS");
    }
  };

  const onSignatureConfirmed = async (dataUrl) => {
    setSignatureDataUrl(dataUrl);
    const dataHoraAssinatura = format(new Date(), "dd/MM/yyyy HH:mm");
    await base44.entities.ServiceOrder.update(osId, {
      assinatura_data: dataHoraAssinatura,
      assinatura_cliente: dataUrl,
    });
    const settings = await base44.entities.CompanySettings.list().then((l) => l[0] || null);
    const doc = generateOsPDF({ order: { ...order, assinatura_data: dataHoraAssinatura }, client, settings, signatureDataUrl: dataUrl });
    doc.save(`os_assinada_${order.numero || order.id}.pdf`);
    toast.success("OS assinada e PDF gerado! Edição bloqueada.");
    load();
  };

  // Usa user do usePermissions (carregado junto com permissões, sem race condition)
  const activeUser = permUser || currentUser;
  const isAdmin = permIsAdmin || ["admin", "Admin"].includes(activeUser?.role || "");
  const isAtendente = activeUser?.role === "atendente";
  const isOperacional = activeUser?.role === "operacional";
  const isMotorista = activeUser?.role === "motorista";
  // isOperador: qualquer role não-motorista com permissão de editar OS
  const isOperador = isAdmin || isAtendente || isOperacional || can("os", "editar");
  const isMotoristaEntrega = currentUser?.full_name === order?.motorista_entrega || currentUser?.email === order?.motorista_entrega;
  const isMotoristaRecolha = currentUser?.full_name === order?.motorista_recolhimento || currentUser?.email === order?.motorista_recolhimento;

  const handleUnlockEdit = async () => {
    if (!unlockMotivo.trim()) { toast.error("Informe o motivo para desbloquear a edição"); return; }
    setUnlockDialog(false);
    navigate(`/ordens-servico/editar/${osId}`);
    toast.warning("Edição liberada por Admin.");
  };

  const generatePDF = () => {
    if (!order) return;
    const doc = generateOsPDF({ order, client, settings: osSettings, signatureDataUrl });
    doc.save(`os_${order.numero || order.id}.pdf`);
    toast.success("PDF gerado!");
  };

  const generateQuitadoPDF = () => {
    if (!order) return;
    const doc = generateOsQuitadoPDF({ order, client, settings: osSettings, signatureDataUrl });
    doc.save(`os_quitado_${order.numero || order.id}.pdf`);
    toast.success("PDF Quitado gerado!");
  };

  const handleGeneratePDFForDialog = (tipo) => {
    if (tipo === "quitado") return generateOsQuitadoPDF({ order, client, settings: osSettings, signatureDataUrl });
    return generateOsPDF({ order, client, settings: osSettings, signatureDataUrl });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground font-medium">OS não encontrada ou não acessível.</p>
        <Button variant="outline" onClick={() => navigate("/ordens-servico")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar para Ordens de Serviço
        </Button>
      </div>
    );
  }

  const isCanceled = order.status === "cancelada";
  const isClosed = ["finalizada", "cancelada"].includes(order.status);
  const isSignedLocked = !!order.assinatura_data;
  const whatsappMsg = `Olá ${order.client_nome}, segue a OS nº ${order.numero || ""} da Andaimes Costa do Sol. Local: ${order.local_entrega || ""}.`;

  // Valor calculado no form
  const valorBrutoForm = parseFloat(payForm.valor) || 0;
  const descontoForm = parseFloat(payForm.desconto) || 0;
  const valorDescontoForm = payForm.desconto_tipo === "percentual" ? (valorBrutoForm * descontoForm) / 100 : descontoForm;
  const valorFinalForm = Math.max(0, valorBrutoForm - valorDescontoForm);
  const showComprovante = ["pix", "transferencia"].includes(payForm.forma_pagamento);

  return (
    <div>
      <PageHeader title={`OS #${order.numero || "—"}`} subtitle={order.client_nome + (client?.codigo_cliente ? ` — Cód. ${client.codigo_cliente}` : "")}>
        <Button variant="outline" onClick={() => navigate("/ordens-servico")} className="gap-2">
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
          <Button variant="outline" onClick={() => navigate(`/ordens-servico/editar/${osId}`)} className="gap-2">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        )}
      </PageHeader>

      {isSignedLocked && (
        <div className="max-w-4xl mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Esta OS foi <strong>assinada pelo cliente em {order.assinatura_data}</strong> e está bloqueada para edição.{isAdmin ? " Apenas administradores podem desbloquear." : ""}</span>
        </div>
      )}

      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.status_pagamento || "pendente"} />
          {order.assinatura_data && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
              ✓ Assinado em {order.assinatura_data}
            </span>
          )}
          {order.assinatura_pendente && !order.assinatura_data && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              ⏳ Assinatura Pendente — {order.assinatura_pendente_motorista} em {order.assinatura_pendente_data}
            </span>
          )}
          {order.status === "finalizada" && (order.status_pagamento || "pendente") !== "pago" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
              💰 Cobrança Pendente
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <MapPin className="w-3.5 h-3.5" /> Local
              </div>
              <p className="text-sm font-medium">{order.local_entrega || "—"}</p>
              <OpenLocationButton location={order} className="mt-1.5" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Package className="w-3.5 h-3.5" /> Caçamba
              </div>
              <p className="text-sm font-medium">{order.tipo_cacamba || "—"}</p>
              {(order.quantidade_cacambas || 1) > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{order.quantidade_cacambas || 1} unid.</span>
                  </div>
                  {(order.quantidade_recolhida || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recolhida(s):</span>
                      <span className="font-semibold text-amber-600">{order.quantidade_recolhida || 0} unid.</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ativa(s):</span>
                    <span className="font-semibold text-emerald-600">
                      {order.quantidade_ativa ?? (order.quantidade_cacambas || 1)} unid.
                    </span>
                  </div>
                  {order.valor_unitario > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit.:</span>
                      <span>R$ {(order.valor_unitario).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="w-3.5 h-3.5" /> Valor
              </div>
              <p className="text-xl font-bold font-heading">
                R$ {(order.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              {order.valor_unitario > 0 && (order.quantidade_cacambas || 1) > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {order.quantidade_cacambas}x R$ {order.valor_unitario.toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><User className="w-3 h-3" /> Motorista Entrega</p>
              <p className="text-sm font-medium">{order.motorista_entrega || "—"}</p>
              {order.data_entrega && (
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3" /> ✓ {(() => {
                    try {
                      const d = parseISO(order.data_entrega);
                      return isNaN(d) ? "—" : format(d, "dd/MM/yyyy 'às' HH:mm");
                    } catch { return "—"; }
                  })()}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><User className="w-3 h-3" /> Motorista Recolhimento</p>
              <p className="text-sm font-medium">{order.motorista_recolhimento || "—"}</p>
              {order.data_recolhimento && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3" /> ✓ {(() => {
                    try {
                      const d = parseISO(order.data_recolhimento);
                      return isNaN(d) ? "—" : format(d, "dd/MM/yyyy 'às' HH:mm");
                    } catch { return "—"; }
                  })()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions — igual ao contrato */}
        {!isClosed && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Ações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {order.status === "pendente" && (
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={() => updateStatus("em_transito", { data_entrega: new Date().toISOString() })}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={!order.motorista_entrega}
                  >
                    <Truck className="w-4 h-4" /> Enviar para Entrega
                  </Button>
                  {!order.motorista_entrega && (
                    <p className="text-xs text-amber-600">⚠ Atribua um motorista no quadro logístico antes de enviar</p>
                  )}
                </div>
              )}
              {order.status === "em_transito" && (isOperador || isMotoristaEntrega) && (
                <Button
                  onClick={() => updateStatus("entregue", { data_entrega: new Date().toISOString() })}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Entrega
                </Button>
              )}
              {/* ETAPA 1 — Solicitar Recolha (disponível quando entregue) */}
              {order.status === "entregue" && !isMotorista && (
                <Button
                  onClick={() => { setSolicitarQtd(order.quantidade_ativa ?? (order.quantidade_cacambas || 1)); setSolicitarDialog(true); }}
                  variant="outline"
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Truck className="w-4 h-4" /> Solicitar Recolha
                </Button>
              )}

              {/* Cancelar Solicitação de Recolha */}
              {order.status === "aguardando_recolha" && !isMotorista && (
                <Button
                  onClick={() => setCancelRecolhaDialog(true)}
                  variant="outline"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" /> Cancelar Recolha
                </Button>
              )}

              {/* ETAPA 1 adicional — solicitar nova recolha parcial se já aguardando mas ainda tem ativo */}
              {order.status === "aguardando_recolha" && !isMotorista && (order.quantidade_ativa ?? 0) > 0 && (
                <Button
                  onClick={() => { setSolicitarQtd(order.quantidade_ativa ?? 1); setSolicitarDialog(true); }}
                  variant="outline"
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Truck className="w-4 h-4" /> + Solicitar Recolha Adicional
                </Button>
              )}

              {/* ETAPA 2 — Confirmar Recolha (somente quando aguardando_recolha) */}
              {order.status === "aguardando_recolha" && (isOperador || isMotoristaRecolha) && (
                <Button
                  onClick={() => {
                    // Pré-preenche com dados da última solicitação pendente
                    const ultimaSol = [...(order.historico_recolhas || [])].reverse().find(r => r.tipo === "solicitacao" && !r.confirmada);
                    setConfirmarQtd(ultimaSol?.quantidade ?? (order.quantidade_ativa ?? 1));
                    setConfirmarMotorista(ultimaSol?.motorista && ultimaSol.motorista !== "—" ? ultimaSol.motorista : "");
                    setConfirmarVeiculo(ultimaSol?.veiculo && ultimaSol.veiculo !== "—" ? ultimaSol.veiculo : "");
                    setConfirmarData(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
                    setConfirmarDialog(true);
                  }}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Recolha Realizada
                </Button>
              )}
              {order.status === "recolhida" && !isMotorista && isOperador && (
                order.status_pagamento !== "pago" ? (
                  <div className="flex flex-col gap-1">
                    <Button
                      onClick={async () => {
                        await base44.entities.ServiceOrder.update(osId, { status: "finalizada" });
                        toast.success("OS finalizada operacionalmente. Cobrança permanece pendente no financeiro.");
                        load();
                      }}
                      className="gap-2 bg-emerald-700 hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Finalizar OS (cobrar depois)
                    </Button>
                    <p className="text-xs text-amber-600">⚠ Valor pendente. O financeiro permanecerá em aberto.</p>
                  </div>
                ) : (
                  <Button onClick={() => updateStatus("finalizada")} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                    <CheckCircle2 className="w-4 h-4" /> Finalizar OS
                  </Button>
                )
              )}
              {/* Pagamento igual ao contrato: envia para aprovação financeira */}
              {order.status_pagamento !== "pago" && (
                pendingPaymentReqs.length > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800">
                    <Clock className="w-4 h-4 shrink-0" />
                    ⏳ Pagamento aguardando aprovação financeira
                  </div>
                ) : (
                  <Button onClick={() => setPaymentDialog(true)} variant="outline" className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                    <DollarSign className="w-4 h-4" /> Registrar Pagamento
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagamento disponível mesmo após finalização operacional */}
        {isClosed && !isCanceled && order.status_pagamento !== "pago" && (
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-amber-800">💰 Cobrança Pendente</p>
                <p className="text-xs text-muted-foreground">OS finalizada operacionalmente. Pagamento ainda não registrado.</p>
              </div>
              {pendingPaymentReqs.length > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800">
                  <Clock className="w-4 h-4 shrink-0" />
                  ⏳ Pagamento aguardando aprovação financeira
                </div>
              ) : (
                <Button onClick={() => setPaymentDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <DollarSign className="w-4 h-4" /> Registrar Pagamento
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!isClosed && !isMotorista && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTrocaDialog(true)} variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                <ArrowLeftRight className="w-4 h-4" /> Troca de Equipamento
              </Button>
            </div>
            <button onClick={() => setCancelDialog(true)} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Cancelar OS
            </button>
          </div>
        )}

        {/* Correção Operacional — disponível para admin mesmo em OS cancelada/finalizada */}
        {isAdmin && (
          <div className="pb-1">
            <Button onClick={() => setAlterarStatusDialog(true)} variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50">
              <ShieldAlert className="w-4 h-4" /> Correção Operacional
            </Button>
          </div>
        )}

        {/* Recibo da última devolução */}
        {lastDevolucaoOS && (
          <Card className="border-0 shadow-sm border-l-4 border-l-purple-400">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-purple-800">
                  ✅ {lastDevolucaoOS.tipoDevolucao === "total" ? "Recolha Total" : "Recolha Parcial"} confirmada
                </p>
                <p className="text-xs text-muted-foreground">Recibo disponível para impressão</p>
              </div>
              <ReciboDevolucaoButton
                doc={order}
                client={client}
                settings={osSettings}
                tipo="os"
                tipoDevolucao={lastDevolucaoOS.tipoDevolucao}
                itensDevolucao={lastDevolucaoOS.itensDevolucao}
                motorista={lastDevolucaoOS.motorista}
                usuario={lastDevolucaoOS.usuario}
                observacoes={lastDevolucaoOS.observacoes}
                numeroDevolucao={lastDevolucaoOS.numeroDevolucao}
              />
            </CardContent>
          </Card>
        )}

        {/* Histórico de Trocas */}
        <HistoricoTrocas
          historico={order?.historico_trocas || []}
          doc={order}
          client={client}
          settings={osSettings}
        />

        {/* Histórico de Devoluções com recibos */}
        {historicoDevolucoes.length > 0 && !lastDevolucaoOS && (
          <HistoricoDevolucoes
            historico={historicoDevolucoes}
            doc={order}
            client={client}
            settings={osSettings}
            tipo="os"
          />
        )}

        {/* Histórico de Recolhas — Solicitações e Confirmações */}
        {(order.historico_recolhas || []).length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" /> Histórico de Recolhas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(order.historico_recolhas || []).map((r, i) => {
                const isSol = r.tipo === "solicitacao" || !r.tipo;
                const isConf = r.tipo === "confirmacao";
                return (
                  <div key={i} className={`flex items-start justify-between p-3 rounded-xl text-xs border ${
                    isConf ? "bg-emerald-50 border-emerald-200" : r.confirmada ? "bg-muted/20 border-border" : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="space-y-0.5">
                      <p className="font-semibold flex items-center gap-1">
                        {isConf ? (
                          <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Recolha confirmada — {r.quantidade} caçamba(s)</>
                        ) : r.confirmada ? (
                          <><CheckCircle2 className="w-3 h-3 text-muted-foreground" /> Solicitação confirmada — {r.quantidade} caçamba(s)</>
                        ) : (
                          <><Clock className="w-3 h-3 text-amber-600" /> Solicitação pendente — {r.quantidade} caçamba(s)</>
                        )}
                      </p>
                      {r.motorista && r.motorista !== "—" && <p className="text-muted-foreground">Motorista: {r.motorista}</p>}
                      {r.veiculo && r.veiculo !== "—" && <p className="text-muted-foreground">Veículo: {r.veiculo}</p>}
                      {r.data_prevista && <p className="text-muted-foreground">Prevista: {r.data_prevista}</p>}
                      {r.observacao && <p className="text-muted-foreground">Obs: {r.observacao}</p>}
                      <p className="text-muted-foreground">
                        {isConf ? "Confirmado" : "Solicitado"} por: {r.usuario}
                        {r.data_confirmacao ? ` (confirmado em ${r.data_confirmacao})` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-3">{r.data || r.data_solicitacao}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t flex justify-between text-xs font-semibold">
                <span>Saldo ativo (em campo):</span>
                <span className={`${(order.quantidade_ativa ?? (order.quantidade_cacambas || 1)) === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {order.quantidade_ativa ?? (order.quantidade_cacambas || 1)} caçamba(s)
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Registro Fotográfico */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Images className="w-4 h-4 text-blue-500" /> Registro Fotográfico
              {(order.fotos || []).length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground font-normal">{(order.fotos || []).length} foto(s)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Fotos de Entrega */}
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                📷 Fotos de Entrega
                {(() => { const fe = (order.fotos || []).filter(f => f.tipo === "entrega"); return fe.length > 0 ? <span className="ml-1 text-blue-500 font-normal">({fe.length})</span> : null; })()}
              </p>
              <PhotoGallery
                photos={(order.fotos || []).filter(f => f.tipo === "entrega")}
                currentUser={currentUser}
                canDelete={isOperador}
                onAdd={async (newPhotos) => {
                  const fotosRecolha = (order.fotos || []).filter(f => f.tipo === "recolha");
                  const outrasExistentes = (order.fotos || []).filter(f => !f.tipo);
                  const tagged = newPhotos.map(p => p.tipo ? p : { ...p, tipo: "entrega" });
                  await base44.entities.ServiceOrder.update(osId, { fotos: [...outrasExistentes, ...tagged, ...fotosRecolha] });
                  load();
                }}
                onRemove={async (idx) => {
                  const fotosEntrega = (order.fotos || []).filter(f => f.tipo === "entrega");
                  const urlToRemove = fotosEntrega[idx]?.url;
                  const updated = (order.fotos || []).filter(f => f.url !== urlToRemove);
                  await base44.entities.ServiceOrder.update(osId, { fotos: updated });
                  load();
                }}
              />
            </div>
            {/* Fotos de Recolha */}
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                📷 Fotos de Recolha
                {(() => { const fr = (order.fotos || []).filter(f => f.tipo === "recolha"); return fr.length > 0 ? <span className="ml-1 text-amber-500 font-normal">({fr.length})</span> : null; })()}
              </p>
              <PhotoGallery
                photos={(order.fotos || []).filter(f => f.tipo === "recolha")}
                currentUser={currentUser}
                canDelete={isOperador}
                onAdd={async (newPhotos) => {
                  const fotosEntrega = (order.fotos || []).filter(f => f.tipo === "entrega");
                  const outrasExistentes = (order.fotos || []).filter(f => !f.tipo);
                  const tagged = newPhotos.map(p => p.tipo ? p : { ...p, tipo: "recolha" });
                  await base44.entities.ServiceOrder.update(osId, { fotos: [...outrasExistentes, ...fotosEntrega, ...tagged] });
                  load();
                }}
                onRemove={async (idx) => {
                  const fotosRecolha = (order.fotos || []).filter(f => f.tipo === "recolha");
                  const urlToRemove = fotosRecolha[idx]?.url;
                  const updated = (order.fotos || []).filter(f => f.url !== urlToRemove);
                  await base44.entities.ServiceOrder.update(osId, { fotos: updated });
                  load();
                }}
              />
            </div>
            {/* Outras fotos sem tipo (legado) */}
            {(order.fotos || []).filter(f => !f.tipo).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  📁 Outras fotos ({(order.fotos || []).filter(f => !f.tipo).length})
                </p>
                <PhotoGallery
                  photos={(order.fotos || []).filter(f => !f.tipo)}
                  currentUser={currentUser}
                  canDelete={isOperador}
                  onAdd={async (newPhotos) => {
                    const fotosTyped = (order.fotos || []).filter(f => f.tipo);
                    await base44.entities.ServiceOrder.update(osId, { fotos: [...fotosTyped, ...newPhotos] });
                    load();
                  }}
                  onRemove={async (idx) => {
                    const fotosOutras = (order.fotos || []).filter(f => !f.tipo);
                    const urlToRemove = fotosOutras[idx]?.url;
                    const updated = (order.fotos || []).filter(f => f.url !== urlToRemove);
                    await base44.entities.ServiceOrder.update(osId, { fotos: updated });
                    load();
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Responsável pela OS + Criado em */}
        {(order.locador_assinatura || order.locador_nome || order.created_date) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wide">Responsável pela OS</p>
              <div className="flex flex-wrap gap-6 text-sm">
                {(order.locador_assinatura || order.locador_nome) && (
                  <div className="flex items-center gap-4">
                    {order.locador_assinatura && (
                      <img src={order.locador_assinatura} alt="Assinatura do responsável" className="h-14 object-contain border rounded bg-white px-2" />
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Criado por</p>
                      <p className="font-semibold">{order.locador_nome || "—"}</p>
                      {order.locador_data && <p className="text-xs text-muted-foreground mt-0.5">{order.locador_data}</p>}
                    </div>
                  </div>
                )}
                {order.created_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {(() => {
                        try { return format(new Date(order.created_date), "dd/MM/yyyy 'às' HH:mm"); }
                        catch { return order.created_date; }
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 pb-4">
          <Button onClick={generatePDF} variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" /> Gerar PDF
          </Button>
          {order.status_pagamento === "pago" && (
            <Button onClick={generateQuitadoPDF} variant="outline" className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
              <FileDown className="w-4 h-4" /> Gerar PDF Quitado
            </Button>
          )}
          {!isSignedLocked && (
            <Button onClick={() => setSignatureDialog(true)} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <PenLine className="w-4 h-4" /> Assinar e Exportar PDF
            </Button>
          )}
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
      </div>

      {/* Cancel OS Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancelar OS #{order?.numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">A OS será cancelada, o valor zerado e removida das cobranças.</p>
            <div>
              <Label className="text-xs">Motivo do Cancelamento *</Label>
              <Textarea value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Voltar</Button>
            <Button onClick={handleCancelOS} variant="destructive" className="gap-2">
              <XCircle className="w-4 h-4" /> Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar Recolha Dialog — OS */}
      <Dialog open={cancelRecolhaDialog} onOpenChange={setCancelRecolhaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancelar Solicitação de Recolha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A recolha será cancelada e a OS voltará para o status <strong>"Entregue"</strong>. O histórico será preservado.
            </p>
            <div>
              <Label className="text-xs">Motivo do Cancelamento *</Label>
              <Textarea
                value={cancelRecolhaMotivo}
                onChange={(e) => setCancelRecolhaMotivo(e.target.value)}
                rows={3}
                placeholder="Ex: cliente desistiu, reagendamento, obra continua..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelRecolhaDialog(false)}>Voltar</Button>
            <Button onClick={handleCancelarRecolhaOS} variant="destructive" className="gap-2">
              <XCircle className="w-4 h-4" /> Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Troca de Equipamento Dialog */}
      <TrocaEquipamentoDialog
        open={trocaDialog}
        onClose={() => setTrocaDialog(false)}
        doc={order}
        docTipo="os"
        client={client}
        settings={osSettings}
        currentUser={currentUser}
        onSaved={load}
      />

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureDialog}
        onOpenChange={setSignatureDialog}
        onConfirm={onSignatureConfirmed}
        title={`Assinatura — OS Nº ${order?.numero || ""}`}
      />

      {/* Payment Dialog — igual ao contrato */}
      <Dialog open={paymentDialog} onOpenChange={(o) => !o && setPaymentDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Registrar Pagamento — OS #{order.numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="p-3 rounded-xl bg-muted/40 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor da OS</span>
                <span className="font-bold">R$ {(order.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor a Receber (R$) *</Label>
                <Input type="number" step="0.01" className="mt-1" value={payForm.valor}
                  onChange={(e) => setPayForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">Forma de Pagamento *</Label>
                <Select value={payForm.forma_pagamento} onValueChange={(v) => setPayForm(p => ({ ...p, forma_pagamento: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PGTO.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Desconto</Label>
                <Input type="number" step="0.01" className="mt-1" value={payForm.desconto}
                  onChange={(e) => setPayForm(p => ({ ...p, desconto: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Tipo de Desconto</Label>
                <Select value={payForm.desconto_tipo} onValueChange={(v) => setPayForm(p => ({ ...p, desconto_tipo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reais">Reais (R$)</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(valorBrutoForm > 0 || descontoForm > 0) && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm space-y-1">
                {descontoForm > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Desconto:</span>
                    <span>− R$ {valorDescontoForm.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Valor Final:</span>
                  <span>R$ {valorFinalForm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {showComprovante && (
              <div>
                <Label className="text-xs">Comprovante PIX/Transferência</Label>
                {payForm.comprovante_url ? (
                  <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-emerald-700 flex-1">Comprovante anexado</span>
                    <button onClick={() => setPayForm(p => ({ ...p, comprovante_url: "" }))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-dashed border-border hover:bg-muted/30 transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{uploadingComp ? "Enviando..." : "Clique para anexar imagem/PDF"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUploadComprovante} disabled={uploadingComp} />
                  </label>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="mt-1" rows={2} value={payForm.observacoes}
                onChange={(e) => setPayForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ℹ O pagamento será enviado para confirmação do financeiro antes de ser lançado no caixa.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Cancelar</Button>
            <Button onClick={handleSolicitarPagamento} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <DollarSign className="w-4 h-4" /> Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ETAPA 1 — Dialog: Solicitar Recolha */}
      <Dialog open={solicitarDialog} onOpenChange={(o) => !o && setSolicitarDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600" /> Solicitar Recolha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              ⏳ Registra apenas a <strong>solicitação</strong>. A caçamba permanece em campo até a recolha física ser confirmada.
            </div>

            {/* Saldo atual */}
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2 rounded-lg bg-muted/40 border">
                <p className="font-bold text-base">{order.quantidade_cacambas || 1}</p>
                <p className="text-muted-foreground">Total</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="font-bold text-base text-emerald-700">{order.quantidade_ativa ?? (order.quantidade_cacambas || 1)}</p>
                <p className="text-muted-foreground">Em campo</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/40 border">
                <p className="font-bold text-base text-muted-foreground">{order.quantidade_recolhida || 0}</p>
                <p className="text-muted-foreground">Recolhida(s)</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Quantidade para solicitar recolha *</Label>
              <Input
                type="number" min="1" max={order.quantidade_ativa ?? (order.quantidade_cacambas || 1)}
                value={solicitarQtd}
                onChange={(e) => setSolicitarQtd(Math.max(1, Math.min(parseInt(e.target.value) || 1, order.quantidade_ativa ?? (order.quantidade_cacambas || 1))))}
                className="mt-1"
              />
              {parseInt(solicitarQtd) < (order.quantidade_ativa ?? (order.quantidade_cacambas || 1)) && (
                <p className="text-xs text-blue-600 mt-1">ℹ Recolha parcial — {(order.quantidade_ativa ?? (order.quantidade_cacambas || 1)) - parseInt(solicitarQtd)} caçamba(s) permanecerão em campo</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Motorista de Recolha <span className="text-muted-foreground">(opcional)</span></Label>
              <div className="mt-1"><DriverSelect value={solicitarMotorista} onChange={setSolicitarMotorista} /></div>
            </div>

            <div>
              <Label className="text-xs">Veículo <span className="text-muted-foreground">(opcional)</span></Label>
              <Select value={solicitarVeiculo} onValueChange={setSolicitarVeiculo}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Definir depois..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Sem veículo (definir depois)</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.placa}>{v.placa} — {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Data prevista com tipo (igual à entrega) */}
            <div>
              <Label className="text-xs">Tipo de Horário Previsto</Label>
              <Select value={solicitarDataTipo} onValueChange={setSolicitarDataTipo}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especifico">⏰ Data/hora específica</SelectItem>
                  <SelectItem value="periodo">🌅 Por período (manhã/tarde/noite)</SelectItem>
                  <SelectItem value="sem_horario">🚫 Sem data definida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {solicitarDataTipo === "especifico" && (
              <div>
                <Label className="text-xs">Data/Hora Prevista</Label>
                <Input type="datetime-local" className="mt-1" value={solicitarData} onChange={(e) => setSolicitarData(e.target.value)} />
              </div>
            )}
            {solicitarDataTipo === "periodo" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Data Prevista</Label>
                  <Input type="date" className="mt-1" value={solicitarData} onChange={(e) => setSolicitarData(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Período</Label>
                  <Select value={solicitarPeriodo} onValueChange={setSolicitarPeriodo}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Período..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manha">🌅 Manhã</SelectItem>
                      <SelectItem value="tarde">☀️ Tarde</SelectItem>
                      <SelectItem value="noite">🌙 Noite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Observações <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea rows={2} className="mt-1" value={solicitarObs} onChange={(e) => setSolicitarObs(e.target.value)} placeholder="Ex: retirar somente a caçamba da frente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolicitarDialog(false)}>Cancelar</Button>
            <Button onClick={handleSolicitarRecolha} className="gap-2 bg-amber-600 hover:bg-amber-700">
              <Truck className="w-4 h-4" /> Registrar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ETAPA 2 — Dialog: Confirmar Recolha Realizada */}
      <Dialog open={confirmarDialog} onOpenChange={(o) => !o && setConfirmarDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600" /> Confirmar Recolha Realizada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-800">
              ✅ Confirme apenas após a <strong>recolha física ter sido realizada</strong>. O saldo será baixado e o estoque atualizado agora.
            </div>

            {/* Saldo atual */}
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2 rounded-lg bg-muted/40 border">
                <p className="font-bold text-base">{order.quantidade_cacambas || 1}</p>
                <p className="text-muted-foreground">Total</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-bold text-base text-amber-700">{order.quantidade_ativa ?? (order.quantidade_cacambas || 1)}</p>
                <p className="text-muted-foreground">Em campo</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/40 border">
                <p className="font-bold text-base text-muted-foreground">{order.quantidade_recolhida || 0}</p>
                <p className="text-muted-foreground">Recolhida(s)</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Quantidade recolhida *</Label>
              <Input
                type="number" min="1" max={order.quantidade_ativa ?? (order.quantidade_cacambas || 1)}
                value={confirmarQtd}
                onChange={(e) => setConfirmarQtd(Math.max(1, Math.min(parseInt(e.target.value) || 1, order.quantidade_ativa ?? (order.quantidade_cacambas || 1))))}
                className="mt-1"
              />
              {parseInt(confirmarQtd) < (order.quantidade_ativa ?? (order.quantidade_cacambas || 1)) && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ Após confirmação: {(order.quantidade_ativa ?? (order.quantidade_cacambas || 1)) - parseInt(confirmarQtd)} caçamba(s) permanecerão em campo
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Motorista que realizou a recolha</Label>
              <div className="mt-1"><DriverSelect value={confirmarMotorista} onChange={setConfirmarMotorista} /></div>
            </div>

            <div>
              <Label className="text-xs">Veículo utilizado</Label>
              <Select value={confirmarVeiculo} onValueChange={setConfirmarVeiculo}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Não informado</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.placa}>{v.placa} — {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Data/Hora da Recolha Real *</Label>
              <Input type="datetime-local" className="mt-1" value={confirmarData} onChange={(e) => setConfirmarData(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">Observações <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea rows={2} className="mt-1" value={confirmarObs} onChange={(e) => setConfirmarObs(e.target.value)} placeholder="Ex: caçamba recolhida sem avarias" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarRecolha} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Recolha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Dialog */}
      <WhatsAppSendDialog
        open={whatsDialog}
        onOpenChange={setWhatsDialog}
        phone={client?.telefone1}
        clientNome={order?.client_nome}
        docTipo="os"
        docNumero={order?.numero}
        docId={osId}
        valorTotal={order?.valor}
        valorPago={order?.valor}
        statusFinanceiro={order?.status_pagamento === "pago" ? "pago" : "pendente"}
        formaPagamento={order?.forma_pagamento}
        settings={osSettings}
        onGeneratePDF={handleGeneratePDFForDialog}
        currentUser={currentUser}
      />

      {/* Correção Operacional */}
      {alterarStatusDialog && <AlterarStatusDialog open={alterarStatusDialog} onClose={() => setAlterarStatusDialog(false)} doc={order} docTipo="os" currentUser={currentUser} onSaved={load} />}

      {/* Unlock Dialog */}
      <Dialog open={unlockDialog} onOpenChange={setUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-amber-700 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Desbloquear Edição — Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Esta OS foi assinada pelo cliente. Qualquer edição será registrada no log de auditoria.</p>
            <div>
              <Label className="text-xs">Motivo obrigatório *</Label>
              <Textarea value={unlockMotivo} onChange={(e) => setUnlockMotivo(e.target.value)} rows={3}
                placeholder="Descreva o motivo da edição após assinatura..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialog(false)}>Cancelar</Button>
            <Button onClick={handleUnlockEdit} className="bg-amber-600 hover:bg-amber-700 gap-2">
              <ShieldAlert className="w-4 h-4" /> Confirmar e Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}