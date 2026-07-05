import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ClientSearch from "../components/ClientSearch";
import LocationField from "../components/LocationField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2, ImageIcon, X, AlertTriangle, User, Building2, Store, Truck, Calculator, Infinity, ScanBarcode } from "lucide-react";
import AddressHistory from "../components/AddressHistory";
import { extractAddressesFromDocs } from "../lib/recentAddresses";
import SerialSelector from "../components/equipment/SerialSelector";
import EquipmentItemSearch from "../components/equipment/EquipmentItemSearch";
import { Checkbox } from "@/components/ui/checkbox";
import AndaimeCalculator from "../components/andaime/AndaimeCalculator";
import DriverSelect from "../components/DriverSelect";
import FreightCalculator from "../components/freight/FreightCalculator";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { showError, SAVE_ERRORS } from "../lib/errorHandler";
import { getNextNumber } from "../lib/sequentialNumber";
import { calcContractTotal, getDiasContrato, calcValorMinimoLocacao } from "../lib/contractCalc";
import { isCadastroVencido, getStatusValidade, getValidadeConfig, getDiasParaValidade } from "../lib/clientValidade";
import { getClienteRestricoes, PendenciaFinanceiraDialog } from "../components/client/ClientStatusAlert";
import BloqueioClienteDialog from "../components/client/BloqueioClienteDialog";

