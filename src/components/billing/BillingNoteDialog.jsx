import { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Truck, Receipt, Calendar, Info, Edit3 } from "lucide-react";
import SalesVincularNota from "../sales/SalesVincularNota";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { calcContractTotal } from "../../lib/contractCalc";
import { logActivity } from "../../lib/activityLog";

const log = (acao, modulo, ref_id, ref_num, detalhes) =>
  logActivity({ acao, modulo, referencia_id: ref_id || "", referencia_numero: ref_num || "", detalhes: detalhes || "" });

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(str) {
  try { return format(parseISO(str), "dd/MM/yyyy"); } catch { return str; }
}

function fmtMoney(v) {
  return (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildContractDesc(contract, pagoAte) {
  const equips = (contract.itens || [])
    .filter(i => i.equipamento_nome && (i.quantidade_retirada || 0) > 0)
    .map(i => `${i.quantidade_retirada}x ${(i.equipamento_nome || "").toUpperCase()}`)
    .join(" / ");
  const base = equips ? `CONTRATO #${contract.numero} - ${equips}` : `CONTRATO #${contract.numero}`;
  if (pagoAte) {
    try { return `${base} - PAGO ATÉ ${fmtDate(pagoAte)}`; } catch { /* ignore */ }
  }
  return base;
}

function getContractCloseDate(contract) {
  if (contract.status === "finalizado" || contract.status === "devolvido_parcial") {
    const recolhas = contract.historico_recolhas || [];
    if (recolhas.length > 0) {
      const ultima = recolhas[recolhas.length - 1];
      if (ultima.data) return ultima.data.slice(0, 10);
    }
    if (contract.data_prevista_termino) return contract.data_prevista_termino;
  }
  return null;
}

/**
 * REGRA PRINCIPAL DE CÁLCULO
 *
 * 1ª cobrança (ultima_cobranca_enviada vazio):
 *   - Valor = saldo_pagar atual do contrato (tudo já vencido: mínimo, frete, uso real)
 *             + dias futuros selecionados × diária líquida × quantidade
 *   - Dias futuros = differenceInDays(pagoAte, hoje) — dias a partir de hoje até pagoAte
 *   - NÃO recalcula o passado — usa diretamente saldo_pagar como "tudo em aberto"
 *
 * Cobranças seguintes (ultima_cobranca_enviada preenchido):
 *   - Apenas dias adicionais = differenceInDays(pagoAte, ultima_cobranca_enviada)
 *   - Diária pura × dias × quantidade — SEM mínimo, SEM frete
 */

/** Calcula a diária líquida total de um contrato (soma de diária×qtd de todos os itens ativos) */
function calcDiariaTotalContrato(contract) {
  return (contract.itens || []).reduce((sum, item) => {
    const qty = Math.max(0, (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0));
    if (qty <= 0) return sum;
    const diaria = item.valor_diario > 0 ? item.valor_diario : 0;
    return sum + diaria * qty;
  }, 0);
}

/**
 * Recalcula o saldo em aberto atual do contrato usando a MESMA lógica do backend,
 * sem depender de campos salvos (saldo_pagar / dinamico_valor_em_aberto).
 * Garante resultado correto mesmo que a função diária ainda não tenha rodado.
 */
function calcSaldoCorridoAtual(contract, settings) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataBaseStr = contract.dinamico_data_base || contract.data_inicio;
  if (!dataBaseStr) return { saldo: 0, dias: 0 };

  const dataBase = new Date(dataBaseStr + "T00:00:00");
  dataBase.setHours(0, 0, 0, 0);

  const diasEmAberto = Math.max(0, Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24)));

  const diasMinimoGlobal = settings?.minimo_dias || 5;
  const valorMinimoContrato = settings?.valor_minimo_contrato || 0;
  const itens = contract.itens || [];

  const grupoA = itens.filter(i => i.aplica_valor_minimo === true);
  const grupoB = itens.filter(i => i.aplica_valor_minimo !== true);

  let somaGrupoA = 0;
  for (const item of grupoA) {
    const qtd = item.quantidade_retirada || 0;
    const devolvida = item.quantidade_devolvida || 0;
    const qtdAtiva = Math.max(0, qtd - devolvida);
    if (qtdAtiva <= 0) continue;
    const valorDiario = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
    const desconto = item.desconto || 0;
    const diasMinItem = item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : diasMinimoGlobal;
    const diasEfetivos = Math.max(diasEmAberto, diasMinItem);
    somaGrupoA += Math.max(0, valorDiario * diasEfetivos * qtdAtiva - desconto);
  }
  if (grupoA.length > 0 && valorMinimoContrato > 0 && somaGrupoA < valorMinimoContrato) {
    somaGrupoA = valorMinimoContrato;
  }

  let somaGrupoB = 0;
  for (const item of grupoB) {
    const qtd = item.quantidade_retirada || 0;
    const devolvida = item.quantidade_devolvida || 0;
    const qtdAtiva = Math.max(0, qtd - devolvida);
    if (qtdAtiva <= 0) continue;
    const valorDiario = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
    const desconto = item.desconto || 0;
    somaGrupoB += Math.max(0, valorDiario * diasEmAberto * qtdAtiva - desconto);
  }

  const valorEmAberto = Math.max(0, somaGrupoA + somaGrupoB) + (contract.frete || 0);
  const pagosForaCiclo = contract.dinamico_valor_pago_acumulado || 0;
  const saldo = Math.max(0, valorEmAberto - Math.max(0, (contract.valor_pago || 0) - pagosForaCiclo));

  return { saldo: parseFloat(saldo.toFixed(2)), dias: diasEmAberto };
}

