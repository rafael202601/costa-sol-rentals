import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Truck, Filter, ArrowDownToLine, ArrowUpFromLine, LayoutList,
  FileDown, X, ChevronDown, ChevronUp, Lock, Bell, BellOff, Car, XCircle
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format, addDays, subDays, startOfMonth } from "date-fns";
import { getDataOperacional, STATUS_RECOLHA } from "../lib/dataOperacional";
import CargaResumo from "../components/driver/CargaResumo";
import ParadaCard from "../components/driver/ParadaCard";
import ChecklistCarga from "../components/driver/ChecklistCarga";
import { jsPDF } from "jspdf";
import { useDriverNotifications } from "../hooks/useDriverNotifications";
import TrocaGroupCard from "../components/driver/TrocaGroupCard";

// Verifica se um campo de motorista corresponde ao driver (por nome ou email)
// Ignora maiúsculas/minúsculas e espaços extras
function matchDriver(field, driverName, driverEmail) {
  if (!field) return false;
  const f = field.trim().toLowerCase();
  if (driverName && f === driverName.trim().toLowerCase()) return true;
  if (driverEmail && f === driverEmail.trim().toLowerCase()) return true;
  return false;
}

// Status finais — ocultar completamente do painel do motorista
const STATUS_CONTRATO_FINAIS = ["finalizado", "cancelado"];
const STATUS_OS_FINAIS = ["finalizada", "cancelada", "recolhida"];