export default function ContractForm() {
  const navigate = useNavigate();
  const { id: contractId } = useParams();
  const isEditing = contractId && contractId !== "novo";

  const [equipment, setEquipment] = useState([]);

  const [settings, setSettings] = useState(null);
  // _originalData guarda todos os campos do registro salvo no banco
  // para garantir que campos não editáveis (assinaturas, fotos, históricos) nunca sejam perdidos
  const [_originalData, setOriginalData] = useState({});
  const [form, setForm] = useState({
    numero: "", client_id: "", client_nome: "", data_inicio: format(new Date(), "yyyy-MM-dd"),
    sem_prazo: true, prazo_tipo: "dias", prazo_valor: 1, data_prevista_termino: "",
    solicitante_nome: "", solicitante_tipo: "cliente", obra_nome: "", obra_endereco: "",
    itens: [], frete: "", sinal: "", valor_total: 0, valor_pago: "", saldo_pagar: 0,
    status: "rascunho", status_financeiro: "pendente", endereco_entrega: "", observacoes: "",
    tipo_entrega: "entrega", // "entrega" | "retirada_loja"
  });
  const [calcInfo, setCalcInfo] = useState(null);
  const [showAndaimeCalc, setShowAndaimeCalc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [showPendenciaDialog, setShowPendenciaDialog] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [showBloqueioDialog, setShowBloqueioDialog] = useState(false);
  const [liberacaoBloqueio, setLiberacaoBloqueio] = useState(null); // dados da liberação aprovada
  const [clientAddresses, setClientAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const enrichedRef = useRef(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.Equipment.list().then(setEquipment);
    base44.entities.CompanySettings.list().then((s) => { if (s[0]) setSettings(s[0]); });
  }, []);

  useEffect(() => {
    if (isEditing) {
      base44.entities.Contract.filter({ id: contractId }).then(async ([c]) => {
        if (c) {
          // Salva todos os dados originais para preservar campos não editáveis (assinaturas, fotos, históricos)
          setOriginalData(c);
          setForm((prev) => {
            const updated = { ...prev };
            Object.keys(prev).forEach((k) => {
              if (c[k] !== undefined && c[k] !== null) {
                // Manter campos numéricos como string para permitir edição livre
                if (["frete", "sinal", "valor_pago"].includes(k)) {
                  updated[k] = c[k] === 0 ? "" : String(c[k]);
                } else {
                  updated[k] = c[k];
                }
              }
            });
            if (!updated.itens) updated.itens = [];
            // Normalizar itens carregados para campos vazios editáveis
            updated.itens = updated.itens.map((i) => ({
              ...i,
              valor_unitario: i.valor_unitario === 0 ? "" : (i.valor_unitario ?? ""),
              desconto: i.desconto === 0 ? "" : (i.desconto ?? ""),
            }));
            return updated;
          });
          // Also load clientData so solicitante/obra dropdowns work
          if (c.client_id) {
            const [cl] = await base44.entities.Client.filter({ id: c.client_id });
            if (cl) setClientData(cl);
          }
        }
      });
    }
  }, [contractId, isEditing]);

  // Enriquecer itens com dados do catálogo APENAS para contratos antigos que não possuem
  // os campos de grupo ainda (aplica_valor_minimo === undefined).
  // NUNCA sobrescrever campos já persistidos — o grupo é imutável após criação.
  useEffect(() => {
    if (!isEditing || !equipment.length || enrichedRef.current) return;
    setForm((prev) => {
      if (!prev.itens?.length) return prev;
      const needsUpdate = prev.itens.some(
        (i) => i.equipamento_id && i.aplica_valor_minimo === undefined
      );
      if (!needsUpdate) {
        enrichedRef.current = true;
        return prev;
      }
      enrichedRef.current = true;
      return {
        ...prev,
        itens: prev.itens.map((i) => {
          // Só toca em itens que NUNCA tiveram o campo definido (contratos legados)
          if (!i.equipamento_id || i.aplica_valor_minimo !== undefined) return i;
          const eq = equipment.find((e) => e.id === i.equipamento_id);
          if (!eq) return i;
          return {
              ...i,
              // Preserva campos financeiros já salvos — apenas preenche os faltantes
              aplica_valor_minimo: eq.aplica_valor_minimo === true,
              dias_minimos_proprio: i.dias_minimos_proprio ?? (eq.dias_minimos_proprio || 0),
              valor_diario: i.valor_diario ?? (eq.valor_diario || 0),
              valor_indenizacao: i.valor_indenizacao ?? (eq.valor_indenizacao || 0),
            };
        }),
      };
    });
  }, [isEditing, equipment]);

  // Auto-calculate end date (apenas se não for sem_prazo)
  useEffect(() => {
    if (form.sem_prazo) return;
    if (form.data_inicio && form.prazo_valor) {
      const start = new Date(form.data_inicio);
      const end = form.prazo_tipo === "dias"
        ? addDays(start, Number(form.prazo_valor))
        : addMonths(start, Number(form.prazo_valor));
      setForm((prev) => ({ ...prev, data_prevista_termino: format(end, "yyyy-MM-dd") }));
    }
  }, [form.data_inicio, form.prazo_tipo, form.prazo_valor, form.sem_prazo]);

  // Auto-calculate totals usando regra centralizada
  useEffect(() => {
    if (!settings) return;
    const dias = getDiasContrato({ ...form, prazo_valor: Number(form.prazo_valor) || 1 });
    const itensNorm = (form.itens || []).map((i) => ({
      ...i,
      valor_unitario: parseFloat(i.valor_unitario) || 0,
      desconto: parseFloat(i.desconto) || 0,
    }));
    const result = calcContractTotal({
      itens: itensNorm,
      diasContrato: dias,
      diasMinimos: settings?.minimo_dias || 5,
      valorMinimoContrato: settings?.valor_minimo_contrato || 0,
      frete: parseFloat(form.frete) || 0,
      sinal: parseFloat(form.sinal) || 0,
      valorPago: parseFloat(form.valor_pago) || 0,
      regrasDesconto: settings?.regras_desconto_tempo || [],
    });
    setCalcInfo(result);
    setForm((prev) => ({ ...prev, valor_total: result.valorTotal, saldo_pagar: result.saldoPagar }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itens, form.frete, form.valor_pago, form.sinal, form.prazo_valor, form.prazo_tipo, settings]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // When solicitante_tipo changes, reset solicitante_nome (or auto-fill if "cliente")
  const handleSolicitanteTipoChange = (tipo) => {
    const autoNome = tipo === "cliente" ? (form.client_nome || "") : "";
    setForm((prev) => ({ ...prev, solicitante_tipo: tipo, solicitante_nome: autoNome, obra_nome: "", obra_endereco: "" }));
  };

  // Get list of selectable solicitantes based on type + clientData
  const getSolicitanteOptions = () => {
    if (!clientData) return [];
    if (form.solicitante_tipo === "empreiteiro") {
      const opts = [];
      if (clientData.empreiteiro_nome) opts.push(clientData.empreiteiro_nome);
      (clientData.obras || []).forEach((o) => { if (o.empreiteiro_nome) opts.push(o.empreiteiro_nome); });
      return [...new Set(opts)];
    }
    if (form.solicitante_tipo === "pessoa_autorizada") {
      const opts = [];
      (clientData.pessoas_liberadas || []).forEach((p) => { if (p.nome) opts.push(p.nome); });
      (clientData.obras || []).forEach((o) => {
        (o.pessoas_autorizadas || []).forEach((p) => { if (p.nome) opts.push(p.nome); });
      });
      return [...new Set(opts)];
    }
    return [];
  };

  // Get obras from clientData
  const getObras = () => {
    if (!clientData) return [];
    return (clientData.obras || []).filter((o) => o.ativa !== false);
  };

  const handleClientSelect = async (client) => {
    const addr = [client.endereco_entrega_rua, client.endereco_entrega_numero, client.endereco_entrega_bairro, client.endereco_entrega_cidade, client.endereco_entrega_uf]
      .filter(Boolean).join(", ");
    setClientData(client);
    setForm((prev) => ({
      ...prev,
      client_id: client.id,
      client_nome: client.nome_razao_social,
      client_codigo: client.codigo_cliente || "",
      client_etiquetas: client.etiquetas || [],
      endereco_entrega: addr || prev.endereco_entrega,
      solicitante_nome: prev.solicitante_tipo === "cliente" ? client.nome_razao_social : prev.solicitante_nome,
    }));
    setLiberacaoBloqueio(null); // reset ao trocar cliente
    // Carregar histórico de endereços dos contratos anteriores
    setLoadingAddresses(true);
    try {
      const contratos = await base44.entities.Contract.filter({ client_id: client.id });
      const addrs = extractAddressesFromDocs(contratos, "endereco_entrega");
      if (addr && !addrs.includes(addr)) addrs.unshift(addr);
      setClientAddresses([...new Set(addrs)].slice(0, 8));
    } catch {
      setClientAddresses(addr ? [addr] : []);
    } finally {
      setLoadingAddresses(false);
    }
    const restricoes = getClienteRestricoes(client);
    if (restricoes.serasa_restrito || restricoes.bloqueado) {
      // O alerta detalhado aparecerá no dialog ao tentar salvar
      toast.warning("⚠ Este cliente possui restrições. Verifique antes de prosseguir.");
    } else if (restricoes.pendencia) {
      toast.warning("⚠ Cliente com pendência financeira. Será necessário confirmar para prosseguir.");
    }
    if (isCadastroVencido(client)) toast.error("🚫 Cadastro do cliente VENCIDO. Atualize os dados para continuar.");
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      itens: [...(prev.itens || []), { equipamento_id: "", equipamento_nome: "", equipamento_foto: "", quantidade_retirada: 1, valor_unitario: "", desconto: "", quantidade_devolvida: 0, seriais_selecionados: [] }],
    }));
  };

  const applyAndaimeItens = (itensAndaime) => {
    const mapped = itensAndaime.map((i) => ({
      equipamento_id: i.equipamento_id,
      equipamento_nome: i.equipamento_nome,
      equipamento_foto: i.equipamento_foto || "",
      equipamento_tipo: i.equipamento_tipo || "",
      quantidade_retirada: i.quantidade_retirada,
      valor_unitario: i.valor_diario || "",
      valor_diario: i.valor_diario || 0,
      valor_mensal_ref: i.valor_mensal_ref || 0,
      tipo_cobranca: "diario",
      desconto: "",
      quantidade_devolvida: 0,
      aplica_valor_minimo: i.aplica_valor_minimo,
      dias_minimos_proprio: i.dias_minimos_proprio || 0,
    }));
    setForm((prev) => ({ ...prev, itens: [...(prev.itens || []), ...mapped] }));
    setShowAndaimeCalc(false);
    toast.success(`${mapped.length} itens de andaime adicionados ao contrato!`);
  };

  const getDiasContratoAtual = () => getDiasContrato({ ...form, prazo_valor: Number(form.prazo_valor) || 1 });

  // Get available qty for an equipment, excluding current contract's usage when editing
  const getAvailableQty = (equipId) => {
    const eq = equipment.find((e) => e.id === equipId);
    if (!eq) return 0;
    // When editing, add back what this contract already reserved
    if (isEditing) {
      const alreadyUsed = (form.itens || []).find((i) => i.equipamento_id === equipId)?.quantidade_retirada || 0;
      return (eq.quantidade_disponivel || 0) + alreadyUsed;
    }
    return eq.quantidade_disponivel || 0;
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      if (field === "equipamento_id") {
      const eq = equipment.find((e) => e.id === value);
      if (eq) {
        itens[index].equipamento_nome = eq.nome;
        itens[index].equipamento_foto = eq.foto_url || "";
        itens[index].equipamento_tipo = eq.tipo || "";
        itens[index].valor_diario = eq.valor_diario || 0;
        itens[index].valor_mensal_ref = eq.valor_mensal || 0;
        itens[index].tipo_cobranca = itens[index].tipo_cobranca || "diario";
        itens[index].valor_unitario = eq.valor_diario || "";
        // Sempre atualiza aplica_valor_minimo, dias_minimos_proprio e valor_indenizacao do cadastro do equipamento
        itens[index].aplica_valor_minimo = eq.aplica_valor_minimo === true;
        itens[index].dias_minimos_proprio = eq.dias_minimos_proprio || 0;
        itens[index].valor_indenizacao = eq.valor_indenizacao || 0;
        // Controle individual
        itens[index].controle_individual = eq.controle_individual === true;
        itens[index].seriais_selecionados = [];
      }
      }
      // Ao trocar tipo_cobranca, atualizar valor_unitario
      if (field === "tipo_cobranca") {
      const eq = equipment.find((e) => e.id === itens[index].equipamento_id);
      if (eq) {
        itens[index].valor_unitario = value === "mensal" ? (eq.valor_mensal || "") : (eq.valor_diario || "");
      }
      }
      return { ...prev, itens };
    });
  };

  const removeItem = (index) => {
    setForm((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }));
  };

  const executarSave = async () => {
    setSaving(true);
    const freteNum = parseFloat(form.frete) || 0;
    const sinalNum = parseFloat(form.sinal) || 0;
    const valorPagoNum = parseFloat(form.valor_pago) || 0;
    const itensNorm = (form.itens || []).map((i) => ({
      ...i,
      valor_unitario: parseFloat(i.valor_unitario) || 0,
      desconto: parseFloat(i.desconto) || 0,
    }));

    const dias = getDiasContrato({ ...form, prazo_valor: Number(form.prazo_valor) || 1 });
    const result = calcContractTotal({
      itens: itensNorm,
      diasContrato: dias,
      diasMinimos: settings?.minimo_dias || 5,
      valorMinimoContrato: settings?.valor_minimo_contrato || 0,
      frete: freteNum,
      sinal: sinalNum,
      valorPago: valorPagoNum,
      regrasDesconto: settings?.regras_desconto_tempo || [],
    });

    if (result.minimoAplicado) toast.info(`Mínimo aplicado: R$ ${result.valorTotal.toFixed(2)}`);

    const itensAjustados = (result.itensCalculados || []).map(({ _valorBase, _diasEfetivos, _minimoAplicado, _subtotal, _temMinimo, _diasMinUsados, ...rest }, idx) => {
      const original = itensNorm[idx];
      return {
        ...rest,
        aplica_valor_minimo: original?.aplica_valor_minimo === true,
        dias_minimos_proprio: original?.dias_minimos_proprio || 0,
        valor_diario: original?.valor_diario ?? rest.valor_diario ?? 0,
        valor_indenizacao: original?.valor_indenizacao || rest.valor_indenizacao || 0,
      };
    });

    const data = {
      ...form,
      prazo_valor: Number(form.prazo_valor) || 1,
      frete: freteNum,
      sinal: sinalNum,
      valor_pago: valorPagoNum,
      itens: itensAjustados,
      valor_total: result.valorTotal,
      saldo_pagar: result.saldoPagar,
      // Snapshot definitivo do código do cliente — independente de join
      customer_code: form.client_codigo || "",
    };

    if (!data.numero) {
      const num = await getNextNumber("contrato");
      data.numero = String(num);
    }

    if (!isEditing && data.tipo_entrega === "retirada_loja") {
      data.status = "na_obra";
    }

    // Injetar observação de liberação se houver
    if (liberacaoBloqueio) {
      const obsLib = liberacaoBloqueio.tipo === "pagamento"
        ? `[Liberado mediante pagamento adiantado — por ${liberacaoBloqueio.liberado_por} em ${new Date(liberacaoBloqueio.liberado_em).toLocaleString("pt-BR")}. Motivo: ${liberacaoBloqueio.motivo}]`
        : `[Liberação temporária — por ${liberacaoBloqueio.liberado_por}. Prazo: ${liberacaoBloqueio.prazo}. Motivo: ${liberacaoBloqueio.motivo}]`;
      data.observacoes = [data.observacoes, obsLib].filter(Boolean).join("\n");
      if (liberacaoBloqueio.tipo === "pagamento") {
        data.pagamento_adiantado_obrigatorio = true;
      }
    }

    if (isEditing) {
      data.editado_por = currentUser?.full_name || currentUser?.email || "—";
      // Preserva TODOS os campos não editáveis do registro original
      // (assinaturas do cliente, fotos, histórico de recolhas/trocas/devoluções, etc.)
      const CAMPOS_PRESERVAR = [
        "assinatura_cliente", "assinatura_data",
        "assinatura_entrega_url", "assinatura_entrega_motorista", "assinatura_entrega_data",
        "assinatura_devolucao_url", "assinatura_devolucao_motorista", "assinatura_devolucao_data",
        "assinatura_pendente", "assinatura_pendente_motorista", "assinatura_pendente_data",
        "locador_nome", "locador_assinatura", "locador_data",
        "fotos",
        "historico_recolhas", "historico_devolucoes", "historico_trocas",
        "recolha_parcial_pendente", "recolha_parcial_itens",
        "ultima_cobranca_enviada", "cobranca_pausada",
        "dinamico_data_base", "dinamico_valor_pago_acumulado",
        "dinamico_dias_em_aberto", "dinamico_valor_em_aberto", "dinamico_ultima_atualizacao",
        "criado_por",
        "pagamentos",
      ];
      CAMPOS_PRESERVAR.forEach((campo) => {
        if (_originalData[campo] !== undefined && data[campo] === undefined) {
          data[campo] = _originalData[campo];
        }
      });
    } else {
      data.criado_por = currentUser?.full_name || currentUser?.email || "—";
      data.locador_nome = currentUser?.full_name || currentUser?.email || "—";
      data.locador_assinatura = currentUser?.assinatura_usuario || null;
      data.locador_data = format(new Date(), "dd/MM/yyyy HH:mm");
      if (!currentUser?.assinatura_usuario) {
        toast.warning("Usuário sem assinatura cadastrada. Contrato salvo sem assinatura do locador.");
      }
    }

    // Atualiza seriais APÓS criar/obter o ID do contrato
    const _serialUpdates = data.itens || [];
    const _atualizarSeriais = async (idContrato) => {
      for (const item of _serialUpdates) {
        if (!item.controle_individual || !item.equipamento_id || !item.seriais_selecionados?.length) continue;
        const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
        if (!eq?.numeracoes) continue;
        const agora = format(new Date(), "dd/MM/yyyy HH:mm");
        const updatedNumeracoes = eq.numeracoes.map(n => {
          if (item.seriais_selecionados.includes(n.serial)) {
            return {
              ...n,
              status: "alugado",
              contrato_id: idContrato,
              contrato_numero: data.numero,
              historico: [...(n.historico || []), {
                data: agora,
                evento: "Saída para locação",
                contrato_numero: data.numero,
                motorista: data.motorista_entrega || "",
                usuario: currentUser?.full_name || currentUser?.email || "—",
              }],
            };
          }
          return n;
        });
        await base44.entities.Equipment.update(item.equipamento_id, { numeracoes: updatedNumeracoes });
      }
    };

    try {
      if (isEditing) {
        await base44.entities.Contract.update(contractId, data);
        await _atualizarSeriais(contractId);
        await base44.entities.ActivityLog.create({
          usuario: currentUser?.full_name || currentUser?.email || "—",
          acao: "Edição de contrato",
          modulo: "contrato",
          referencia_id: contractId,
          referencia_numero: data.numero,
          detalhes: `Contrato editado por ${currentUser?.full_name || currentUser?.email}. Valor total: R$ ${(data.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          data_hora: new Date().toISOString(),
        }).catch(() => {});
        toast.success("Contrato atualizado!");
        navigate(`/contratos/${contractId}`);
      } else {
        const created = await base44.entities.Contract.create(data);
        await _atualizarSeriais(created.id);
        await base44.entities.ActivityLog.create({
          usuario: currentUser?.full_name || currentUser?.email || "—",
          acao: "Criação de contrato",
          modulo: "contrato",
          referencia_id: created.id,
          referencia_numero: data.numero,
          detalhes: `Contrato #${data.numero} criado por ${currentUser?.full_name || currentUser?.email}. Cliente: ${data.client_nome}. Valor: R$ ${(data.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          data_hora: new Date().toISOString(),
        }).catch(() => {});
        toast.success(`Contrato #${data.numero} criado com sucesso!`);
        navigate(`/contratos/${created.id}`);
      }
    } catch (err) {
      showError(err, "contrato", "Não foi possível salvar o contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.client_id) { toast.error("Selecione um cliente"); return; }
    if (!form.data_inicio) { toast.error("Informe a data de início"); return; }
    // Bloquear se cadastro do cliente está vencido
    if (clientData && isCadastroVencido(clientData)) {
      toast.error("🚫 Cadastro do cliente vencido. É necessário atualizar os dados para continuar.");
      return;
    }
    // Bloquear se cliente tem restrição Serasa ou bloqueado — exibe dialog explicativo
    if (clientData) {
      const restricoes = getClienteRestricoes(clientData);
      if ((restricoes.serasa_restrito || restricoes.bloqueado) && !liberacaoBloqueio) {
        setShowBloqueioDialog(true);
        return;
      }
    }
    if (!form.solicitante_nome) { toast.error("Informe o solicitante do contrato (campo obrigatório)"); return; }
    // Obra só obrigatória se cliente tem obras cadastradas
    const clienteTemObras = getObras().length > 0;
    if (clienteTemObras && !form.obra_nome) { toast.error("Informe o nome da obra (campo obrigatório)"); return; }
    if ((form.itens || []).length === 0) { toast.error("Adicione ao menos um equipamento ao contrato"); return; }
    if ((form.itens || []).some((i) => !i.equipamento_id)) { toast.error("Há itens sem equipamento selecionado. Remova ou selecione o equipamento."); return; }
    if ((form.itens || []).some((i) => (i.quantidade_retirada || 0) <= 0)) { toast.error("Informe a quantidade de todos os equipamentos"); return; }

    // Validate stock availability + seriais
    for (const item of (form.itens || [])) {
      if (!item.equipamento_id) continue;
      const availQty = getAvailableQty(item.equipamento_id);
      if ((item.quantidade_retirada || 0) > availQty) {
        toast.error(`Estoque insuficiente para "${item.equipamento_nome}". Disponível: ${availQty}`);
        return;
      }
      if (item.controle_individual) {
        const qtd = Number(item.quantidade_retirada) || 1;
        const selecionados = item.seriais_selecionados || [];
        if (selecionados.length !== qtd) {
          toast.error(`Selecione exatamente ${qtd} serial(is) para "${item.equipamento_nome}". Selecionados: ${selecionados.length}`);
          return;
        }
      }
    }

    // Aviso de pendência financeira — pede confirmação antes de salvar
    if (clientData && getClienteRestricoes(clientData).pendencia && !pendingSave) {
      setShowPendenciaDialog(true);
      return;
    }
    setPendingSave(false);
    await executarSave();
  };

  return (
    <div>
      <PageHeader title={isEditing ? "Editar Contrato" : "Novo Contrato"}>
        <Button variant="outline" onClick={() => navigate("/contratos")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar</span>
        </Button>
      </PageHeader>

      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-heading">Dados do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Nº do Contrato</Label>
              <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="Gerado automaticamente" className="mt-1 bg-muted/30" readOnly />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Cliente *</Label>
              <div className="mt-1">
                <ClientSearch
                  value={form.client_nome}
                  onSelect={handleClientSelect}
                  placeholder="Digite o nome do cliente..."
                  userEmail={currentUser?.email}
                />
              </div>
              {form.client_nome && !isCadastroVencido(clientData) && (
                <p className="text-xs text-emerald-600 mt-1">✓ Selecionado: {form.client_nome}</p>
              )}
              {clientData && isCadastroVencido(clientData) && (
                <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Cadastro do cliente vencido.</strong> É necessário atualizar os dados para continuar criando o contrato.</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Data de Início *</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => update("data_inicio", e.target.value)} className="mt-1" />
            </div>
            {/* Sem Prazo toggle */}
            <div className="sm:col-span-3 flex items-center gap-3 p-2.5 rounded-xl bg-violet-50 border border-violet-200">
              <Checkbox
                id="sem_prazo"
                checked={!!form.sem_prazo}
                onCheckedChange={(v) => {
                  update("sem_prazo", v);
                  if (v) update("data_prevista_termino", "");
                }}
              />
              <label htmlFor="sem_prazo" className="text-sm font-medium text-violet-800 cursor-pointer flex items-center gap-1.5">
                <Infinity className="w-4 h-4" /> Contrato sem prazo determinado (contínuo)
              </label>
            </div>

            {!form.sem_prazo && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Prazo</Label>
                    <Input type="number" value={form.prazo_valor} onChange={(e) => update("prazo_valor", e.target.value)} className="mt-1" placeholder="1" />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.prazo_tipo} onValueChange={(v) => update("prazo_tipo", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dias">Dias</SelectItem>
                        <SelectItem value="meses">Meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Data Prev. Término (editável)</Label>
                  <Input type="date" value={form.data_prevista_termino} onChange={(e) => update("data_prevista_termino", e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <div className="sm:col-span-2 lg:col-span-2">
              <Label className="text-xs">Endereço de Entrega</Label>
              <Input value={form.endereco_entrega} onChange={(e) => update("endereco_entrega", e.target.value)} className="mt-1" />
              <AddressHistory
                addresses={clientAddresses}
                onSelect={(addr) => update("endereco_entrega", addr)}
                loading={loadingAddresses}
              />
            </div>
            {/* Tipo de entrega */}
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="text-xs mb-2 block">Tipo de Entrega</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => update("tipo_entrega", "entrega")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.tipo_entrega !== "retirada_loja" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <Truck className="w-4 h-4" /> Entrega na Obra
                </button>
                <button
                  type="button"
                  onClick={() => update("tipo_entrega", "retirada_loja")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.tipo_entrega === "retirada_loja" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <Store className="w-4 h-4" /> Retirada na Loja
                </button>
              </div>
              {form.tipo_entrega === "retirada_loja" && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                  <Store className="w-3 h-3" /> Retirada na loja — contrato criado já como <strong>Entregue</strong>. Permite controle financeiro e devolução futura.
                </p>
              )}
            </div>
            {form.tipo_entrega !== "retirada_loja" && (
            <div>
              <Label className="text-xs">Motorista de Entrega</Label>
              <div className="mt-1"><DriverSelect value={form.motorista_entrega} onChange={(v) => update("motorista_entrega", v)} /></div>
            </div>
            )}
            {/* Solicitante + Obra */}
            <div className="sm:col-span-2 lg:col-span-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Solicitante e Obra *</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Tipo de solicitante */}
                <div>
                  <Label className="text-xs">Tipo de Solicitante *</Label>
                  <Select value={form.solicitante_tipo} onValueChange={handleSolicitanteTipoChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Próprio Cliente</SelectItem>
                      <SelectItem value="empreiteiro">Empreiteiro</SelectItem>
                      <SelectItem value="pessoa_autorizada">Pessoa Autorizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Solicitante name — dropdown if options exist, else free text */}
                <div>
                  <Label className="text-xs">Nome do Solicitante *</Label>
                  {form.solicitante_tipo !== "cliente" && getSolicitanteOptions().length > 0 ? (
                    <Select value={form.solicitante_nome} onValueChange={(v) => update("solicitante_nome", v)}>
                      <SelectTrigger className={`mt-1 ${!form.solicitante_nome ? "border-amber-400" : ""}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getSolicitanteOptions().map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.solicitante_nome}
                      onChange={(e) => update("solicitante_nome", e.target.value)}
                      placeholder={form.solicitante_tipo === "cliente" ? "Nome do cliente..." : "Digite o nome..."}
                      className={`mt-1 ${!form.solicitante_nome ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                    />
                  )}
                  {!form.solicitante_nome && <p className="text-[10px] text-amber-600 mt-0.5">Campo obrigatório</p>}
                </div>

                {/* Obra — dropdown if obras exist, else free text */}
                <div>
                  <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Obra {getObras().length > 0 ? "*" : "(opcional)"}</Label>
                  {getObras().length > 0 ? (
                    <Select value={form.obra_nome} onValueChange={(v) => {
                      const obra = getObras().find((o) => o.nome_obra === v);
                      update("obra_nome", v);
                      if (obra?.endereco) update("obra_endereco", obra.endereco);
                    }}>
                      <SelectTrigger className={`mt-1 ${!form.obra_nome ? "border-amber-400" : ""}`}>
                        <SelectValue placeholder="Selecione a obra..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getObras().map((o) => (
                          <SelectItem key={o.nome_obra} value={o.nome_obra}>{o.nome_obra}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.obra_nome || ""} onChange={(e) => update("obra_nome", e.target.value)} className={`mt-1 ${!form.obra_nome ? "border-amber-400 focus-visible:ring-amber-400" : ""}`} placeholder="Ex: Edifício Alfa" />
                  )}
                  {getObras().length > 0 && !form.obra_nome && <p className="text-[10px] text-amber-600 mt-0.5">Campo obrigatório</p>}
                </div>

                <div>
                  <Label className="text-xs">Endereço da Obra</Label>
                  <Input value={form.obra_endereco || ""} onChange={(e) => update("obra_endereco", e.target.value)} className="mt-1" placeholder="Preenchido automaticamente ao selecionar obra" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-heading">Equipamentos</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAndaimeCalc((v) => !v)} className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50">
                <Calculator className="w-3.5 h-3.5" /> Andaime Fachadeiro
              </Button>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAndaimeCalc && (
              <div className="mb-4">
                <AndaimeCalculator
                  equipment={equipment}
                  settings={settings}
                  diasPeriodo={getDiasContratoAtual()}
                  onApply={applyAndaimeItens}
                />
              </div>
            )}
            {(form.itens || []).length === 0 && !showAndaimeCalc && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum equipamento adicionado</p>
            )}
            <div className="space-y-3">
              {(form.itens || []).map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-muted/30 grid sm:grid-cols-8 gap-3 items-end">
                  {/* Equipment selector with photo */}
                  <div className="sm:col-span-3 relative">
                    <Label className="text-xs">Equipamento</Label>
                    {item.equipamento_id ? (
                      <div className="mt-1 flex items-center gap-2 p-2 rounded-md border border-input bg-muted/20">
                        {item.equipamento_foto ? (
                          <img src={item.equipamento_foto} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                        ) : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="flex-1 text-sm truncate">{item.equipamento_nome}</span>
                        <button type="button" onClick={() => { updateItem(idx, "equipamento_id", ""); updateItem(idx, "equipamento_nome", ""); }} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <EquipmentItemSearch
                          equipment={equipment}
                          getAvailableQty={getAvailableQty}
                          onSelect={(e) => updateItem(idx, "equipamento_id", e.id)}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Qtd {item.equipamento_id && <span className="text-muted-foreground">(máx: {getAvailableQty(item.equipamento_id)})</span>}</Label>
                    <Input
                      type="number"
                      value={item.quantidade_retirada === 0 && document.activeElement?.dataset?.idx === String(idx) ? "" : item.quantidade_retirada}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "" || raw === "-") { updateItem(idx, "quantidade_retirada", raw); return; }
                        const qty = Number(raw);
                        const maxQty = item.equipamento_id ? getAvailableQty(item.equipamento_id) : 999;
                        if (qty > maxQty) { toast.error(`Estoque insuficiente. Disponível: ${maxQty}`); return; }
                        updateItem(idx, "quantidade_retirada", raw);
                      }}
                      onFocus={(e) => { if (e.target.value === "0") e.target.select(); }}
                      className={`mt-1 ${item.equipamento_id && Number(item.quantidade_retirada) > getAvailableQty(item.equipamento_id) ? "border-red-400" : ""}`}
                    />
                    {item.equipamento_id && item.quantidade_retirada > getAvailableQty(item.equipamento_id) && (
                      <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem estoque suficiente</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Tipo Cobr.</Label>
                    <Select
                      value={item.tipo_cobranca || "diario"}
                      onValueChange={(v) => updateItem(idx, "tipo_cobranca", v)}
                    >
                      <SelectTrigger className="mt-1 text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">
                      Valor Unit. (R$){" "}
                      <span className="text-muted-foreground font-normal">
                        {item.tipo_cobranca === "mensal" ? "mensal" : "diário"}
                      </span>
                    </Label>
                    <Input type="number" step="0.01" value={item.valor_unitario} onChange={(e) => updateItem(idx, "valor_unitario", e.target.value)} onFocus={(e) => { if (e.target.value === "0") e.target.select(); }} className="mt-1" placeholder="0,00" />
                  </div>
                  <div>
                    <Label className="text-xs">Desconto (R$)</Label>
                    <Input type="number" step="0.01" value={item.desconto} onChange={(e) => updateItem(idx, "desconto", e.target.value)} onFocus={(e) => { if (e.target.value === "0") e.target.select(); }} className="mt-1" placeholder="0,00" />
                  </div>
                  <div className="flex items-end">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="font-semibold text-sm">R$ {((item.quantidade_retirada * (parseFloat(item.valor_unitario) || 0)) - (parseFloat(item.desconto) || 0)).toFixed(2)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Seleção de seriais individuais */}
                  {item.controle_individual && item.equipamento_id && (() => {
                    const eq = equipment.find(e => e.id === item.equipamento_id);
                    if (!eq?.numeracoes?.length) return null;
                    const qtd = Number(item.quantidade_retirada) || 1;
                    const selecionados = item.seriais_selecionados || [];
                    return (
                      <div className="sm:col-span-8 p-3 rounded-xl bg-violet-50 border border-violet-200 space-y-2">
                        <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                          <ScanBarcode className="w-3.5 h-3.5" /> Selecionar Seriais — {item.equipamento_nome}
                          {selecionados.length === qtd
                            ? <span className="ml-1 text-emerald-600">✓ {selecionados.length}/{qtd} selecionados</span>
                            : <span className="ml-1 text-amber-600">⚠ {selecionados.length}/{qtd} selecionados</span>
                          }
                        </p>
                        <SerialSelector
                          numeracoes={eq.numeracoes}
                          selected={selecionados}
                          onChange={(v) => updateItem(idx, "seriais_selecionados", v)}
                          max={qtd}
                          serialsJaNaContrato={isEditing ? (selecionados) : []}
                        />
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Financial */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-heading">Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <FreightCalculator
                settings={settings}
                value={form.frete}
                onChange={(v) => update("frete", v)}
              />
            </div>
            <div>
              <Label className="text-xs">Sinal (R$)</Label>
              <Input type="number" step="0.01" value={form.sinal} onChange={(e) => update("sinal", e.target.value)} onFocus={(e) => { if (e.target.value === "0") e.target.select(); }} className="mt-1" placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Valor Pago (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_pago} onChange={(e) => update("valor_pago", e.target.value)} onFocus={(e) => { if (e.target.value === "0") e.target.select(); }} className="mt-1" placeholder="0,00" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              {calcInfo && (
                <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1.5 border border-border/50">
                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Detalhes do Cálculo</p>

                  {/* Grupo A */}
                  {calcInfo.grupoA.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-2 space-y-1">
                      <p className="font-semibold text-blue-700 text-[10px] uppercase">📦 Grupo A — Com cobrança mínima (por equipamento)</p>
                      {calcInfo.grupoA.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground truncate">{i.equipamento_nome} ×{i.quantidade_retirada}</span>
                          <span className="font-medium ml-2">{i._minimoAplicado ? "⚠ mín " : ""}R$ {(i._subtotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold border-t border-blue-200 pt-1 text-[10px]">
                        <span>Valor da locação ({getDiasContratoAtual()} dias):</span>
                        <span>R$ {calcInfo.valorBaseA.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-blue-700">
                        <span>Valor mínimo de locação:</span>
                        <span className="font-semibold">R$ {calcValorMinimoLocacao(calcInfo.grupoA, settings?.minimo_dias || 5, settings?.valor_minimo_contrato || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Grupo B */}
                  {calcInfo.grupoB.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-2 space-y-1">
                      <p className="font-semibold text-green-700 text-[10px] uppercase">📦 Grupo B — Dias reais de uso</p>
                      {calcInfo.grupoB.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground truncate">{i.equipamento_nome} ×{i.quantidade_retirada}</span>
                          <span className="font-medium ml-2">R$ {(i._subtotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold border-t border-green-200 pt-1 text-[10px]">
                        <span>Subtotal B:</span>
                        <span>R$ {calcInfo.somaB.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Desconto automático */}
                  {calcInfo.descontoInfo && (
                    <div className="bg-amber-50 rounded-lg p-2">
                      <p className="font-semibold text-amber-700 text-[10px]">🎁 {calcInfo.descontoInfo.descricao}</p>
                      <div className="flex justify-between text-[10px] mt-0.5">
                        <span className="text-muted-foreground">Desconto automático:</span>
                        <span className="font-semibold text-amber-700">− R$ {calcInfo.descontoInfo.valorDesconto.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Sugestão próxima faixa */}
                  {calcInfo.proximaFaixa && !calcInfo.descontoInfo && (
                    <p className="text-[10px] text-emerald-600 bg-emerald-50 rounded-lg p-2">
                      💡 Com {calcInfo.proximaFaixa.dias_minimos} dias ou mais, você garante {calcInfo.proximaFaixa.tipo === "percentual" ? `${calcInfo.proximaFaixa.valor}%` : `R$ ${calcInfo.proximaFaixa.valor?.toFixed(2)}`} de desconto automático!
                    </p>
                  )}
                </div>
              )}
              <div className="p-3 rounded-xl bg-primary/5">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold font-heading">R$ {(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">Saldo: R$ {(form.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              📍 Localização da Entrega / Obra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LocationField
              value={{
                location_url: form.location_url || "",
                latitude: form.latitude || "",
                longitude: form.longitude || "",
                location_notes: form.location_notes || "",
              }}
              onChange={(loc) => {
                setForm((prev) => ({ ...prev, ...loc }));
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={3} className="mt-1" />
          </CardContent>
        </Card>

        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[160px]">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Contrato"}
          </Button>
        </div>
      </div>

      <PendenciaFinanceiraDialog
        open={showPendenciaDialog}
        onConfirm={() => { setShowPendenciaDialog(false); setPendingSave(true); handleSave(); }}
        onCancel={() => setShowPendenciaDialog(false)}
      />

      <BloqueioClienteDialog
        open={showBloqueioDialog}
        onClose={() => setShowBloqueioDialog(false)}
        onLiberado={(tipo, dados) => {
          setLiberacaoBloqueio({ tipo, ...dados });
          setShowBloqueioDialog(false);
          // Aguarda state aplicar antes de salvar
          setTimeout(() => handleSave(), 50);
        }}
        cliente={clientData}
        tipoOperacao="contrato"
        currentUser={currentUser}
      />
    </div>
  );
}