function calcValorPeriodo(contract, pagoAte, settings) { // contract já é passado como 1º parâmetro
  // isPrimeira = true enquanto não houver pagamento real registrado.
  // ultima_nota_paga_ate é gravado APENAS quando uma nota é efetivamente paga/quitada.
  // ultima_cobranca_enviada NÃO é mais usado para controlar o período — apenas para exibição legada.
  const ultimaPaga = contract.ultima_nota_paga_ate || null;
  const isPrimeira = !ultimaPaga;
  const diariaTotalContrato = calcDiariaTotalContrato(contract);

  if (isPrimeira) {
    const hoje = new Date().toISOString().slice(0, 10);
    const dataInicio = contract.dinamico_data_base || contract.data_inicio || hoje;

    // Sempre recalcula o saldo corrido atual (sem depender de campos salvos)
    const { saldo: valorCorrido, dias: diasCorridos } = calcSaldoCorridoAtual(contract, settings);

    // Sem data futura selecionada: usa diretamente o saldo_pagar do contrato (já inclui mínimo, frete, descontos)
    if (!pagoAte) {
      const saldoDirecto = contract.saldo_pagar || contract.dinamico_valor_em_aberto || valorCorrido;
      return {
        valor: saldoDirecto,
        isPrimeira: true,
        diasFuturos: 0,
        diasCorridos,
        saldoAtual: saldoDirecto,
        valorFuturo: 0,
        deDataStr: dataInicio,
        ateDataStr: null,
        detalhes: saldoDirecto > 0
          ? `R$ ${fmtMoney(saldoDirecto)} — Saldo a Pagar atual do contrato`
          : "Saldo a pagar zerado",
        breakdown: null,
      };
    }

    // Com data futura: saldo corrido + dias futuros
    const diasFuturos = Math.max(0, differenceInDays(parseISO(pagoAte), parseISO(hoje)));
    const valorFuturo = parseFloat((diasFuturos * diariaTotalContrato).toFixed(2));
    const valor = Math.max(0, parseFloat((valorCorrido + valorFuturo).toFixed(2)));

    const partes = [];
    if (valorCorrido > 0) partes.push(`R$ ${fmtMoney(valorCorrido)} em aberto (${diasCorridos} dias corridos)`);
    if (diasFuturos > 0) partes.push(`+ ${diasFuturos} dias futuros × R$ ${fmtMoney(diariaTotalContrato)}/dia = R$ ${fmtMoney(valorFuturo)}`);

    return {
      valor,
      isPrimeira: true,
      diasFuturos,
      diasCorridos,
      saldoAtual: valorCorrido,
      valorFuturo,
      deDataStr: dataInicio,
      ateDataStr: pagoAte,
      detalhes: partes.join(" | ") || "Sem valor a cobrar",
      breakdown: null,
    };

  } else {
    // Cobranças seguintes: apenas dias adicionais desde a última data PAGA
    if (!pagoAte) {
      return {
        valor: 0,
        isPrimeira: false,
        diasFuturos: 0,
        deDataStr: ultimaPaga,
        ateDataStr: null,
        detalhes: "Selecione a data pago até",
        breakdown: null,
      };
    }

    const diasAdicionais = Math.max(0, differenceInDays(parseISO(pagoAte), parseISO(ultimaPaga)));

    if (diasAdicionais <= 0) {
      return {
        valor: 0,
        isPrimeira: false,
        diasFuturos: 0,
        deDataStr: ultimaPaga,
        ateDataStr: pagoAte,
        detalhes: "Data selecionada já foi paga anteriormente",
        breakdown: null,
      };
    }

    const valor = Math.max(0, parseFloat((diasAdicionais * diariaTotalContrato).toFixed(2)));

    return {
      valor,
      isPrimeira: false,
      diasFuturos: diasAdicionais,
      deDataStr: ultimaPaga,
      ateDataStr: pagoAte,
      detalhes: `${diasAdicionais} dias × R$ ${fmtMoney(diariaTotalContrato)}/dia = R$ ${fmtMoney(valor)} (pago até ${fmtDate(ultimaPaga)} → ${fmtDate(pagoAte)})`,
      breakdown: null,
    };
  }
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function BillingNoteDialog({ open, onClose, client, contracts, orders, settings, onCreated }) {
  // Inclui contratos com saldo pendente independentemente do status (finalizado, devolvido, etc.)
  // Apenas exclui cancelados e já pagos
  const openContracts = contracts.filter(
    c => c.status !== "cancelado" && c.status_financeiro !== "pago" && c.data_inicio &&
      ((c.saldo_pagar || 0) > 0 || (c.dinamico_valor_em_aberto || 0) > 0 ||
       !["finalizado", "devolvido_parcial"].includes(c.status))
  );
  const openOrders = orders.filter(
    o => o.status !== "cancelada" && o.status_pagamento !== "pago" && (o.valor || 0) > 0
  );

  const [selContracts, setSelContracts] = useState(() => openContracts.map(c => c.id));
  const [selOrders, setSelOrders] = useState(() => openOrders.map(o => o.id));
  const [selectedSalesData, setSelectedSalesData] = useState([]);
  const [desconto, setDesconto] = useState(0);
  const [saving, setSaving] = useState(false);

  // "Pago até" por contrato
  const [pagoAteMap, setPagoAteMap] = useState(() => {
    const map = {};
    openContracts.forEach(c => {
      const closeDate = getContractCloseDate(c);
      if (closeDate) map[c.id] = closeDate;
    });
    return map;
  });

  // Valor manual por contrato (null = automático)
  const [valorManualMap, setValorManualMap] = useState({});
  // Controla quais contratos estão no modo edição manual
  const [editandoManual, setEditandoManual] = useState({});

  const toggleC = useCallback(id => setSelContracts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]), []);
  const toggleO = useCallback(id => setSelOrders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]), []);

  const chosenContracts = openContracts.filter(c => selContracts.includes(c.id));
  const chosenOrders = openOrders.filter(o => selOrders.includes(o.id));

  // Calcula período para cada contrato
  const periodoMap = useMemo(() => {
    const map = {};
    openContracts.forEach(c => {
      map[c.id] = calcValorPeriodo(c, pagoAteMap[c.id] || null, settings);
    });
    return map;
  }, [openContracts, pagoAteMap, settings]);

  // Valor efetivo de um contrato (manual sobrepõe automático)
  const getValorContrato = useCallback(c => {
    if (valorManualMap[c.id] !== undefined && valorManualMap[c.id] !== "") {
      return parseFloat(valorManualMap[c.id]) || 0;
    }
    const periodo = periodoMap[c.id];
    if (periodo) return periodo.valor;
    return c.saldo_pagar || 0;
  }, [valorManualMap, periodoMap]);

  const valorBruto =
    chosenContracts.reduce((s, c) => s + getValorContrato(c), 0) +
    chosenOrders.reduce((s, o) => s + (o.valor || 0), 0) +
    selectedSalesData.reduce((s, v) => s + (v.saldo_pendente || Math.max(0, (v.total || 0) - (v.valor_pago || 0))), 0);

  const valorFinal = Math.max(0, valorBruto - (parseFloat(desconto) || 0));

  const tipo = chosenContracts.length > 0 && chosenOrders.length > 0
    ? "misto" : chosenContracts.length > 0 ? "contrato" : "os";

  const handleSave = async () => {
    if (chosenContracts.length === 0 && chosenOrders.length === 0 && selectedSalesData.length === 0) {
      toast.error("Selecione ao menos um item");
      return;
    }
    setSaving(true);
    const me = await base44.auth.me().catch(() => null);

    const itens = [
      ...selectedSalesData.map(v => {
        const saldo = v.saldo_pendente || Math.max(0, (v.total || 0) - (v.valor_pago || 0));
        return { tipo: "venda", numero: v.numero, id: v.id, descricao: `Venda Balcão #${v.numero} — ${v.forma_pagamento || ""}`, valor_original: saldo, desconto: 0, valor_final: saldo };
      }),
      ...chosenContracts.map(c => {
        const valor = getValorContrato(c);
        const periodo = periodoMap[c.id];
        const isManual = valorManualMap[c.id] !== undefined && valorManualMap[c.id] !== "";
        return {
          tipo: "contrato", numero: c.numero, id: c.id,
          descricao: buildContractDesc(c, pagoAteMap[c.id]),
          pago_ate: pagoAteMap[c.id] || null,
          periodo_de: periodo?.deDataStr || null,
          periodo_ate: periodo?.ateDataStr || null,
          dias_cobrados: periodo?.diasFuturos || null,
          is_primeira_cobranca: periodo?.isPrimeira ?? true,
          valor_manual: isManual,
          valor_original: valor, desconto: 0, valor_final: valor,
          endereco: c.endereco_entrega || "", obra_nome: c.obra_nome || "",
        };
      }),
      ...chosenOrders.map(o => ({
        tipo: "os", numero: o.numero, id: o.id,
        descricao: `OS #${o.numero} — ${o.local_entrega || ""}`,
        valor_original: o.valor || 0, desconto: 0, valor_final: o.valor || 0,
        endereco: o.local_entrega || "", obra_nome: "",
      })),
    ];

    let numero = "";
    try {
      const counters = await base44.entities.Counter.filter({ tipo: "nota_cobranca" });
      if (counters.length > 0) {
        const next = (counters[0].ultimo_numero || 1000) + 1;
        await base44.entities.Counter.update(counters[0].id, { ultimo_numero: next });
        numero = String(next);
      } else {
        await base44.entities.Counter.create({ tipo: "nota_cobranca", ultimo_numero: 1001 });
        numero = "1001";
      }
    } catch { numero = Date.now().toString().slice(-6); }

    const note = await base44.entities.BillingNote.create({
      numero, client_id: client.id, client_nome: client.nome_razao_social, client_cpf_cnpj: client.cpf_cnpj,
      contratos_ids: chosenContracts.map(c => c.id), contratos_numeros: chosenContracts.map(c => c.numero),
      os_ids: chosenOrders.map(o => o.id), os_numeros: chosenOrders.map(o => o.numero),
      vendas_ids: selectedSalesData.map(v => v.id), vendas_numeros: selectedSalesData.map(v => v.numero),
      tipo, itens, valor_bruto: valorBruto, desconto: parseFloat(desconto) || 0,
      valor_final: valorFinal, valor_pago: 0, saldo_aberto: valorFinal,
      status: "pendente", pagamentos: [], anexos: [], criado_por: me?.email || me?.full_name || "",
    });

    // NÃO atualiza ultima_cobranca_enviada aqui — esse campo só deve ser gravado após pagamento real.
    // Apenas registra a data da nota para referência visual (sem impacto no cálculo de período).
    for (const c of chosenContracts) {
      await base44.entities.Contract.update(c.id, { ultima_nota_gerada_em: new Date().toISOString().slice(0, 10) }).catch(() => {});
    }

    // Vincula vendas à nota
    for (const v of selectedSalesData) {
      await base44.entities.Sale.update(v.id, { nota_vinculada_id: note.id, nota_vinculada_numero: note.numero }).catch(() => {});
    }

    await log("Nota de Cobrança criada", "financeiro", note.id, note.numero, `Nota #${note.numero} — R$ ${fmtMoney(valorFinal)}`);
    toast.success(`Nota #${note.numero} criada!`);
    setSaving(false);
    onCreated(note);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Nova Nota de Cobrança</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* ── CONTRATOS ── */}
          {openContracts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Contratos em Aberto
              </p>
              <div className="space-y-2">
                {openContracts.map(c => {
                  const isClosed = getContractCloseDate(c);
                  const isSelected = selContracts.includes(c.id);
                  const periodo = periodoMap[c.id];
                  const isPrimeira = !c.ultima_nota_paga_ate;
                  const isManual = editandoManual[c.id];
                  const valorExibido = getValorContrato(c);

                  const equipPreview = (c.itens || [])
                    .filter(i => i.equipamento_nome && (i.quantidade_retirada || 0) > 0)
                    .slice(0, 3).map(i => `${i.quantidade_retirada}x ${i.equipamento_nome}`).join(" / ");

                  return (
                    <div key={c.id} className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                      {/* Linha principal */}
                      <label className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleC(c.id)} />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">Contrato #{c.numero || "—"}</span>
                            {isPrimeira
                              ? <p className="text-[10px] text-emerald-600 font-medium">1ª cobrança — inclui mínimo{(c.frete || 0) > 0 ? " + frete" : ""}</p>
                              : <p className="text-[10px] text-amber-600 font-medium">Pago até: {fmtDate(c.ultima_nota_paga_ate)}</p>
                            }
                            {equipPreview && <p className="text-xs text-muted-foreground truncate max-w-[230px]">{equipPreview}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm font-bold text-destructive block">
                            R$ {fmtMoney(valorExibido)}
                          </span>
                          {isManual && <span className="text-[10px] text-violet-600 font-medium">manual</span>}
                        </div>
                      </label>

                      {/* Painel expandido quando selecionado */}
                      {isSelected && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">

                          {/* Campo "Pago até" */}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Pago até:</Label>
                            <Input
                              type="date"
                              value={pagoAteMap[c.id] || ""}
                              onChange={e => {
                                setPagoAteMap(p => ({ ...p, [c.id]: e.target.value }));
                                // Limpa valor manual ao trocar data
                                setValorManualMap(p => { const n = { ...p }; delete n[c.id]; return n; });
                                setEditandoManual(p => ({ ...p, [c.id]: false }));
                              }}
                              className="h-7 text-xs flex-1 max-w-[160px]"
                              disabled={!!isClosed}
                            />
                            {isClosed && <span className="text-[10px] text-emerald-600 font-medium">data automática</span>}
                          </div>

                          {/* Detalhe do cálculo automático */}
                          {periodo && !isManual && periodo.detalhes && (
                            <div className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 ${isPrimeira ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                              <Info className={`w-3 h-3 mt-0.5 shrink-0 ${isPrimeira ? "text-emerald-600" : "text-amber-600"}`} />
                              <p className={`text-[10px] leading-tight ${isPrimeira ? "text-emerald-700" : "text-amber-700"}`}>
                                {periodo.detalhes}
                              </p>
                            </div>
                          )}

                          {/* Botão e campo de valor manual */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const novoEstado = !editandoManual[c.id];
                                setEditandoManual(p => ({ ...p, [c.id]: novoEstado }));
                                if (!novoEstado) {
                                  // Ao desativar manual, limpa valor manual
                                  setValorManualMap(p => { const n = { ...p }; delete n[c.id]; return n; });
                                } else {
                                  // Ao ativar manual, pré-preenche com valor calculado
                                  setValorManualMap(p => ({ ...p, [c.id]: String(periodoMap[c.id]?.valor ?? c.saldo_pagar ?? 0) }));
                                }
                              }}
                              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
                                isManual
                                  ? "border-violet-400 bg-violet-50 text-violet-700"
                                  : "border-muted-foreground/30 text-muted-foreground hover:border-violet-400 hover:text-violet-600"
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              {isManual ? "Usar cálculo auto" : "Editar valor"}
                            </button>

                            {isManual && (
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={valorManualMap[c.id] ?? ""}
                                  onChange={e => setValorManualMap(p => ({ ...p, [c.id]: e.target.value }))}
                                  className="h-7 text-xs flex-1"
                                  autoFocus
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── OS ── */}
          {openOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Ordens de Serviço em Aberto
              </p>
              <div className="space-y-1.5">
                {openOrders.map(o => (
                  <label key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selOrders.includes(o.id)} onCheckedChange={() => toggleO(o.id)} />
                      <div>
                        <span className="text-sm font-medium">OS #{o.numero || "—"}</span>
                        {o.local_entrega && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{o.local_entrega}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-destructive shrink-0">R$ {fmtMoney(o.valor)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── VENDAS ── */}
          <SalesVincularNota
            clientId={client?.id}
            onSelectionChange={(ids, salesData) => setSelectedSalesData(salesData)}
          />

          {openContracts.length === 0 && openOrders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item em aberto para cobrar.</p>
          )}

          {/* ── DESCONTO e TOTAL ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Desconto (R$)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={desconto}
                onChange={e => setDesconto(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 mb-0.5">Valor Final</p>
              <p className="text-lg font-bold text-blue-700">R$ {fmtMoney(valorFinal)}</p>
            </div>
          </div>

          {/* Resumo */}
          {(chosenContracts.length > 0 || chosenOrders.length > 0 || selectedSalesData.length > 0) && (
            <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor bruto:</span>
                <span>R$ {fmtMoney(valorBruto)}</span>
              </div>
              {parseFloat(desconto) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto:</span>
                  <span className="text-emerald-600">- R$ {fmtMoney(parseFloat(desconto))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t">
                <span>Total a cobrar:</span>
                <span>R$ {fmtMoney(valorFinal)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Receipt className="w-4 h-4" />
            {saving ? "Salvando..." : "Criar Nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}