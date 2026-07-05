import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ClientSearch from "../components/ClientSearch";
import LocationField from "../components/LocationField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, ShieldAlert, PenLine, Package } from "lucide-react";
import AddressHistory from "../components/AddressHistory";
import { extractAddressesFromDocs } from "../lib/recentAddresses";
import { isCadastroVencido } from "../lib/clientValidade";
import { getClienteRestricoes, PendenciaFinanceiraDialog } from "../components/client/ClientStatusAlert";
import BloqueioClienteDialog from "../components/client/BloqueioClienteDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DriverSelect from "../components/DriverSelect";
import { toast } from "sonner";
import { showError, SAVE_ERRORS } from "../lib/errorHandler";
import { getNextNumber } from "../lib/sequentialNumber";
import SignatureDialog from "../components/SignatureDialog";
import { format } from "date-fns";

export default function ServiceOrderForm() {
  const navigate = useNavigate();
  const pathParts = window.location.pathname.split("/");
  const editId = pathParts.includes("editar") ? pathParts[pathParts.length - 1] : null;
  const osId = !editId && pathParts[pathParts.length - 1] !== "nova" ? pathParts[pathParts.length - 1] : null;
  const actualId = editId || osId;
  const isEditing = !!actualId;

  // Datas padrão para nova OS: entrega = hoje, recolha = hoje + 10 dias
  const getDefaultDates = () => {
    const hoje = new Date();
    hoje.setHours(8, 0, 0, 0);
    const recolha = new Date(hoje);
    recolha.setDate(recolha.getDate() + 10);
    // Formata para datetime-local (YYYY-MM-DDTHH:mm)
    const toLocal = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}T08:00`;
    };
    return { data_entrega: toLocal(hoje), data_recolhimento: toLocal(recolha) };
  };

  const isNewOS = !editId && !osId;
  const [form, setForm] = useState(() => {
    const defaultDates = isNewOS ? getDefaultDates() : { data_entrega: "", data_recolhimento: "" };
    return {
      numero: "", client_id: "", client_nome: "", local_entrega: "",
      motorista_entrega: "", motorista_recolhimento: "",
      ...defaultDates,
      hora_tipo: "sem_horario", hora_periodo: "",
      hora_recolha_tipo: "sem_horario", hora_recolha_periodo: "",
      valor: "", valor_unitario: "", status: "pendente", status_pagamento: "pendente",
      tipo_cacamba: "", cacamba_equipamento_id: "",
      quantidade_cacambas: 1, quantidade_ativa: 1, quantidade_recolhida: 0,
      tipo_os: "padrao", os_origem_id: "", observacoes: "",
    };
  });
  // _originalData guarda todos os campos do registro salvo para preservar assinaturas, fotos, históricos
  const [_originalData, setOriginalData] = useState({});
  const [ossDoCliente, setOssDoCliente] = useState([]);
  const [cacambas, setCacambas] = useState([]); // equipamentos tipo cacamba
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [cadastroVencido, setCadastroVencido] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [signatureDialog, setSignatureDialog] = useState(false);
  const [creatorSignature, setCreatorSignature] = useState(null);
  const [hasUserSignature, setHasUserSignature] = useState(false);
  const [showPendenciaDialog, setShowPendenciaDialog] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [showBloqueioDialog, setShowBloqueioDialog] = useState(false);
  const [liberacaoBloqueio, setLiberacaoBloqueio] = useState(null);
  const [clientAddresses, setClientAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setCurrentUser(u);
      if (u?.assinatura_usuario) {
        setCreatorSignature(u.assinatura_usuario);
        setHasUserSignature(true);
      }
    }).catch(() => {});
    // Carrega caçambas cadastradas no módulo de equipamentos
    base44.entities.Equipment.list("-nome", 200).then((equips) => {
      const cacs = equips.filter(e => {
        const tipos = Array.isArray(e.tipos) ? e.tipos : [e.tipo];
        return tipos.includes("cacamba");
      });
      setCacambas(cacs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (actualId) {
      base44.entities.ServiceOrder.filter({ id: actualId }).then(([os]) => {
        if (os) {
          // Salva todos os dados originais para preservar campos não editáveis
          setOriginalData(os);
          setForm((prev) => {
            const updated = { ...prev };
            Object.keys(prev).forEach((k) => {
              if (os[k] !== undefined && os[k] !== null) updated[k] = os[k];
            });
            // Garante campos novos com fallback
            if (!updated.quantidade_cacambas) updated.quantidade_cacambas = 1;
            if (updated.quantidade_ativa === undefined || updated.quantidade_ativa === null) updated.quantidade_ativa = updated.quantidade_cacambas || 1;
            if (!updated.valor_unitario) updated.valor_unitario = updated.valor || "";
            return updated;
          });
        }
      });
    }
  }, [actualId]);

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Ao definir data_entrega na CRIAÇÃO: recalcula data de recolhimento (+10 dias)
      if (field === "data_entrega" && !actualId && value) {
        try {
          const entrega = new Date(value);
          if (!isNaN(entrega)) {
            const recolha = new Date(entrega);
            recolha.setDate(recolha.getDate() + 10);
            const yyyy = recolha.getFullYear();
            const mm = String(recolha.getMonth() + 1).padStart(2, "0");
            const dd = String(recolha.getDate()).padStart(2, "0");
            next.data_recolhimento = `${yyyy}-${mm}-${dd}T08:00`;
          }
        } catch (_) {}
      }
      return next;
    });
  };

  const handleSelectCacamba = (equipId) => {
    if (!equipId || equipId === "__manual__") {
      update("cacamba_equipamento_id", "");
      return;
    }
    const equip = cacambas.find(c => c.id === equipId);
    if (!equip) return;
    const qty = form.quantidade_cacambas || 1;
    const valorUnit = equip.valor_diario || equip.valor_mensal || 0;
    setForm(prev => ({
      ...prev,
      cacamba_equipamento_id: equipId,
      tipo_cacamba: equip.nome,
      valor_unitario: valorUnit,
      valor: (valorUnit * qty).toFixed(2),
      quantidade_ativa: qty,
    }));
  };

  const handleQtdChange = (qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    const valorUnit = parseFloat(form.valor_unitario) || 0;
    setForm(prev => ({
      ...prev,
      quantidade_cacambas: q,
      quantidade_ativa: q,
      valor: valorUnit > 0 ? (valorUnit * q).toFixed(2) : prev.valor,
    }));
  };

  const handleClientSelect = async (client) => {
    const addr = [client.endereco_entrega_rua, client.endereco_entrega_numero, client.endereco_entrega_bairro, client.endereco_entrega_cidade]
      .filter(Boolean).join(", ");
    setForm((prev) => ({
      ...prev, client_id: client.id, client_nome: client.nome_razao_social,
      client_codigo: client.codigo_cliente || "",
      client_etiquetas: client.etiquetas || [],
      local_entrega: addr || prev.local_entrega,
    }));
    setClientData(client);
    const vencido = isCadastroVencido(client);
    setCadastroVencido(vencido);
    setLiberacaoBloqueio(null); // reset ao trocar cliente
    const restricoes = getClienteRestricoes(client);
    if (restricoes.serasa_restrito || restricoes.bloqueado) {
      toast.warning("⚠ Este cliente possui restrições. Verifique antes de prosseguir.");
    } else if (restricoes.pendencia) {
      toast.warning("⚠ Cliente com pendência financeira. Será necessário confirmar para prosseguir.");
    }
    if (vencido) toast.error("🚫 Cadastro do cliente VENCIDO. Atualize os dados para continuar.");
    // Carregar OS ativas e histórico de endereços
    setLoadingAddresses(true);
    const [oss, osHistorico] = await Promise.all([
      base44.entities.ServiceOrder.filter({ client_id: client.id }),
      base44.entities.ServiceOrder.filter({ client_id: client.id }),
    ]);
    setOssDoCliente(oss.filter((o) => !["finalizada", "cancelada"].includes(o.status)));
    const addrs = extractAddressesFromDocs(osHistorico, "local_entrega");
    if (addr && !addrs.includes(addr)) addrs.unshift(addr);
    setClientAddresses([...new Set(addrs)].slice(0, 8));
    setLoadingAddresses(false);
  };

  const handleSave = async () => {
    if (!form.client_id || !form.local_entrega) {
      toast.error("Preencha cliente e local de entrega");
      return;
    }
    if (cadastroVencido) {
      toast.error("🚫 Cadastro do cliente vencido. É necessário atualizar os dados para continuar.");
      return;
    }
    // Bloquear se cliente tem restrição Serasa ou está bloqueado — exibe dialog explicativo
    if (clientData) {
      const restricoes = getClienteRestricoes(clientData);
      if ((restricoes.serasa_restrito || restricoes.bloqueado) && !liberacaoBloqueio) {
        setShowBloqueioDialog(true);
        return;
      }
      // Aviso de pendência financeira — pede confirmação
      if (restricoes.pendencia && !pendingSave) {
        setShowPendenciaDialog(true);
        return;
      }
    }
    setPendingSave(false);
    // Na criação, exige assinatura do responsável
    if (!actualId && !creatorSignature) {
      toast.error("É necessário assinar como responsável pela OS antes de salvar.");
      setSignatureDialog(true);
      return;
    }
    setSaving(true);
    const qty = parseInt(form.quantidade_cacambas) || 1;
    const data = {
      ...form,
      valor: parseFloat(form.valor) || 0,
      valor_unitario: parseFloat(form.valor_unitario) || 0,
      quantidade_cacambas: qty,
      quantidade_ativa: isEditing ? (form.quantidade_ativa ?? qty) : qty,
      quantidade_recolhida: form.quantidade_recolhida || 0,
      // Snapshot definitivo do código do cliente — independente de join
      customer_code: form.client_codigo || "",
    };
    if (!data.numero) {
      const num = await getNextNumber("os");
      data.numero = String(num);
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

    // Preserva campos não editáveis do registro original ao atualizar
    if (actualId) {
      const CAMPOS_PRESERVAR_OS = [
        "assinatura_cliente", "assinatura_data",
        "assinatura_entrega_url", "assinatura_entrega_motorista", "assinatura_entrega_data",
        "assinatura_devolucao_url", "assinatura_devolucao_motorista", "assinatura_devolucao_data",
        "assinatura_pendente", "assinatura_pendente_motorista", "assinatura_pendente_data",
        "locador_nome", "locador_assinatura", "locador_data",
        "fotos",
        "historico_recolhas", "historico_trocas", "historico_devolucoes",
        "criado_por",
        "quantidade_recolhida", "quantidade_ativa",
        "os_troca_id",
      ];
      CAMPOS_PRESERVAR_OS.forEach((campo) => {
        if (_originalData[campo] !== undefined && data[campo] === undefined) {
          data[campo] = _originalData[campo];
        }
      });
    }

    try {
      if (actualId) {
        await base44.entities.ServiceOrder.update(actualId, data);
        toast.success("OS atualizada com sucesso!");
        navigate(`/ordens-servico/${actualId}`);
      } else {
        // Salva assinatura do criador
        data.locador_nome = currentUser?.full_name || currentUser?.email || "";
        data.locador_assinatura = creatorSignature;
        data.locador_data = format(new Date(), "dd/MM/yyyy HH:mm");
        const created = await base44.entities.ServiceOrder.create(data);

        // ✅ Troca de Caçamba: solicitar recolha automática na OS original e vincular
        if (data.tipo_os === "troca_cacamba" && data.os_origem_id) {
          try {
            const [osOrigem] = await base44.entities.ServiceOrder.filter({ id: data.os_origem_id });
            if (osOrigem) {
              const novaSolicitacao = {
                tipo: "solicitacao",
                data_solicitacao: format(new Date(), "dd/MM/yyyy HH:mm"),
                data_prevista: data.data_entrega ? data.data_entrega.substring(0, 10) : "",
                quantidade: osOrigem.quantidade_ativa ?? (osOrigem.quantidade_cacambas || 1),
                motorista: data.motorista_entrega || "—",
                veiculo: "—",
                usuario: data.locador_nome || "",
                observacao: `Recolha automática — Troca de caçamba. Nova OS: #${data.numero}`,
                confirmada: false,
              };
              await base44.entities.ServiceOrder.update(data.os_origem_id, {
                status: "aguardando_recolha",
                historico_recolhas: [...(osOrigem.historico_recolhas || []), novaSolicitacao],
                // Vincula a nova OS ao ID desta troca
                os_troca_id: created.id,
              });
              toast.info(`Recolha da OS original #${osOrigem.numero} solicitada automaticamente.`);
            }
          } catch (_) {
            // Não bloqueia a criação se a OS original não for encontrada
          }
        }

        toast.success(`OS #${data.numero} criada com sucesso!`);
        navigate(`/ordens-servico/${created.id}`);
      }
    } catch (err) {
      showError(err, "ordem de serviço", "Não foi possível salvar a OS");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={isEditing ? "Editar OS" : "Nova Ordem de Serviço"}>
        <Button variant="outline" onClick={() => navigate("/ordens-servico")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar</span>
        </Button>
      </PageHeader>

      <div className="space-y-6 max-w-4xl">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Dados da OS</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Nº da OS</Label>
              <Input value={form.numero} placeholder="Gerado automaticamente" readOnly className="mt-1 bg-muted/30" />
            </div>
            <div>
              <Label className="text-xs">Cliente *</Label>
              <div className="mt-1">
                <ClientSearch value={form.client_nome} onSelect={handleClientSelect} placeholder="Digite o nome do cliente..." userEmail={currentUser?.email} />
              </div>
              {form.client_nome && !cadastroVencido && <p className="text-xs text-emerald-600 mt-1">✓ {form.client_nome}</p>}
              {cadastroVencido && (
                <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Cadastro vencido.</strong> É necessário atualizar os dados do cliente para criar uma nova OS.</span>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Local de Entrega *</Label>
              <Input value={form.local_entrega} onChange={(e) => update("local_entrega", e.target.value)} className="mt-1" />
              <AddressHistory
                addresses={clientAddresses}
                onSelect={(addr) => update("local_entrega", addr)}
                loading={loadingAddresses}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo de OS</Label>
              <Select value={form.tipo_os} onValueChange={(v) => update("tipo_os", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="troca_cacamba" disabled={ossDoCliente.length === 0}>
                    🔄 Troca de Caçamba {ossDoCliente.length === 0 ? "(sem OS ativa)" : `(${ossDoCliente.length} OS ativa)`}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_os === "troca_cacamba" && ossDoCliente.length > 0 && (
              <div>
                <Label className="text-xs">OS de Origem (Troca) *</Label>
                <Select value={form.os_origem_id} onValueChange={(v) => update("os_origem_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar OS original..." /></SelectTrigger>
                  <SelectContent>
                    {ossDoCliente.map((o) => <SelectItem key={o.id} value={o.id}>OS #{o.numero} — {o.local_entrega}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Seleção de caçamba via equipamentos */}
            <div className="sm:col-span-2">
              <Label className="text-xs">Tipo de Caçamba</Label>
              {cacambas.length > 0 ? (
                <Select
                  value={form.cacamba_equipamento_id || "__manual__"}
                  onValueChange={handleSelectCacamba}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar caçamba..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">✏️ Digitação manual</SelectItem>
                    {cacambas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {(c.valor_diario || c.valor_mensal) ? ` — R$ ${(c.valor_diario || c.valor_mensal).toFixed(2)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {(!form.cacamba_equipamento_id || !cacambas.length) && (
                <Input
                  value={form.tipo_cacamba}
                  onChange={(e) => update("tipo_cacamba", e.target.value)}
                  placeholder="Ex: Caçamba 5m³..."
                  className={cacambas.length > 0 ? "mt-2" : "mt-1"}
                />
              )}
              {cacambas.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Cadastre caçambas em <strong>Equipamentos → tipo Caçamba</strong> para preenchimento automático do valor
                </p>
              )}
            </div>

            {/* Quantidade + Valor Unitário + Total */}
            <div>
              <Label className="text-xs">Quantidade de Caçambas</Label>
              <Input
                type="number"
                min="1"
                value={form.quantidade_cacambas}
                onChange={(e) => handleQtdChange(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Valor Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_unitario}
                onChange={(e) => {
                  const vUnit = parseFloat(e.target.value) || 0;
                  const qty = parseInt(form.quantidade_cacambas) || 1;
                  setForm(prev => ({
                    ...prev,
                    valor_unitario: e.target.value,
                    valor: (vUnit * qty).toFixed(2),
                  }));
                }}
                className="mt-1"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label className="text-xs">Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => update("valor", e.target.value)}
                className="mt-1 font-semibold"
                placeholder="0,00"
              />
              {parseFloat(form.valor_unitario) > 0 && parseInt(form.quantidade_cacambas) > 1 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {parseInt(form.quantidade_cacambas)}x R$ {parseFloat(form.valor_unitario).toFixed(2)} = R$ {(parseFloat(form.valor_unitario) * parseInt(form.quantidade_cacambas)).toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Logística</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Motorista de Entrega</Label>
              <div className="mt-1"><DriverSelect value={form.motorista_entrega} onChange={(v) => update("motorista_entrega", v)} /></div>
            </div>
            <div>
              <Label className="text-xs">Motorista de Recolhimento</Label>
              <div className="mt-1"><DriverSelect value={form.motorista_recolhimento} onChange={(v) => update("motorista_recolhimento", v)} /></div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Tipo de Horário da Entrega</Label>
              <Select value={form.hora_tipo || "especifico"} onValueChange={(v) => update("hora_tipo", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especifico">⏰ Horário específico</SelectItem>
                  <SelectItem value="periodo">🌅 Por período (manhã/tarde/noite)</SelectItem>
                  <SelectItem value="sem_horario">🚫 Sem horário definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.hora_tipo === "especifico" || !form.hora_tipo) && (
              <div>
                <Label className="text-xs">Data/Hora de Entrega</Label>
                <Input type="datetime-local" value={form.data_entrega} onChange={(e) => update("data_entrega", e.target.value)} className="mt-1" />
              </div>
            )}
            {form.hora_tipo === "periodo" && (
              <div>
                <Label className="text-xs">Data de Entrega</Label>
                <Input type="date" value={form.data_entrega ? form.data_entrega.substring(0,10) : ""} onChange={(e) => update("data_entrega", e.target.value)} className="mt-1" />
              </div>
            )}
            {form.hora_tipo === "periodo" && (
              <div>
                <Label className="text-xs">Período</Label>
                <Select value={form.hora_periodo || ""} onValueChange={(v) => update("hora_periodo", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o período..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">🌅 Manhã</SelectItem>
                    <SelectItem value="tarde">☀️ Tarde</SelectItem>
                    <SelectItem value="noite">🌙 Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.hora_tipo === "sem_horario" && (
              <div>
                <Label className="text-xs">Data de Entrega</Label>
                <Input type="date" value={form.data_entrega ? form.data_entrega.substring(0,10) : ""} onChange={(e) => update("data_entrega", e.target.value)} className="mt-1" />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label className="text-xs">Tipo de Horário do Recolhimento</Label>
              <Select value={form.hora_recolha_tipo || "especifico"} onValueChange={(v) => update("hora_recolha_tipo", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especifico">⏰ Horário específico</SelectItem>
                  <SelectItem value="periodo">🌅 Por período (manhã/tarde/noite)</SelectItem>
                  <SelectItem value="sem_horario">🚫 Sem horário definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.hora_recolha_tipo === "especifico" || !form.hora_recolha_tipo) && (
              <div>
                <Label className="text-xs">Data/Hora de Recolhimento</Label>
                <Input type="datetime-local" value={form.data_recolhimento} onChange={(e) => update("data_recolhimento", e.target.value)} className="mt-1" />
              </div>
            )}
            {form.hora_recolha_tipo === "periodo" && (
              <div>
                <Label className="text-xs">Data de Recolhimento</Label>
                <Input type="date" value={form.data_recolhimento ? form.data_recolhimento.substring(0, 10) : ""} onChange={(e) => update("data_recolhimento", e.target.value)} className="mt-1" />
              </div>
            )}
            {form.hora_recolha_tipo === "periodo" && (
              <div>
                <Label className="text-xs">Período de Recolhimento</Label>
                <Select value={form.hora_recolha_periodo || ""} onValueChange={(v) => update("hora_recolha_periodo", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o período..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">🌅 Manhã</SelectItem>
                    <SelectItem value="tarde">☀️ Tarde</SelectItem>
                    <SelectItem value="noite">🌙 Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.hora_recolha_tipo === "sem_horario" && (
              <div>
                <Label className="text-xs">Data de Recolhimento</Label>
                <Input type="date" value={form.data_recolhimento ? form.data_recolhimento.substring(0, 10) : ""} onChange={(e) => update("data_recolhimento", e.target.value)} className="mt-1" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">📍 Localização da Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationField
              value={{
                location_url: form.location_url || "",
                latitude: form.latitude || "",
                longitude: form.longitude || "",
                location_notes: form.location_notes || "",
              }}
              onChange={(loc) => setForm((prev) => ({ ...prev, ...loc }))}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={3} className="mt-1" />
          </CardContent>
        </Card>

        {/* Assinatura do responsável — apenas na criação */}
        {!actualId && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" /> Assinatura do Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creatorSignature ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <img src={creatorSignature} alt="Assinatura" className="h-14 object-contain border border-emerald-200 rounded bg-white px-2" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">✓ Assinatura do Responsável</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.full_name || currentUser?.email}</p>
                    {hasUserSignature && <p className="text-xs text-blue-600">Assinatura cadastrada em Configurações</p>}
                  </div>
                  {!hasUserSignature && (
                    <button onClick={() => setCreatorSignature(null)} className="ml-auto text-xs text-destructive hover:underline">Refazer</button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <p className="font-semibold mb-1">⚠ Nenhuma assinatura cadastrada</p>
                    <p>Cadastre sua assinatura em <strong>Configurações → Minha Assinatura</strong> para não precisar assinar manualmente.</p>
                  </div>
                  <Button variant="outline" onClick={() => setSignatureDialog(true)} className="gap-2 border-primary text-primary hover:bg-primary/5">
                    <PenLine className="w-4 h-4" /> Assinar Manualmente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar OS"}
          </Button>
        </div>
      </div>

      <SignatureDialog
        open={signatureDialog}
        onOpenChange={setSignatureDialog}
        onConfirm={(dataUrl) => { setCreatorSignature(dataUrl); setSignatureDialog(false); }}
        title="Assinatura do Responsável pela OS"
      />

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
          setTimeout(() => handleSave(), 50);
        }}
        cliente={clientData}
        tipoOperacao="os"
        currentUser={currentUser}
      />
    </div>
  );
}