// Monta lista de paradas a partir de contratos + OSs
// Regra simples: se o motorista está vinculado (entrega OU recolha) E o item não está finalizado → exibe
// O tipo é determinado apenas por qual campo o motorista ocupa, não pelo status
function buildParadas(contracts, orders, driverName, driverEmail) {
  const paradas = [];

  // IDs de contratos que têm trocas pendentes em campo para este motorista
  // Esses contratos NÃO devem gerar parada de entrega/recolha normal
  const contratosComTrocaPendente = new Set(
    contracts.flatMap(c =>
      (c.historico_trocas || []).filter(t =>
        t.tipo === "em_campo" &&
        t.status !== "concluida" &&
        matchDriver(t.motorista, driverName, driverEmail)
      ).length > 0 ? [c.id] : []
    )
  );

  // Status que indicam que a operação atual é recolha
  const STATUS_RECOLHA = ["aguardando_recolha", "devolvido_parcial", "devolvido_pendente"];

  contracts.forEach((c) => {
    if (STATUS_CONTRATO_FINAIS.includes(c.status)) return;
    // Se este contrato tem troca em campo pendente para este motorista,
    // não exibir como entrega/recolha — vai aparecer apenas como TROCA
    if (contratosComTrocaPendente.has(c.id)) return;

    const isEntrega = matchDriver(c.motorista_entrega, driverName, driverEmail);
    const isRecolha = matchDriver(c.motorista_recolha, driverName, driverEmail);
    if (!isEntrega && !isRecolha) return;

    // O tipo é determinado pelo STATUS ATUAL, não pelos campos preenchidos.
    // Se o contrato está em fase de recolha, sempre exibir como recolha.
    // Isso evita que apareça em "entrega" depois que a recolha foi solicitada.
    const emFaseRecolha = STATUS_RECOLHA.includes(c.status);
    const tipo = emFaseRecolha ? "recolha" : "entrega";

    // Data operacional: centralizada em getDataOperacional
    // Para recolha: data_recolha → data_prevista_termino → hoje (nunca usa data_inicio)
    // Para entrega: data_inicio
    let dataRef = getDataOperacional(c);
    if (!dataRef && emFaseRecolha) {
      dataRef = c.data_prevista_termino || new Date().toISOString().split("T")[0];
    }

    paradas.push({
      id: `c-${c.id}`,
      docId: c.id,
      docTipo: "contrato",
      numero: c.numero,
      clienteNome: c.client_nome,
      endereco: c.endereco_entrega || c.obra_endereco || "",
      obra: c.obra_nome || "",
      tipo,
      itens: c.itens || [],
      location: (c.location_url || c.latitude || c.location_notes)
        ? { location_url: c.location_url, latitude: c.latitude, longitude: c.longitude, location_notes: c.location_notes }
        : null,
      dataInicio: dataRef || c.data_inicio,
      prioridade: c._prioridade || 999,
      currentStatus: c.status,
      assinaturaEntrega: c.assinatura_entrega_url,
      assinaturaDevolucao: c.assinatura_devolucao_url,
      historicoTentativas: c.historico_tentativas || [],
    });
  });

  // Mapa de OS originais vinculadas a trocas (novaOsId → osOrigem)
  const trocaVinculoMap = new Map();
  orders.forEach((o) => {
    if (o.tipo_os === "troca_cacamba" && o.os_origem_id) {
      const osOrigem = orders.find(x => x.id === o.os_origem_id);
      if (osOrigem) trocaVinculoMap.set(o.id, osOrigem);
    }
  });

  // IDs de OS originais que já serão incluídas como parada de recolha via vínculo de troca
  // (para evitar duplicação se o motorista também estiver atribuído nelas normalmente)
  const osOrigensIncluidas = new Set();

  orders.forEach((o) => {
    if (STATUS_OS_FINAIS.includes(o.status)) return;

    const isEntrega = matchDriver(o.motorista_entrega, driverName, driverEmail);
    const isRecolha = matchDriver(o.motorista_recolhimento, driverName, driverEmail);

    // Se for nova OS de troca de caçamba e o motorista estiver na entrega,
    // incluir automaticamente a OS original vinculada como parada de recolha
    if (o.tipo_os === "troca_cacamba" && o.os_origem_id && isEntrega) {
      const osOrigem = trocaVinculoMap.get(o.id);
      if (osOrigem && !STATUS_OS_FINAIS.includes(osOrigem.status) && !osOrigensIncluidas.has(osOrigem.id)) {
        osOrigensIncluidas.add(osOrigem.id);
        paradas.push({
          id: `o-${osOrigem.id}`,
          docId: osOrigem.id,
          docTipo: "os",
          numero: osOrigem.numero,
          clienteNome: osOrigem.client_nome,
          endereco: osOrigem.local_entrega || "",
          obra: "",
          tipo: "recolha",
          itens: osOrigem.tipo_cacamba ? [{ equipamento_nome: `Caçamba: ${osOrigem.tipo_cacamba}`, quantidade_retirada: osOrigem.quantidade_cacambas || osOrigem.quantidade_ativa || 1 }] : [],
          location: (osOrigem.location_url || osOrigem.latitude || osOrigem.location_notes)
            ? { location_url: osOrigem.location_url, latitude: osOrigem.latitude, longitude: osOrigem.longitude, location_notes: osOrigem.location_notes }
            : null,
          dataInicio: osOrigem.data_recolhimento || osOrigem.data_entrega,
          prioridade: osOrigem._prioridade || 999,
          currentStatus: osOrigem.status,
          assinaturaEntrega: osOrigem.assinatura_entrega_url,
          assinaturaDevolucao: osOrigem.assinatura_devolucao_url,
          historicoTentativas: osOrigem.historico_tentativas || [],
          trocaTipo: "original",
          trocaOsNovaId: o.id,
          trocaOsNovaNumero: o.numero,
          quantidadeCacambas: osOrigem.quantidade_cacambas || osOrigem.quantidade_ativa || 1,
          trocaQtdNova: o.quantidade_cacambas || o.quantidade_ativa || 1,
        });
      }
    }

    if (!isEntrega && !isRecolha) return;

    // Evitar duplicação: se esta OS já foi incluída como origem de troca, pular
    if (osOrigensIncluidas.has(o.id)) return;

    // Status que indicam fase de recolha na OS
    const STATUS_RECOLHA_OS = ["aguardando_recolha", "recolhida"];
    const emFaseRecolhaOS = STATUS_RECOLHA_OS.includes(o.status);

    // Se a OS está em fase de recolha, sempre tipo "recolha" independente de qual campo o motorista ocupa
    const tipo = emFaseRecolhaOS ? "recolha"
      : isEntrega && isRecolha ? "ambos"
      : isEntrega ? "entrega"
      : "recolha";

    // Data operacional: se em fase de recolha, usar data_recolhimento; senão data_entrega
    const dataRef = (emFaseRecolhaOS || (isRecolha && !isEntrega))
      ? (o.data_recolhimento || o.data_entrega)
      : o.data_entrega;

    // Referência cruzada de troca
    const osOrigem = trocaVinculoMap.get(o.id);
    const osNovaDeEstaOrigem = o.os_troca_id ? orders.find(x => x.id === o.os_troca_id) : null;

    paradas.push({
      id: `o-${o.id}`,
      docId: o.id,
      docTipo: "os",
      numero: o.numero,
      clienteNome: o.client_nome,
      endereco: o.local_entrega || "",
      obra: "",
      tipo,
      itens: o.tipo_cacamba ? [{ equipamento_nome: `Caçamba: ${o.tipo_cacamba}`, quantidade_retirada: o.quantidade_cacambas || o.quantidade_ativa || 1 }] : [],
      location: (o.location_url || o.latitude || o.location_notes)
        ? { location_url: o.location_url, latitude: o.latitude, longitude: o.longitude, location_notes: o.location_notes }
        : null,
      dataInicio: dataRef || o.data_entrega,
      prioridade: o._prioridade || 999,
      currentStatus: o.status,
      assinaturaEntrega: o.assinatura_entrega_url,
      assinaturaDevolucao: o.assinatura_devolucao_url,
      historicoTentativas: o.historico_tentativas || [],
      trocaTipo: o.tipo_os === "troca_cacamba" ? "nova" : osNovaDeEstaOrigem ? "original" : null,
      trocaOsOrigemNumero: osOrigem?.numero || null,
      trocaOsOrigemId: o.os_origem_id || null,
      trocaOsNovaNumero: osNovaDeEstaOrigem?.numero || null,
      trocaOsNovaId: o.os_troca_id || null,
      trocaGrupoId: o.tipo_os === "troca_cacamba" ? o.os_origem_id : (o.os_troca_id || null),
      quantidadeCacambas: o.quantidade_cacambas || o.quantidade_ativa || 1,
      trocaQtdOrigem: osOrigem ? (osOrigem.quantidade_cacambas || osOrigem.quantidade_ativa || 1) : null,
      trocaQtdNova: osNovaDeEstaOrigem ? (osNovaDeEstaOrigem.quantidade_cacambas || osNovaDeEstaOrigem.quantidade_ativa || 1) : null,
    });
  });

  // Trocas em campo agendadas para este motorista — SOMENTE CONTRATOS
  contracts.forEach((doc) => {
    const isContrato = true;
    (doc.historico_trocas || []).forEach((troca, ti) => {
      if (troca.tipo !== "em_campo") return;
      if (troca.status === "concluida") return; // concluída = sumiu do painel
      if (!matchDriver(troca.motorista, driverName, driverEmail)) return;

      const dataRef = troca.data_agendada || troca.data || "";
      paradas.push({
        id: `troca-${doc.id}-${ti}`,
        docId: doc.id,
        docTipo: isContrato ? "contrato" : "os",
        numero: doc.numero,
        clienteNome: doc.client_nome,
        clienteCodigo: doc.client_codigo || "",
        endereco: isContrato ? (doc.endereco_entrega || doc.obra_endereco || "") : (doc.local_entrega || ""),
        obra: doc.obra_nome || "",
        tipo: "troca",
        itensSaindo: troca.itens_saindo || [],
        itensEntrando: troca.itens_entrando || [],
        itens: [
          ...(troca.itens_saindo || []).map(i => ({ equipamento_nome: `↑ Saindo: ${i.nome}`, quantidade_retirada: i.quantidade })),
          ...(troca.itens_entrando || []).map(i => ({ equipamento_nome: `↓ Entrando: ${i.nome}`, quantidade_retirada: i.quantidade })),
        ],
        location: isContrato
          ? ((doc.location_url || doc.latitude) ? { location_url: doc.location_url, latitude: doc.latitude, longitude: doc.longitude, location_notes: doc.location_notes } : null)
          : ((doc.location_url || doc.latitude) ? { location_url: doc.location_url, latitude: doc.latitude, longitude: doc.longitude, location_notes: doc.location_notes } : null),
        dataInicio: dataRef,
        prioridade: doc._prioridade || 999,
        currentStatus: "troca_agendada",
        trocaIdx: ti,
        trocaMotivo: troca.motivo,
        trocaStatus: troca.status || "pendente", // pendente | em_rota_troca | concluida
        trocaObservacao: troca.observacao || "",
        trocaDataAgendada: troca.data_agendada || troca.data || "",
        trocaAssinatura: troca.assinatura_url || "",
      });
    });
  });

  return paradas.sort((a, b) => a.prioridade - b.prioridade);
}

