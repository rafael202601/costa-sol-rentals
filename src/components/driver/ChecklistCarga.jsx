import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, AlertTriangle, ClipboardList, CheckCircle2, Minus, Plus, Clock, XCircle, ShieldCheck, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

// Status do checklist
const STATUS = {
  nao_iniciado: { label: "Pendente de Conferência", cls: "border-l-slate-300", icon: ClipboardList, color: "text-slate-500", badge: "bg-slate-100 text-slate-600" },
  aguardando_aprovacao: { label: "Aguardando Aprovação da Logística", cls: "border-l-amber-400", icon: Clock, color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  aprovada: { label: "Carga Aprovada ✅", cls: "border-l-emerald-400", icon: CheckCircle2, color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  reprovada: { label: "Carga Reprovada ❌", cls: "border-l-red-400", icon: XCircle, color: "text-red-600", badge: "bg-red-100 text-red-700" },
};

function buildChecklist(paradas) {
  const mapa = {};
  paradas.forEach((p) => {
    (p.itens || []).forEach((item) => {
      const key = item.equipamento_nome || "Equipamento";
      if (!mapa[key]) {
        mapa[key] = { nome: key, codigo: item.codigo || "", previsto: 0, carregado: 0, confirmado: false, obs: "" };
      }
      mapa[key].previsto += item.quantidade_retirada || item.quantidade || 0;
      mapa[key].carregado += item.quantidade_retirada || item.quantidade || 0;
    });
  });
  return Object.values(mapa);
}

export default function ChecklistCarga({ paradas, driverName, currentUser, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [openAprovacao, setOpenAprovacao] = useState(false);
  const [items, setItems] = useState([]);
  const [activeObs, setActiveObs] = useState(null);
  const [obsAprovacao, setObsAprovacao] = useState("");

  // Estado persistente do checklist (poderia ser salvo numa entidade futura)
  const [checklistStatus, setChecklistStatus] = useState("nao_iniciado");
  const [checklistData, setChecklistData] = useState(null); // {items, motorista, data}

  const isLogistica = currentUser?.role === "admin" || currentUser?.role === "operacional" || currentUser?.role === "logistica";
  const totalItens = paradas.reduce((acc, p) => acc + (p.itens?.length || 0), 0);

  const iniciarConferencia = () => {
    setItems(buildChecklist(paradas));
    setOpen(true);
  };

  const setCarregado = (nome, val) => {
    setItems((prev) => prev.map((i) => (i.nome === nome ? { ...i, carregado: Math.max(0, val) } : i)));
  };

  const toggleConfirmar = (nome) => {
    setItems((prev) => prev.map((i) => (i.nome === nome ? { ...i, confirmado: !i.confirmado } : i)));
  };

  const setObs = (nome, obs) => {
    setItems((prev) => prev.map((i) => (i.nome === nome ? { ...i, obs } : i)));
  };

  const allConfirmed = items.length > 0 && items.every((i) => i.confirmado);
  const diferencas = items.filter((i) => i.carregado !== i.previsto);

  const finalizarConferencia = () => {
    if (!allConfirmed) { toast.error("Confirme todos os itens antes de finalizar."); return; }
    const data = {
      items,
      motorista: driverName,
      data: new Date().toISOString(),
      diferencas: diferencas.length,
    };
    setChecklistData(data);
    setChecklistStatus("aguardando_aprovacao");
    setOpen(false);
    toast.success("Conferência enviada para aprovação da logística!");
    if (onStatusChange) onStatusChange("aguardando_aprovacao", data);
  };

  const handleAprovar = () => {
    const dataAprovacao = {
      ...checklistData,
      aprovado_por: currentUser?.full_name || currentUser?.email || "—",
      data_aprovacao: new Date().toISOString(),
      obs_aprovacao: obsAprovacao,
    };
    setChecklistData(dataAprovacao);
    setChecklistStatus("aprovada");
    setOpenAprovacao(false);
    toast.success("Carga aprovada! Motorista liberado para saída.");
    if (onStatusChange) onStatusChange("aprovada", dataAprovacao);
  };

  const handleReprovar = () => {
    if (!obsAprovacao.trim()) { toast.error("Informe o motivo da reprovação."); return; }
    const dataReprovacao = {
      ...checklistData,
      aprovado_por: currentUser?.full_name || currentUser?.email || "—",
      data_aprovacao: new Date().toISOString(),
      obs_aprovacao: obsAprovacao,
    };
    setChecklistData(dataReprovacao);
    setChecklistStatus("reprovada");
    setOpenAprovacao(false);
    toast.error("Carga reprovada. Motorista notificado.");
    if (onStatusChange) onStatusChange("reprovada", dataReprovacao);
  };

  const cfg = STATUS[checklistStatus] || STATUS.nao_iniciado;
  const IconCfg = cfg.icon;

  return (
    <>
      <Card className={`border-0 shadow-sm border-l-4 ${cfg.cls}`}>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <IconCfg className={`w-8 h-8 shrink-0 ${cfg.color}`} />
            <div>
              <p className="font-semibold text-sm">{cfg.label}</p>
              <p className="text-xs text-muted-foreground">
                {checklistStatus === "nao_iniciado" && `${totalItens > 0 ? `${totalItens} item(ns) para conferir` : "Sem itens para conferência"}`}
                {checklistStatus === "aguardando_aprovacao" && `${checklistData?.items?.length || 0} itens conferidos · ${checklistData?.diferencas || 0} diferença(s) · ${checklistData?.data ? format(new Date(checklistData.data), "dd/MM HH:mm") : "—"}`}
                {checklistStatus === "aprovada" && `Aprovado por ${checklistData?.aprovado_por || "—"} · ${checklistData?.data_aprovacao ? format(new Date(checklistData.data_aprovacao), "dd/MM HH:mm") : "—"}`}
                {checklistStatus === "reprovada" && `Reprovado: ${checklistData?.obs_aprovacao || "—"}`}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Motorista pode iniciar/revisar conferência */}
            {(checklistStatus === "nao_iniciado" || checklistStatus === "reprovada") && (
              <Button size="sm" onClick={iniciarConferencia} disabled={totalItens === 0}
                className="bg-amber-600 hover:bg-amber-700">
                {checklistStatus === "reprovada" ? "Reconferir Carga" : "Iniciar Conferência"}
              </Button>
            )}
            {checklistStatus === "aguardando_aprovacao" && !isLogistica && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Aguardando logística
              </span>
            )}

            {/* Logística pode aprovar quando aguardando */}
            {checklistStatus === "aguardando_aprovacao" && isLogistica && (
              <Button size="sm" onClick={() => setOpenAprovacao(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Aprovar / Reprovar
              </Button>
            )}

            {/* Ver detalhes se aprovada/reprovada */}
            {(checklistStatus === "aprovada" || checklistStatus === "reprovada") && (
              <Button size="sm" variant="outline" onClick={() => setOpenAprovacao(true)}>
                Ver Detalhes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── DIALOG CONFERÊNCIA DO MOTORISTA ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600" />
              Conferência de Carga
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Motorista: {driverName}</p>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Após finalizar, a conferência será enviada para <strong>aprovação da Logística</strong> antes da liberação.</span>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const temDiferenca = item.confirmado && item.carregado !== item.previsto;
              return (
                <div key={item.nome} className={`rounded-xl border p-3 transition-all ${item.confirmado ? temDiferenca ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}>
                  <div className="flex items-start gap-2">
                    <button onClick={() => toggleConfirmar(item.nome)}
                      className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.confirmado ? temDiferenca ? "bg-amber-500 border-amber-500 text-white" : "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground"}`}>
                      {item.confirmado && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.nome}</p>
                      {item.codigo && <p className="text-xs text-muted-foreground">Cód: {item.codigo}</p>}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="text-xs text-muted-foreground">
                          Previsto: <span className="font-bold text-foreground">{item.previsto}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Carregado:</span>
                          <button onClick={() => setCarregado(item.nome, item.carregado - 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted text-sm">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{item.carregado}</span>
                          <button onClick={() => setCarregado(item.nome, item.carregado + 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted text-sm">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {temDiferenca && (
                        <div className="mt-1.5 flex items-start gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 font-medium">
                            Diferença: {item.carregado - item.previsto > 0 ? "+" : ""}{item.carregado - item.previsto} unidade(s)
                          </p>
                        </div>
                      )}

                      {activeObs === item.nome ? (
                        <div className="mt-2">
                          <Textarea value={item.obs} onChange={(e) => setObs(item.nome, e.target.value)}
                            placeholder="Observação sobre este item..." rows={2} className="text-xs" />
                          <button onClick={() => setActiveObs(null)} className="text-xs text-primary hover:underline mt-1">Fechar obs.</button>
                        </div>
                      ) : (
                        <button onClick={() => setActiveObs(item.nome)} className="text-xs text-muted-foreground hover:text-primary mt-1 block">
                          {item.obs ? `📝 ${item.obs}` : "+ Adicionar observação"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Progresso */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${items.length ? (items.filter((i) => i.confirmado).length / items.length) * 100 : 0}%` }} />
              </div>
              <span>{items.filter((i) => i.confirmado).length}/{items.length} confirmados</span>
            </div>

            {diferencas.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                ⚠ {diferencas.length} item(ns) com divergência. Serão registrados para análise da logística.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={finalizarConferencia} disabled={!allConfirmed} className="bg-amber-600 hover:bg-amber-700 gap-2">
              <Clock className="w-4 h-4" /> Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG APROVAÇÃO DA LOGÍSTICA ── */}
      <Dialog open={openAprovacao} onOpenChange={setOpenAprovacao}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              {checklistStatus === "aprovada" ? "Detalhes da Aprovação" : checklistStatus === "reprovada" ? "Detalhes da Reprovação" : "Aprovar Conferência de Carga"}
            </DialogTitle>
            {checklistData && (
              <p className="text-xs text-muted-foreground">
                Motorista: {checklistData.motorista} · {checklistData.data ? format(new Date(checklistData.data), "dd/MM/yyyy HH:mm") : "—"}
              </p>
            )}
          </DialogHeader>

          {/* Lista de itens conferidos */}
          {checklistData?.items && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens Conferidos</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {checklistData.items.map((item, i) => {
                  const temDif = item.carregado !== item.previsto;
                  return (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${temDif ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div>
                        <p className="font-medium">{item.nome}</p>
                        {item.obs && <p className="text-xs text-muted-foreground">📝 {item.obs}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {temDif ? (
                          <p className="text-xs font-semibold text-amber-700">
                            Previsto: {item.previsto} · Carregado: {item.carregado}
                            <span className="ml-1">{item.carregado - item.previsto > 0 ? "+" : ""}{item.carregado - item.previsto}</span>
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-emerald-700">✓ {item.carregado} un.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Se já aprovado/reprovado, mostrar resultado */}
          {(checklistStatus === "aprovada" || checklistStatus === "reprovada") ? (
            <div className={`p-3 rounded-xl border text-sm ${checklistStatus === "aprovada" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <p className="font-semibold">{checklistStatus === "aprovada" ? "✅ Aprovada" : "❌ Reprovada"}</p>
              <p className="text-xs text-muted-foreground mt-1">Por: {checklistData?.aprovado_por || "—"} · {checklistData?.data_aprovacao ? format(new Date(checklistData.data_aprovacao), "dd/MM HH:mm") : "—"}</p>
              {checklistData?.obs_aprovacao && <p className="text-sm mt-1">{checklistData.obs_aprovacao}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Observação (obrigatória para reprovar)</Label>
                <Textarea value={obsAprovacao} onChange={(e) => setObsAprovacao(e.target.value)}
                  rows={3} placeholder="Ex: Faltando 10 rodízios, conferir antes de sair..."
                  className="mt-1 text-sm" />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenAprovacao(false)}>Fechar</Button>
            {checklistStatus === "aguardando_aprovacao" && isLogistica && (
              <>
                <Button variant="destructive" onClick={handleReprovar} className="gap-2">
                  <XCircle className="w-4 h-4" /> Reprovar
                </Button>
                <Button onClick={handleAprovar} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <ShieldCheck className="w-4 h-4" /> Aprovar Carga
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}