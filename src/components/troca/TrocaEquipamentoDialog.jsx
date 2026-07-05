import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeftRight, Plus, Minus, Package, RefreshCcw, DollarSign } from "lucide-react";
import SignatureDialog from "../SignatureDialog";
import { gerarReciboDeTroca } from "../../lib/generateTrocaPDF";
import EquipamentoSearchInput from "./EquipamentoSearchInput";

const MOTIVOS = [
  { value: "defeito", label: "Defeito" },
  { value: "avaria", label: "Avaria" },
  { value: "manutencao", label: "Manutenção" },
  { value: "erro_operacional", label: "Erro Operacional" },
  { value: "solicitacao_cliente", label: "Solicitação do Cliente" },
  { value: "troca_preventiva", label: "Troca Preventiva" },
  { value: "equipamento_incompativel", label: "Equipamento Incompatível" },
  { value: "outro", label: "Outro" },
];

const TIPOS_TROCA = [
  { value: "em_campo", label: "Troca em Campo (motorista)" },
  { value: "na_loja", label: "Troca na Loja (balcão)" },
];

export default function TrocaEquipamentoDialog({ open, onClose, doc, docTipo = "contrato", client, settings, currentUser, onSaved }) {
  const [tipoTroca, setTipoTroca] = useState("na_loja");
  const [motivo, setMotivo] = useState("defeito");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [motorista, setMotorista] = useState("");
  const [dataTroca, setDataTroca] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itensSaindo, setItensSaindo] = useState([]);
  const [itensEntrando, setItensEntrando] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [signDialog, setSignDialog] = useState(false);
  const [assinatura, setAssinatura] = useState(null);
  // "manter" = mantém valor atual | "atualizar" = usa valor do novo equipamento
  const [regraCobranca, setRegraCobranca] = useState("manter");

  const itensDoc = docTipo === "contrato"
    ? (doc?.itens || []).filter(i => ((i.quantidade_retirada || 0) - (i.quantidade_devolvida || 0)) > 0)
    : doc?.tipo_cacamba
      ? [{ equipamento_nome: `Caçamba: ${doc.tipo_cacamba}`, quantidade_retirada: doc?.quantidade_cacambas || 1, quantidade_devolvida: 0, equipamento_id: doc?.cacamba_equipamento_id }]
      : [];

  useEffect(() => {
    if (!open) return;
    setTipoTroca("na_loja");
    setMotivo("defeito");
    setMotivoOutro("");
    setMotorista("");
    setDataTroca("");
    setObservacoes("");
    setAssinatura(null);
    setRegraCobranca("manter");

    const initialSaindo = itensDoc.map((item, idx) => ({
      idx,
      equipamento_id: item.equipamento_id || "",
      equipamento_nome: item.equipamento_nome || "Equipamento",
      quantidade: 0,
      max: (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0),
      valor_unitario: item.valor_unitario || 0,
      valor_diario: item.valor_diario || 0,
    }));
    setItensSaindo(initialSaindo);
    setItensEntrando([{ equipamento_id: "", equipamento_nome: "", quantidade: 1, eq_obj: null, valor_diario: 0, valor_unitario: 0 }]);

    base44.entities.Driver.filter({ status: "ativo" }).then(setDrivers).catch(() => {});
    base44.entities.Equipment.filter({ ativo: true }).then(setEquipamentos).catch(() => {});
  }, [open, doc?.id]);

  const itensSaindoSelecionados = itensSaindo.filter(i => i.quantidade > 0);
  const itensEntrandoValidos = itensEntrando.filter(i => i.quantidade > 0 && (i.equipamento_id || i.equipamento_nome));

  const canProceed = itensSaindoSelecionados.length > 0 && itensEntrandoValidos.length > 0 && motivo;

  // Valor original do contrato (primeiro item saindo)
  const valorAtual = itensSaindoSelecionados[0]?.valor_diario || itensSaindoSelecionados[0]?.valor_unitario || 0;
  const valorNovo = itensEntrandoValidos[0]?.eq_obj?.valor_diario || itensEntrandoValidos[0]?.eq_obj?.valor_mensal || 0;

  const handleSelectEqEntrando = (idx, eq) => {
    setItensEntrando(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (!eq) return { ...item, equipamento_id: "", equipamento_nome: "", eq_obj: null, valor_diario: 0, valor_unitario: 0 };
      return {
        ...item,
        equipamento_id: eq.id,
        equipamento_nome: eq.nome,
        eq_obj: eq,
        valor_diario: eq.valor_diario || 0,
        valor_unitario: eq.valor_mensal || 0,
      };
    }));
  };

  const addItemEntrando = () => {
    setItensEntrando(prev => [...prev, { equipamento_id: "", equipamento_nome: "", quantidade: 1, eq_obj: null, valor_diario: 0, valor_unitario: 0 }]);
  };

  const removeItemEntrando = (idx) => {
    setItensEntrando(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (dataUrlAssinatura = null) => {
    if (!canProceed) { toast.error("Selecione os itens que estão saindo e os que estão entrando."); return; }
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const nowFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
      const motivoFinal = motivo === "outro" ? (motivoOutro || "Outro") : (MOTIVOS.find(m => m.value === motivo)?.label || motivo);

      let assinaturaUrl = dataUrlAssinatura;
      if (dataUrlAssinatura) {
        try {
          const blob = await fetch(dataUrlAssinatura).then(r => r.blob());
          const file = new File([blob], `assinatura_troca_${doc.id}_${Date.now()}.png`, { type: "image/png" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          assinaturaUrl = file_url;
        } catch (_) {}
      }

      // Calcula alteração de cobrança
      let alteracaoCobranca = null;
      if (regraCobranca === "atualizar" && docTipo === "contrato" && itensEntrandoValidos[0]?.eq_obj) {
        const novoEq = itensEntrandoValidos[0].eq_obj;
        alteracaoCobranca = {
          regra: "atualizar",
          valor_anterior_diario: valorAtual,
          valor_novo_diario: novoEq.valor_diario || 0,
          valor_anterior_mensal: itensSaindoSelecionados[0]?.valor_unitario || 0,
          valor_novo_mensal: novoEq.valor_mensal || 0,
        };
      } else {
        alteracaoCobranca = { regra: "manter" };
      }

      const dataExecucao = dataTroca || nowFormatted;
      const registro = {
        data: nowFormatted,
        data_agendada: dataTroca || "",
        tipo: tipoTroca,
        motivo: motivoFinal,
        motorista: motorista || "",
        usuario: currentUser?.full_name || currentUser?.email || "—",
        observacao: observacoes || "",
        itens_saindo: itensSaindoSelecionados.map(i => ({ nome: i.equipamento_nome, quantidade: i.quantidade, equipamento_id: i.equipamento_id })),
        itens_entrando: itensEntrandoValidos.map(i => ({ nome: i.equipamento_nome, quantidade: i.quantidade, equipamento_id: i.equipamento_id })),
        assinatura_url: assinaturaUrl || "",
        // "pendente" = agendada futura, "concluida" = executada agora
        status: dataTroca && dataTroca > format(new Date(), "yyyy-MM-dd") ? "pendente" : "concluida",
        alteracao_cobranca: alteracaoCobranca,
      };

      // Atualiza estoque: saindo → disponível, entrando → alugado
      for (const item of itensSaindoSelecionados) {
        if (!item.equipamento_id) continue;
        try {
          const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
          if (!eq) continue;
          await base44.entities.Equipment.update(item.equipamento_id, {
            quantidade_disponivel: (eq.quantidade_disponivel || 0) + item.quantidade,
            quantidade_alugada: Math.max(0, (eq.quantidade_alugada || 0) - item.quantidade),
          });
        } catch (_) {}
      }
      for (const item of itensEntrandoValidos) {
        if (!item.equipamento_id) continue;
        try {
          const [eq] = await base44.entities.Equipment.filter({ id: item.equipamento_id });
          if (!eq) continue;
          await base44.entities.Equipment.update(item.equipamento_id, {
            quantidade_disponivel: Math.max(0, (eq.quantidade_disponivel || 0) - item.quantidade),
            quantidade_alugada: (eq.quantidade_alugada || 0) + item.quantidade,
          });
        } catch (_) {}
      }

      // Monta novos itens do contrato
      let novosItens = doc?.itens ? [...doc.itens] : [];
      if (docTipo === "contrato") {
        for (const itemSaindo of itensSaindoSelecionados) {
          const idx = novosItens.findIndex(i => i.equipamento_id === itemSaindo.equipamento_id);
          if (idx >= 0) {
            novosItens[idx] = {
              ...novosItens[idx],
              quantidade_retirada: Math.max(0, (novosItens[idx].quantidade_retirada || 0) - itemSaindo.quantidade),
            };
          }
        }
        for (const itemEntrando of itensEntrandoValidos) {
          const idx = novosItens.findIndex(i => i.equipamento_id === itemEntrando.equipamento_id);
          if (idx >= 0) {
            // Se "atualizar", aplica novo valor ao item existente
            const novoValorDiario = regraCobranca === "atualizar" && itemEntrando.eq_obj
              ? (itemEntrando.eq_obj.valor_diario || novosItens[idx].valor_diario)
              : novosItens[idx].valor_diario;
            const novoValorUnitario = regraCobranca === "atualizar" && itemEntrando.eq_obj
              ? (itemEntrando.eq_obj.valor_mensal || novosItens[idx].valor_unitario)
              : novosItens[idx].valor_unitario;
            novosItens[idx] = {
              ...novosItens[idx],
              quantidade_retirada: (novosItens[idx].quantidade_retirada || 0) + itemEntrando.quantidade,
              valor_diario: novoValorDiario,
              valor_unitario: novoValorUnitario,
            };
          } else if (itemEntrando.equipamento_id) {
            try {
              const [eq] = await base44.entities.Equipment.filter({ id: itemEntrando.equipamento_id });
              if (eq) {
                const valDiario = regraCobranca === "manter" ? valorAtual : (eq.valor_diario || 0);
                const valUnitario = regraCobranca === "manter"
                  ? (itensSaindoSelecionados[0]?.valor_unitario || 0)
                  : (eq.valor_mensal || 0);
                novosItens.push({
                  equipamento_id: eq.id,
                  equipamento_nome: eq.nome,
                  codigo: eq.codigo || "",
                  quantidade_retirada: itemEntrando.quantidade,
                  quantidade_devolvida: 0,
                  valor_unitario: valUnitario,
                  valor_diario: valDiario,
                  desconto: 0,
                });
              }
            } catch (_) {
              novosItens.push({
                equipamento_id: itemEntrando.equipamento_id,
                equipamento_nome: itemEntrando.equipamento_nome,
                quantidade_retirada: itemEntrando.quantidade,
                quantidade_devolvida: 0,
                valor_unitario: regraCobranca === "manter" ? valorAtual : 0,
                valor_diario: 0,
                desconto: 0,
              });
            }
          }
        }
        novosItens = novosItens.filter(i => (i.quantidade_retirada || 0) > 0);
      }

      const historicoAtual = doc?.historico_trocas || [];
      const novoHistorico = [...historicoAtual, registro];
      const updatePayload = { historico_trocas: novoHistorico };
      if (docTipo === "contrato") updatePayload.itens = novosItens;

      if (docTipo === "contrato") {
        await base44.entities.Contract.update(doc.id, updatePayload);
      } else {
        await base44.entities.ServiceOrder.update(doc.id, updatePayload);
      }

      // Log
      try {
        const regraLabel = regraCobranca === "manter" ? "Manteve cobrança atual" : "Atualizou cobrança para novo equipamento";
        await base44.entities.ActivityLog.create({
          usuario: currentUser?.full_name || currentUser?.email || "—",
          acao: "Troca de Equipamento",
          modulo: docTipo === "contrato" ? "contrato" : "os",
          referencia_id: doc.id,
          referencia_numero: doc.numero,
          detalhes: `Troca registrada. Motivo: ${motivoFinal}. Saindo: ${itensSaindoSelecionados.map(i => `${i.quantidade}x ${i.equipamento_nome}`).join(", ")}. Entrando: ${itensEntrandoValidos.map(i => `${i.quantidade}x ${i.equipamento_nome}`).join(", ")}. Cobrança: ${regraLabel}.`,
          data_hora: now,
        });
      } catch (_) {}

      // Gera PDF
      try {
        gerarReciboDeTroca({ doc, client, settings, registro, numeroTroca: novoHistorico.length });
      } catch (_) {}

      toast.success("Troca registrada com sucesso! PDF gerado.");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[TrocaEquipamento] Erro:", err);
      toast.error("Erro ao registrar troca: " + (err?.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const fmtVal = (v) => v ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—";

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-orange-600" />
              Troca de Equipamento — {docTipo === "contrato" ? "Contrato" : "OS"} #{doc?.numero || "—"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Tipo e Motivo */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de Troca</Label>
                <Select value={tipoTroca} onValueChange={setTipoTroca}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_TROCA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Motivo da Troca *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {motivo === "outro" && (
              <div>
                <Label className="text-xs">Descreva o motivo</Label>
                <Input value={motivoOutro} onChange={e => setMotivoOutro(e.target.value)} className="mt-1" placeholder="Ex: Equipamento fora de especificação..." />
              </div>
            )}

            {/* Data da Troca */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Data da Troca</Label>
                <Input
                  type="date"
                  value={dataTroca}
                  onChange={e => setDataTroca(e.target.value)}
                  className="mt-1"
                  placeholder="Hoje se não informado"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {dataTroca
                    ? dataTroca > format(new Date(), "yyyy-MM-dd")
                      ? "⏳ Troca agendada (futura)"
                      : "✓ Troca executada"
                    : "Se vazio: executada agora"}
                </p>
              </div>
              {tipoTroca === "em_campo" && (
                <div>
                  <Label className="text-xs font-semibold">Motorista da Troca</Label>
                  <Select value={motorista} onValueChange={setMotorista}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o motorista..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem motorista</SelectItem>
                      {drivers.map(d => <SelectItem key={d.id} value={d.nome}>{d.nome}{d.veiculo ? ` — ${d.veiculo}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {tipoTroca === "em_campo" && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
                🚚 <span>Troca em campo: aparecerá no calendário, quadro logístico e painel do motorista.</span>
              </div>
            )}
            {tipoTroca === "na_loja" && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                🏪 <span>Troca na loja: apenas controle interno, não entra na logística de campo.</span>
              </div>
            )}

            {/* Itens SAINDO */}
            <div>
              <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Equipamentos que SAEM (a trocar)
              </p>
              <div className="space-y-2">
                {itensSaindo.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.equipamento_nome}</p>
                        <p className="text-xs text-muted-foreground">Disponível para trocar: {item.max} un.{item.valor_diario ? ` · R$ ${Number(item.valor_diario).toFixed(2).replace(".", ",")}/dia` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => setItensSaindo(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.max(0, it.quantidade - 1) } : it))}
                          className="w-7 h-7 rounded-lg border bg-white flex items-center justify-center font-bold text-red-600 hover:bg-red-50">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-semibold text-sm">{item.quantidade}</span>
                        <button type="button" onClick={() => setItensSaindo(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.min(it.max, it.quantidade + 1) } : it))}
                          className="w-7 h-7 rounded-lg border bg-white flex items-center justify-center font-bold text-red-600 hover:bg-red-50">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => setItensSaindo(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: it.max } : it))}
                          className="text-xs text-red-600 hover:underline ml-1">
                          Todos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itens ENTRANDO com busca */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <RefreshCcw className="w-3.5 h-3.5" /> Equipamentos que ENTRAM (substitutos)
                </p>
                <button type="button" onClick={addItemEntrando} className="flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                  <Plus className="w-3 h-3" /> Adicionar item
                </button>
              </div>
              <div className="space-y-2">
                {itensEntrando.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] text-emerald-700">Buscar equipamento</Label>
                        <EquipamentoSearchInput
                          equipamentos={equipamentos}
                          value={item.eq_obj}
                          onSelect={(eq) => handleSelectEqEntrando(idx, eq)}
                          placeholder="Código, nome, serial, marca..."
                        />
                        {/* Se não encontrou via busca, permite digitar nome manual */}
                        {!item.eq_obj && (
                          <Input
                            placeholder="Ou digitar nome manualmente..."
                            value={item.equipamento_nome}
                            onChange={e => setItensEntrando(prev => prev.map((it, i) => i === idx ? { ...it, equipamento_nome: e.target.value } : it))}
                            className="h-8 text-xs"
                          />
                        )}
                        {item.eq_obj && (
                          <p className="text-[10px] text-emerald-700">
                            {item.eq_obj.valor_diario ? `Valor: R$ ${Number(item.eq_obj.valor_diario).toFixed(2).replace(".", ",")}/dia` : ""}
                            {item.eq_obj.valor_mensal ? ` · R$ ${Number(item.eq_obj.valor_mensal).toFixed(2).replace(".", ",")}/mês` : ""}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Label className="text-[10px] text-emerald-700">Qtd</Label>
                        <Input
                          type="number" min={1}
                          value={item.quantidade}
                          onChange={e => setItensEntrando(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))}
                          className="mt-0.5 h-8 w-16 text-xs text-center"
                        />
                      </div>
                      {itensEntrando.length > 1 && (
                        <button type="button" onClick={() => removeItemEntrando(idx)} className="text-red-500 hover:text-red-700 mt-5">
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opção de Cobrança — apenas para contratos */}
            {docTipo === "contrato" && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Regra de Cobrança após a Troca
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="regraCobranca"
                      value="manter"
                      checked={regraCobranca === "manter"}
                      onChange={() => setRegraCobranca("manter")}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Manter valor atual do contrato</p>
                      <p className="text-[10px] text-blue-600">O contrato continua com o mesmo valor. Troca é operacional.</p>
                      {valorAtual > 0 && <p className="text-[10px] font-mono text-blue-700 mt-0.5">Valor atual: {fmtVal(valorAtual)}/dia</p>}
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="regraCobranca"
                      value="atualizar"
                      checked={regraCobranca === "atualizar"}
                      onChange={() => setRegraCobranca("atualizar")}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Atualizar cobrança conforme novo equipamento</p>
                      <p className="text-[10px] text-blue-600">O valor do contrato será recalculado com base no novo equipamento.</p>
                      {regraCobranca === "atualizar" && itensEntrandoValidos[0]?.eq_obj && (
                        <p className="text-[10px] font-mono text-emerald-700 mt-0.5">
                          Novo valor: {fmtVal(valorNovo)}/dia
                          {valorAtual > 0 && valorNovo > 0 && valorAtual !== valorNovo && (
                            <span className={`ml-2 px-1 rounded ${valorNovo > valorAtual ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {valorNovo > valorAtual ? `+${fmtVal(valorNovo - valorAtual)}` : `-${fmtVal(valorAtual - valorNovo)}`}
                            </span>
                          )}
                        </p>
                      )}
                      {regraCobranca === "atualizar" && !itensEntrandoValidos[0]?.eq_obj && (
                        <p className="text-[10px] text-amber-600 mt-0.5">⚠ Selecione o equipamento entrante para ver o novo valor.</p>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1" placeholder="Ex: Piso com rachadura, substituído por peça nova..." />
            </div>

            {/* Resumo */}
            {canProceed && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm space-y-1">
                <p className="font-semibold text-orange-800 text-xs">📋 Resumo da Troca</p>
                <p className="text-xs text-orange-700"><strong>Saindo:</strong> {itensSaindoSelecionados.map(i => `${i.quantidade}x ${i.equipamento_nome}`).join(", ")}</p>
                <p className="text-xs text-orange-700"><strong>Entrando:</strong> {itensEntrandoValidos.map(i => `${i.quantidade}x ${i.equipamento_nome}`).join(", ")}</p>
                <p className="text-xs text-orange-700"><strong>Motivo:</strong> {MOTIVOS.find(m => m.value === motivo)?.label || motivo}</p>
                {docTipo === "contrato" && (
                  <p className="text-xs text-orange-700"><strong>Cobrança:</strong> {regraCobranca === "manter" ? "Mantida (sem alteração)" : `Atualizada → ${fmtVal(valorNovo)}/dia`}</p>
                )}
              </div>
            )}

            {/* Assinatura capturada */}
            {assinatura && (
              <div className="p-2 rounded-xl border bg-emerald-50 border-emerald-200 flex items-center gap-3">
                <img src={assinatura} alt="Assinatura" className="max-h-12 border rounded bg-white p-1" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-700">✓ Assinatura capturada</p>
                  <button onClick={() => setAssinatura(null)} className="text-[10px] text-destructive hover:underline">Remover</button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => setSignDialog(true)}
              className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              disabled={!canProceed}
            >
              ✍ {assinatura ? "Reassinar" : "Capturar Assinatura"}
            </Button>
            <Button
              onClick={() => handleSave(assinatura)}
              disabled={!canProceed || loading}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {loading ? "Salvando..." : "Confirmar Troca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignatureDialog
        open={signDialog}
        onOpenChange={setSignDialog}
        onConfirm={(dataUrl) => { setAssinatura(dataUrl); setSignDialog(false); }}
        title="Assinatura — Troca de Equipamento"
      />
    </>
  );
}