/**
 * Agrupa paradas de troca: retorna lista de itens onde pares de troca
 * aparecem juntos como { type: "troca_group", paradaOrigem, paradaNova }
 * ou { type: "single", parada } para paradas normais.
 */
function groupTrocaParadas(paradas) {
  const grouped = [];
  const usedIds = new Set();

  paradas.forEach((p) => {
    if (usedIds.has(p.id)) return;

    // Verifica se é nova OS de troca e encontra a OS original no array
    if (p.trocaTipo === "nova" && p.trocaOsOrigemId) {
      const origem = paradas.find(x => x.docId === p.trocaOsOrigemId);
      if (origem && !usedIds.has(origem.id)) {
        usedIds.add(p.id);
        usedIds.add(origem.id);
        grouped.push({ type: "troca_group", paradaOrigem: origem, paradaNova: p });
        return;
      }
    }

    // Verifica se é OS original com troca vinculada (nova OS está no array)
    if (p.trocaTipo === "original" && p.trocaOsNovaId) {
      const nova = paradas.find(x => x.docId === p.trocaOsNovaId);
      if (nova && !usedIds.has(nova.id)) {
        usedIds.add(p.id);
        usedIds.add(nova.id);
        grouped.push({ type: "troca_group", paradaOrigem: p, paradaNova: nova });
        return;
      }
    }

    usedIds.add(p.id);
    grouped.push({ type: "single", parada: p });
  });

  return grouped;
}

function toDateStr(d) {
  if (!d) return "";
  try {
    // Se já é yyyy-MM-dd (sem hora), retorna direto para evitar conversão UTC errada
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // Para date-time strings, usa split no T
    if (typeof d === "string" && d.includes("T")) return d.split("T")[0];
    return new Date(d).toISOString().split("T")[0];
  } catch { return ""; }
}

const TODAY = new Date().toISOString().split("T")[0];

const PERIODOS_RAPIDOS = [
  { key: "hoje", label: "Hoje" },
  { key: "amanha", label: "Amanhã" },
  { key: "ontem", label: "Ontem" },
  { key: "7dias", label: "Últ. 7 dias" },
  { key: "30dias", label: "Últ. 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "todos", label: "Todos" },
  { key: "personalizado", label: "Personalizado" },
];

function getPeriodoDatas(periodo) {
  const now = new Date();
  if (periodo === "hoje") return { inicio: TODAY, fim: TODAY };
  if (periodo === "amanha") { const d = format(addDays(now, 1), "yyyy-MM-dd"); return { inicio: d, fim: d }; }
  if (periodo === "ontem") { const d = format(subDays(now, 1), "yyyy-MM-dd"); return { inicio: d, fim: d }; }
  if (periodo === "7dias") return { inicio: format(subDays(now, 6), "yyyy-MM-dd"), fim: format(addDays(now, 1), "yyyy-MM-dd") };
  if (periodo === "30dias") return { inicio: format(subDays(now, 29), "yyyy-MM-dd"), fim: format(addDays(now, 1), "yyyy-MM-dd") };
  if (periodo === "mes") return { inicio: format(startOfMonth(now), "yyyy-MM-dd"), fim: format(addDays(now, 1), "yyyy-MM-dd") };
  return null;
}

export default function DriverPanel() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [paradas, setParadas] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [driverMode, setDriverMode] = useState(false); // motorista logado = modo restrito
  const [linkedDriver, setLinkedDriver] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filtroData, setFiltroData] = useState("hoje");
  const [filtroDataInicio, setFiltroDataInicio] = useState(TODAY);
  const [filtroDataFim, setFiltroDataFim] = useState(TODAY);
  const [filtroBairro, setFiltroBairro] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroObra, setFiltroObra] = useState("");

  const loadData = useCallback(async (driverName, driverEmail) => {
    const [ctrs, oss] = await Promise.all([
      base44.entities.Contract.list("-created_date", 500),
      base44.entities.ServiceOrder.list("-created_date", 500),
    ]);
    setContracts(ctrs);
    setOrders(oss);
    if (driverName || driverEmail) {
      const novas = buildParadas(ctrs, oss, driverName, driverEmail);
      setParadas(novas);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const user = await base44.auth.me().catch(() => null);
      setCurrentUser(user);

      // Check if logged-in user is a motorista role FIRST
      if (user?.role === "motorista") {
        const userEmail = (user.email || "").trim().toLowerCase();
        console.log("[DriverPanel] 🚗 Modo motorista ativado");
        console.log("[DriverPanel] Usuário autenticado:", user.email);
        console.log("[DriverPanel] Email normalizado:", userEmail);

        // Busca todos os motoristas (sem filtro de status para garantir que encontra)
        let allDrivers = [];
        try {
          allDrivers = await base44.entities.Driver.list();
          console.log("[DriverPanel] Total de motoristas retornados pela API:", allDrivers.length);
          console.log("[DriverPanel] Emails na base:", allDrivers.map(d => `"${d.email || '(vazio)'}"`));
        } catch (err) {
          console.error("[DriverPanel] Erro ao buscar motoristas:", err);
        }

        // Busca por email com normalização total
        const linked = allDrivers.find(d => {
          const de = (d.email || "").trim().toLowerCase();
          const match = de === userEmail;
          console.log(`[DriverPanel] Comparando: "${de}" === "${userEmail}" → ${match}`);
          return match;
        });

        if (linked) {
          console.log("[DriverPanel] ✅ Vinculado com sucesso! Nome:", linked.nome, "| Email:", linked.email);
        } else {
          console.warn("[DriverPanel] ❌ Nenhum motorista com email:", userEmail);
          console.warn("[DriverPanel] Verifique se o email está cadastrado no perfil do motorista");
        }

        setDrivers(allDrivers);
        setLinkedDriver(linked || null);
        setDriverMode(true);
        if (linked) {
          setSelectedDriver(linked.nome);
          await loadData(linked.nome, linked.email);
        }
        setLoading(false);
        return;
      }

      // Admin / operacional — carrega lista de motoristas ativos e veículos
      const [drvs, veics, ctrs, oss] = await Promise.all([
        base44.entities.Driver.filter({ status: "ativo" }),
        base44.entities.Vehicle.filter({ status: "ativo" }),
        base44.entities.Contract.list("-created_date", 500),
        base44.entities.ServiceOrder.list("-created_date", 500),
      ]);
      setDrivers(drvs);
      setVehicles(veics);
      setContracts(ctrs);
      setOrders(oss);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedDriver && !linkedDriver?.email) { setParadas([]); return; }
    const novas = buildParadas(contracts, orders, selectedDriver, linkedDriver?.email);
    setParadas(novas);
  }, [selectedDriver, contracts, orders, linkedDriver]);

  const handleRefresh = useCallback(() => loadData(selectedDriver || linkedDriver?.nome, linkedDriver?.email), [selectedDriver, linkedDriver, loadData]);

  // 🔔 Notificações em tempo real para motorista vinculado
  useDriverNotifications({
    driverName: linkedDriver?.nome || "",
    driverEmail: linkedDriver?.email || "",
    soundEnabled,
    onUpdate: handleRefresh,
  });

  const obrasDisponiveis = [...new Set(paradas.map(p => p.obra).filter(Boolean))];
  const hasAdvancedFilter = filtroData !== "todos" || filtroBairro || filtroCidade || filtroObra;

  const handlePeriodo = (periodo) => {
    setFiltroData(periodo);
    if (periodo !== "personalizado" && periodo !== "todos") {
      const datas = getPeriodoDatas(periodo);
      if (datas) { setFiltroDataInicio(datas.inicio); setFiltroDataFim(datas.fim); }
    } else if (periodo === "todos") {
      setFiltroDataInicio(""); setFiltroDataFim("");
    }
  };

  const clearAdvanced = () => {
    setFiltroData("todos");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroBairro("");
    setFiltroCidade("");
    setFiltroObra("");
  };

  // IDs de paradas que fazem parte de um par de troca (para não separar os grupos pelo filtro de data)
  const trocaParIds = new Set();
  paradas.forEach(p => {
    if (p.trocaTipo === "nova" && p.trocaOsOrigemId) {
      const origem = paradas.find(x => x.docId === p.trocaOsOrigemId);
      if (origem) { trocaParIds.add(p.id); trocaParIds.add(origem.id); }
    }
    if (p.trocaTipo === "original" && p.trocaOsNovaId) {
      const nova = paradas.find(x => x.docId === p.trocaOsNovaId);
      if (nova) { trocaParIds.add(p.id); trocaParIds.add(nova.id); }
    }
  });

  const paradasFiltradas = paradas.filter((p) => {
    if (filtroTipo === "entrega" && p.tipo !== "entrega") return false;
    if (filtroTipo === "recolha" && p.tipo !== "recolha") return false;
    if (filtroTipo === "troca" && p.tipo !== "troca") return false;
    if (filtroTipo === "nao_concluido" && !(p.historicoTentativas?.length > 0)) return false;

    const dataStr = toDateStr(p.dataInicio);
    // Pares de troca de caçamba: não filtrar pela data para manter o agrupamento intacto
    const isTrocaPar = trocaParIds.has(p.id);
    if (!isTrocaPar) {
      if (filtroData !== "todos" && filtroData !== "personalizado") {
        const datas = getPeriodoDatas(filtroData);
        if (datas) {
          if (dataStr < datas.inicio || dataStr > datas.fim) return false;
        }
      }
      if (filtroData === "personalizado") {
        if (filtroDataInicio && dataStr < filtroDataInicio) return false;
        if (filtroDataFim && dataStr > filtroDataFim) return false;
      }
    }

    const endLower = p.endereco.toLowerCase();
    if (filtroBairro && !endLower.includes(filtroBairro.toLowerCase())) return false;
    if (filtroCidade && !endLower.includes(filtroCidade.toLowerCase())) return false;
    if (filtroObra && !(p.obra || "").toLowerCase().includes(filtroObra.toLowerCase())) return false;

    return true;
  });

  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const reordered = Array.from(paradas);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const comPrioridade = reordered.map((p, i) => ({ ...p, prioridade: i + 1 }));
    setParadas(comPrioridade);
  }, [paradas]);

  const gerarPDFRota = () => {
    const doc = new jsPDF();
    const hoje = new Date().toLocaleDateString("pt-BR");
    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Rota do Motorista", 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Motorista: ${selectedDriver}`, 20, y); y += 6;
    if (selectedVehicle) { doc.text(`Veículo: ${selectedVehicle}`, 20, y); y += 6; }
    doc.text(`Data: ${hoje}`, 20, y); y += 6;
    doc.text(`Total de paradas: ${paradasFiltradas.length}`, 20, y); y += 10;

    doc.setLineWidth(0.5);
    doc.line(20, y, 190, y); y += 8;

    paradasFiltradas.forEach((parada, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const dataParada = toDateStr(parada.dataInicio);
      const tipoLabel = parada.tipo === "troca" ? "🔄 TROCA" : parada.tipo === "entrega" ? "▼ ENTREGA" : parada.tipo === "recolha" ? "▲ RECOLHA" : "⇅ ENTREGA/RECOLHA";
      doc.text(`${idx + 1}. ${tipoLabel} — ${parada.docTipo === "contrato" ? "Contrato" : "OS"} #${parada.numero || "—"}`, 20, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Cliente: ${parada.clienteNome || "—"}`, 25, y); y += 5;
      if (parada.obra) { doc.text(`Obra: ${parada.obra}`, 25, y); y += 5; }
      if (parada.endereco) {
        const linhas = doc.splitTextToSize(`Endereço: ${parada.endereco}`, 165);
        linhas.forEach((l) => { if (y > 270) { doc.addPage(); y = 20; } doc.text(l, 25, y); y += 5; });
      }
      if (parada.location?.location_url) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`GPS: ${parada.location.location_url}`, 25, y); y += 5;
      } else if (parada.location?.latitude && parada.location?.longitude) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`GPS: ${parada.location.latitude}, ${parada.location.longitude}`, 25, y); y += 5;
      }
      if (parada.tipo === "troca") {
        if (parada.itensSaindo?.length > 0) {
          doc.text("Retirar:", 25, y); y += 5;
          parada.itensSaindo.forEach((item) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`  • ${item.nome}: ${item.quantidade || 1} un`, 30, y); y += 5;
          });
        }
        if (parada.itensEntrando?.length > 0) {
          doc.text("Entregar:", 25, y); y += 5;
          parada.itensEntrando.forEach((item) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`  • ${item.nome}: ${item.quantidade || 1} un`, 30, y); y += 5;
          });
        }
        if (parada.trocaMotivo) { doc.text(`Motivo: ${parada.trocaMotivo}`, 25, y); y += 5; }
      } else if (parada.itens?.length > 0) {
        doc.text("Materiais:", 25, y); y += 5;
        parada.itens.forEach((item) => {
          if (!item.equipamento_nome) return;
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(`  • ${item.equipamento_nome}: ${item.quantidade_retirada || 1} un`, 30, y); y += 5;
        });
      }
      y += 4;
      doc.setLineWidth(0.2);
      doc.line(20, y, 190, y); y += 6;
    });

    doc.save(`rota_${selectedDriver.replace(/\s+/g, "_")}_${hoje.replace(/\//g, "-")}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // MODO MOTORISTA RESTRITO — sem driver vinculado
  if (driverMode && !linkedDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <Truck className="w-16 h-16 text-muted-foreground/20" />
        <div className="space-y-2">
          <p className="font-semibold text-lg text-foreground">Nenhum motorista vinculado ao email do usuário</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Não foi encontrado nenhum motorista cadastrado com este e-mail. Solicite ao administrador que atualize o cadastro.
          </p>
        </div>
        <div className="mt-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-left w-full max-w-sm space-y-2">
          <p className="text-xs font-semibold text-amber-800">📧 E-mail consultado:</p>
          <p className="text-sm font-mono bg-white border border-amber-200 rounded px-3 py-2 text-amber-900 break-all">
            {currentUser?.email || "—"}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Certifique-se que este e-mail está cadastrado exatamente igual no perfil do motorista.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border text-left w-full max-w-sm space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Status da vinculação:</p>
          <p className="text-xs text-destructive font-medium">❌ Não vinculado</p>
          <p className="text-xs text-muted-foreground">Motoristas ativos no sistema: {drivers.length}</p>
        </div>
      </div>
    );
  }

  // MODO MOTORISTA RESTRITO — acesso apenas ao que é dele
  if (driverMode && linkedDriver) {
    return (
      <div>
        <PageHeader
          title="Minha Rota"
          subtitle={`${linkedDriver.nome} — ${linkedDriver.veiculo || ""} ${linkedDriver.placa || ""}`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(v => !v)}
            className={`gap-2 ${soundEnabled ? "text-primary border-primary/40" : "text-muted-foreground"}`}
            title={soundEnabled ? "Desativar som de alerta" : "Ativar som de alerta"}
          >
            {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <Truck className="w-4 h-4" /> Atualizar
          </Button>
          {paradasFiltradas.length > 0 && (
            <Button variant="outline" size="sm" onClick={gerarPDFRota} className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          )}
        </PageHeader>

        {/* Info do motorista */}
        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{linkedDriver.nome}</p>
            <p className="text-xs text-muted-foreground">
              {paradasFiltradas.length} parada(s)
              {filtroData !== "todos" && ` · ${PERIODOS_RAPIDOS.find(p => p.key === filtroData)?.label || filtroData}`}
            </p>
            {(linkedDriver.veiculo || linkedDriver.placa) && (
              <div className="mt-1.5 flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700 w-fit">
                <Car className="w-3 h-3 shrink-0" />
                <span className="font-medium">{linkedDriver.veiculo || "Veículo"}</span>
                {linkedDriver.placa && <span className="font-mono bg-white border border-blue-200 px-1.5 py-0.5 rounded text-[10px]">{linkedDriver.placa}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${soundEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {soundEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              {soundEnabled ? "Alertas ativos" : "Som desativado"}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <Lock className="w-3 h-3" /> Restrito
            </span>
          </div>
        </div>

        {/* Filtros do motorista — mobile first */}
        <div className="mb-4 space-y-3">
          {/* Período rápido — destaque principal */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              📅 Filtrar por data
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {PERIODOS_RAPIDOS.filter(p => p.key !== "personalizado").map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handlePeriodo(key)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    filtroData === key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Personalizado */}
            <button
              onClick={() => handlePeriodo("personalizado")}
              className={`mt-1.5 w-full py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                filtroData === "personalizado"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border bg-background text-foreground"
              }`}
            >
              📆 Personalizado
            </button>
            {filtroData === "personalizado" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">De</p>
                  <Input type="date" className="h-9 text-sm" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Até</p>
                  <Input type="date" className="h-9 text-sm" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Tipo — botões grandes para toque */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { key: "todos", label: "Todos", icon: <LayoutList className="w-4 h-4" /> },
              { key: "entrega", label: "Entregas", icon: <ArrowDownToLine className="w-4 h-4" /> },
              { key: "recolha", label: "Recolhas", icon: <ArrowUpFromLine className="w-4 h-4" /> },
              { key: "troca", label: "Trocas", icon: <Truck className="w-4 h-4" /> },
              { key: "nao_concluido", label: "Não Conc.", icon: <XCircle className="w-4 h-4" />, alert: paradas.filter(p => p.historicoTentativas?.length > 0).length },
            ].map(({ key, label, icon, alert }) => (
              <button
                key={key}
                onClick={() => setFiltroTipo(key)}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  filtroTipo === key
                    ? key === "nao_concluido" ? "bg-red-600 text-white border-red-600 shadow-sm" : "bg-primary text-primary-foreground border-primary shadow-sm"
                    : key === "nao_concluido" && alert > 0 ? "border-red-300 bg-red-50 text-red-700" : "border-border bg-card text-foreground"
                }`}
              >
                {icon}{label}
                {alert > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {alert}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contagem + limpar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {paradasFiltradas.length} de {paradas.length} parada(s)
            </span>
            {(filtroData !== "todos" || filtroTipo !== "todos") && (
              <button
                onClick={() => { clearAdvanced(); setFiltroTipo("todos"); }}
                className="flex items-center gap-1 text-xs text-destructive font-medium"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Checklist do motorista */}
        {paradasFiltradas.length > 0 && (
          <div className="mb-4 max-w-xl">
            <ChecklistCarga paradas={paradasFiltradas} driverName={linkedDriver.nome} currentUser={currentUser} />
          </div>
        )}

        {/* Lista de paradas */}
        {paradasFiltradas.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-10 text-center text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-semibold">Nenhuma parada para você</p>
              <p className="text-xs mt-1">Aguarde a equipe de logística atribuir paradas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-w-xl">
            {groupTrocaParadas(paradasFiltradas).map((item, index) => {
              if (item.type === "troca_group") {
                return (
                  <TrocaGroupCard
                    key={`tg-${item.paradaOrigem.id}-${item.paradaNova.id}`}
                    paradaOrigem={item.paradaOrigem}
                    paradaNova={item.paradaNova}
                    renderOrigem={() => (
                      <ParadaCard
                        parada={item.paradaOrigem}
                        index={index}
                        isDragging={false}
                        listeners={{}}
                        attributes={{}}
                        driverMode
                        driverName={linkedDriver.nome}
                        onStatusUpdated={handleRefresh}
                      />
                    )}
                    renderNova={() => (
                      <ParadaCard
                        parada={item.paradaNova}
                        index={index}
                        isDragging={false}
                        listeners={{}}
                        attributes={{}}
                        driverMode
                        driverName={linkedDriver.nome}
                        onStatusUpdated={handleRefresh}
                      />
                    )}
                  />
                );
              }
              return (
                <ParadaCard
                  key={item.parada.id}
                  parada={item.parada}
                  index={index}
                  isDragging={false}
                  listeners={{}}
                  attributes={{}}
                  driverMode
                  driverName={linkedDriver.nome}
                  onStatusUpdated={handleRefresh}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // veículo selecionado (objeto)
  const vehicleObj = vehicles.find(v => v.placa === selectedVehicle || `${v.placa} — ${v.nome || v.modelo}` === selectedVehicle);

  // MODO ADMIN / LOGÍSTICA — seleção de motorista + todas as funções
  return (
    <div>
      <PageHeader title="Painel do Motorista" subtitle="Carga, rota e checklist de saída">
        <div className="flex flex-wrap gap-2">
          <div className="w-52">
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Selecione motorista..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Selecione veículo..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem veículo</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.placa}>{v.placa}{v.nome || v.modelo ? ` — ${v.nome || v.modelo}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageHeader>

      {/* Banner veículo selecionado */}
      {selectedDriver && selectedVehicle && selectedVehicle !== "__none__" && vehicleObj && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
          <Car className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-blue-800">{vehicleObj.nome || vehicleObj.modelo} — <span className="font-mono">{vehicleObj.placa}</span></p>
            <p className="text-xs text-blue-600">{vehicleObj.marca} {vehicleObj.modelo} {vehicleObj.ano ? `(${vehicleObj.ano})` : ""} · Motorista: {selectedDriver}</p>
          </div>
        </div>
      )}

      {selectedDriver && paradasFiltradas.length > 0 && (
        <div className="mb-4">
          <Button variant="outline" onClick={gerarPDFRota} className="gap-2">
            <FileDown className="w-4 h-4" /> Gerar PDF de Rota
          </Button>
        </div>
      )}

      {!selectedDriver ? (
        <div className="text-center py-20 text-muted-foreground">
          <Truck className="w-14 h-14 mx-auto opacity-15 mb-3" />
          <p className="font-semibold text-base">Selecione um motorista para ver a rota do dia</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <ChecklistCarga paradas={paradasFiltradas} driverName={selectedDriver} currentUser={currentUser} />
          <CargaResumo paradas={paradasFiltradas} filtroTipo={filtroTipo} />

          {/* Filtros */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {[
                { key: "todos", label: "Todos" },
                { key: "entrega", label: "Entregas", icon: <ArrowDownToLine className="w-3 h-3" /> },
                { key: "recolha", label: "Recolhas", icon: <ArrowUpFromLine className="w-3 h-3" /> },
                { key: "troca", label: "Trocas", icon: <Truck className="w-3 h-3" /> },
                { key: "nao_concluido", label: "Não Concluído", icon: <XCircle className="w-3 h-3" />, alert: paradas.filter(p => p.historicoTentativas?.length > 0).length },
              ].map(({ key, label, icon, alert }) => (
                <button
                  key={key}
                  onClick={() => setFiltroTipo(key)}
                  className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filtroTipo === key
                      ? key === "nao_concluido" ? "bg-red-600 text-white border-red-600" : "bg-primary text-primary-foreground border-primary"
                      : key === "nao_concluido" && alert > 0 ? "border-red-300 bg-red-50 text-red-700 hover:border-red-400" : "border-border hover:border-primary/40 bg-background"
                  }`}
                >
                  {icon}{label}
                  {alert > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                      {alert}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ml-auto ${
                  hasAdvancedFilter ? "bg-amber-100 text-amber-800 border-amber-300" : "border-border hover:border-primary/40 bg-background"
                }`}
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Filtros Avançados {hasAdvancedFilter && "●"}
              </button>
            </div>

            {showAdvanced && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">📅 Filtro por Data</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PERIODOS_RAPIDOS.map(({ key, label }) => (
                      <button key={key} onClick={() => handlePeriodo(key)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-all ${filtroData === key ? "bg-primary text-white border-primary" : "border-border bg-background hover:border-primary/40"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {filtroData === "personalizado" && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">De</p>
                        <Input type="date" className="h-8 text-xs w-36" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">Até</p>
                        <Input type="date" className="h-8 text-xs w-36" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">📍 Filtro por Localização</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Bairro</p>
                      <Input className="h-8 text-xs" placeholder="Bairro..." value={filtroBairro} onChange={e => setFiltroBairro(e.target.value)} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Cidade</p>
                      <Input className="h-8 text-xs" placeholder="Cidade..." value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} />
                    </div>
                  </div>
                </div>
                {obrasDisponiveis.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">🏗️ Filtro por Obra</p>
                    <Select value={filtroObra || "__todas__"} onValueChange={v => setFiltroObra(v === "__todas__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__todas__">Todas as obras</SelectItem>
                        {obrasDisponiveis.map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">🏗️ Filtro por Obra (texto)</p>
                    <Input className="h-8 text-xs" placeholder="Nome da obra..." value={filtroObra} onChange={e => setFiltroObra(e.target.value)} />
                  </div>
                )}
                {hasAdvancedFilter && (
                  <button onClick={clearAdvanced} className="flex items-center gap-1 text-xs text-destructive hover:underline mt-1">
                    <X className="w-3 h-3" /> Limpar filtros avançados
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {paradasFiltradas.length} de {paradas.length} parada(s)
              </span>
            </div>
          </div>

          {paradasFiltradas.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-10 text-center text-muted-foreground">
                <LayoutList className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="font-semibold">Nenhuma parada encontrada</p>
                <p className="text-xs mt-1">Tente ajustar os filtros aplicados.</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                ↕ Arraste as paradas para reorganizar a rota
              </p>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="paradas">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {groupTrocaParadas(paradasFiltradas).map((item, index) => {
                        if (item.type === "troca_group") {
                          return (
                            <TrocaGroupCard
                              key={`tg-${item.paradaOrigem.id}-${item.paradaNova.id}`}
                              paradaOrigem={item.paradaOrigem}
                              paradaNova={item.paradaNova}
                              renderOrigem={() => (
                                <ParadaCard
                                  parada={item.paradaOrigem}
                                  index={index}
                                  isDragging={false}
                                  listeners={{}}
                                  attributes={{}}
                                  driverMode={false}
                                  driverName={selectedDriver}
                                  onStatusUpdated={handleRefresh}
                                />
                              )}
                              renderNova={() => (
                                <ParadaCard
                                  parada={item.paradaNova}
                                  index={index}
                                  isDragging={false}
                                  listeners={{}}
                                  attributes={{}}
                                  driverMode={false}
                                  driverName={selectedDriver}
                                  onStatusUpdated={handleRefresh}
                                />
                              )}
                            />
                          );
                        }
                        return (
                          <Draggable key={item.parada.id} draggableId={item.parada.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}>
                                <ParadaCard
                                  parada={item.parada}
                                  index={index}
                                  isDragging={snapshot.isDragging}
                                  listeners={provided.dragHandleProps}
                                  attributes={{}}
                                  driverMode={false}
                                  driverName={selectedDriver}
                                  onStatusUpdated={handleRefresh}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
        </div>
      )}
    </div>
  );
}