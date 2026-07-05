import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Square, FileText, Upload, Clock, CheckCircle, XCircle, AlertCircle, Eye, ShieldAlert, Megaphone, Star, ExternalLink, ImageIcon, MessageSquare, PenLine, CheckCircle2 } from "lucide-react";
import FeedbackTab from "../components/portal/FeedbackTab";
import ContractSignatureDialog from "../components/portal/ContractSignatureDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function ClientPortal() {
  const [currentUser, setCurrentUser] = useState(null);
  const [client, setClient] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [comprovante, setComprovante] = useState(null);
  const [obs, setObs] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);
  const [signatureDialog, setSignatureDialog] = useState({ open: false, contract: null });

  // Verificar se é modo admin (via URL param ?clientId=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const adminClientId = urlParams.get("clientId");

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      setCurrentUser(user);
      let targetClientId = null;

      // Modo admin: admin visualizando portal de um cliente específico
      if (adminClientId && user.role === "admin") {
        setIsAdminView(true);
        targetClientId = adminClientId;
        const hoje = new Date().toISOString().slice(0, 10);
        const [adminClient, anns] = await Promise.all([
          base44.entities.Client.filter({ id: adminClientId }).then(r => r[0]).catch(() => null),
          base44.entities.Announcement.filter({ ativo: true, exibir_portal: true }).catch(() => []),
        ]);
        if (adminClient) {
          setClient(adminClient);
          const [ctrs, ords, reqs] = await Promise.all([
            base44.entities.Contract.filter({ client_id: adminClient.id }),
            base44.entities.ServiceOrder.filter({ client_id: adminClient.id }),
            base44.entities.PaymentRequest.filter({ client_id: adminClient.id }),
          ]);
          setContracts(ctrs);
          setOrders(ords);
          setPaymentHistory(reqs);
        }
        const visiveis = anns.filter(a => {
          if (a.status === "arquivado" || a.status === "encerrado") return false;
          if (a.data_inicio && a.data_inicio > hoje) return false;
          if (a.data_fim && a.data_fim < hoje) return false;
          return true;
        });
        setAnnouncements(visiveis.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          if (a.fixado && !b.fixado) return -1;
          if (!a.fixado && b.fixado) return 1;
          return (b.data || "").localeCompare(a.data || "");
        }));
        setLoading(false);
        return;
      }

      // Carregar anúncios ativos para o portal (independente de ter cliente vinculado)
      const hoje = new Date().toISOString().slice(0, 10);
      base44.entities.Announcement.filter({ ativo: true, exibir_portal: true }).then(anns => {
        const visiveis = anns.filter(a => {
          // Status deve ser ativo (não encerrado nem arquivado)
          if (a.status === "arquivado" || a.status === "encerrado") return false;
          // Verificar data de início (agendado só aparece a partir da data_inicio)
          if (a.data_inicio && a.data_inicio > hoje) return false;
          // Verificar data de término
          if (a.data_fim && a.data_fim < hoje) return false;
          // Destinatário: "todos" aparece para qualquer pessoa no portal
          // outros setores são de comunicação interna, mas se exibir_portal=true, mostrar mesmo assim
          return true;
        });
        setAnnouncements(visiveis.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          if (a.fixado && !b.fixado) return -1;
          if (!a.fixado && b.fixado) return 1;
          return (b.data || "").localeCompare(a.data || "");
        }));
      }).catch(() => {});

      // Modo normal: cliente vendo seu próprio portal
      const clients = await base44.entities.Client.filter({ email: user.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const [ctrs, ords, reqs] = await Promise.all([
          base44.entities.Contract.filter({ client_id: c.id }),
          base44.entities.ServiceOrder.filter({ client_id: c.id }),
          base44.entities.PaymentRequest.filter({ client_id: c.id }),
        ]);
        setContracts(ctrs);
        setOrders(ords);
        setPaymentHistory(reqs);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Bug fix: show debt whenever there's a financial balance due, regardless of operational status
  const openItems = [
    ...contracts
      .filter((c) => (c.saldo_pagar || 0) > 0 && c.status !== "cancelado")
      .map((c) => ({ tipo: "contrato", id: c.id, numero: c.numero, valor: c.saldo_pagar, descricao: `Contrato #${c.numero}` })),
    ...orders
      .filter((o) => o.status_pagamento !== "pago" && o.status !== "cancelada")
      .map((o) => ({ tipo: "os", id: o.id, numero: o.numero, valor: o.valor || 0, descricao: `OS #${o.numero} — ${o.local_entrega}` })),
  ];

  const toggle = (item) => {
    setSelected((prev) =>
      prev.find((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item]
    );
  };

  const toggleAll = () => {
    setSelected(selected.length === openItems.length ? [] : [...openItems]);
  };

  const totalSelected = selected.reduce((s, i) => s + (i.valor || 0), 0);

  const handleSubmit = async () => {
    if (selected.length === 0) { toast.error("Selecione ao menos um item"); return; }
    setUploading(true);
    let comprovante_url = "";
    if (comprovante) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: comprovante });
      comprovante_url = file_url;
    }
    await base44.entities.PaymentRequest.create({
      client_id: client.id,
      client_nome: client.nome_razao_social,
      itens: selected,
      valor_total: totalSelected,
      data: format(new Date(), "yyyy-MM-dd"),
      comprovante_url,
      observacoes: obs,
      status: "aguardando_confirmacao",
    });
    toast.success("Solicitação enviada! Aguardando confirmação do financeiro.");
    setDialog(false);
    setSelected([]);
    setObs("");
    setComprovante(null);
    setUploading(false);
    // Reload history
    const reqs = await base44.entities.PaymentRequest.filter({ client_id: client.id });
    setPaymentHistory(reqs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <AlertCircle className="w-12 h-12 opacity-30" />
        <p className="font-semibold text-lg">Acesso não vinculado</p>
        <p className="text-sm text-center max-w-xs">Seu email não está vinculado a nenhum cliente. Entre em contato com a empresa.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Banner modo admin */}
      {isAdminView && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Modo Administrador — Visualizando como Cliente</p>
            <p className="text-xs opacity-80">Esta é uma visualização somente leitura. Ações de pagamento estão bloqueadas.</p>
          </div>
        </div>
      )}

      <PageHeader title={isAdminView ? `Portal: ${client.nome_razao_social}` : "Meu Portal"} subtitle={isAdminView ? "Visualização administrativa" : client.nome_razao_social}>
        {selected.length > 0 && !isAdminView && (
          <Button onClick={() => setDialog(true)} className="gap-2">
            <FileText className="w-4 h-4" />
            Gerar Nota ({selected.length} item{selected.length > 1 ? "s" : ""})
          </Button>
        )}
      </PageHeader>

      <Tabs defaultValue="debitos">
        <TabsList className="mb-4 flex-wrap gap-1">
          <TabsTrigger value="debitos">Débitos em Aberto</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="assinaturas" className="relative">
            <PenLine className="w-3.5 h-3.5 mr-1" />Assinatura
            {contracts.filter(c => !c.assinatura_cliente && !c.assinatura_entrega_url && c.status !== "cancelado" && c.status !== "rascunho").length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="faturas">Contratos & OS</TabsTrigger>
          <TabsTrigger value="anuncios" className="relative">
            Anúncios
            {announcements.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debitos">
          {openItems.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold">Nenhum débito em aberto!</p>
                <p className="text-sm text-muted-foreground">Sua conta está em dia.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {!isAdminView && (
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  {selected.length === openItems.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selected.length === openItems.length ? "Desselecionar todos" : "Selecionar todos"}
                </button>
                {selected.length > 0 && (
                  <span className="text-sm font-bold text-primary">
                    Total: R$ {totalSelected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
              {openItems.map((item) => {
                const isSelected = !isAdminView && selected.find((s) => s.id === item.id);
                return (
                  <Card
                    key={item.id}
                    className={`border-0 shadow-sm transition-all ${!isAdminView ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                    onClick={() => !isAdminView && toggle(item)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      {!isAdminView && (isSelected ? <CheckSquare className="w-5 h-5 text-primary shrink-0" /> : <Square className="w-5 h-5 text-muted-foreground shrink-0" />)}
                      {isAdminView && <Eye className="w-5 h-5 text-muted-foreground shrink-0" />}
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.descricao}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.tipo === "contrato" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {item.tipo === "contrato" ? "Contrato" : "OS Caçamba"}
                        </span>
                      </div>
                      <p className="font-bold text-red-700">R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </CardContent>
                  </Card>
                );
              })}
              {selected.length > 0 && !isAdminView && (
                <Button className="w-full gap-2" onClick={() => setDialog(true)}>
                  <FileText className="w-4 h-4" />
                  Gerar Nota de Pagamento — R$ {totalSelected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-3">
            {paymentHistory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação encontrada</p>
            )}
            {paymentHistory.map((req) => (
              <Card key={req.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">Solicitação — R$ {(req.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${req.status === "aguardando_confirmacao" ? "bg-amber-100 text-amber-700" : req.status === "confirmado" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {req.status === "aguardando_confirmacao" ? "Aguardando" : req.status === "confirmado" ? "Confirmado" : "Rejeitado"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Data: {req.data ? format(parseISO(req.data), "dd/MM/yyyy") : "—"}</p>
                  <p className="text-xs text-muted-foreground">{req.itens?.length || 0} item(ns)</p>
                  {req.motivo_rejeicao && <p className="text-xs text-red-600 mt-1">Motivo: {req.motivo_rejeicao}</p>}
                  {req.comprovante_url && (
                    <a href={req.comprovante_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">Ver comprovante</a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ABA DE ASSINATURAS */}
        <TabsContent value="assinaturas">
          <div className="space-y-4">
            {/* Pendentes */}
            {(() => {
              const pendentes = contracts.filter(c => !c.assinatura_cliente && !c.assinatura_entrega_url && c.status !== "cancelado" && c.status !== "rascunho");
              const assinados = contracts.filter(c => !!(c.assinatura_cliente || c.assinatura_entrega_url));
              return (
                <>
                  {pendentes.length === 0 && assinados.length === 0 && (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-8 text-center">
                        <PenLine className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-semibold text-muted-foreground">Nenhum contrato para assinar</p>
                      </CardContent>
                    </Card>
                  )}

                  {pendentes.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 font-medium">
                          {pendentes.length} contrato(s) aguardando sua assinatura digital
                        </p>
                      </div>
                      {pendentes.map((c) => (
                        <Card key={c.id} className="border-0 shadow-sm ring-2 ring-amber-300">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm">Contrato #{c.numero}</p>
                                <p className="text-xs text-muted-foreground">
                                  Início: {c.data_inicio ? format(parseISO(c.data_inicio), "dd/MM/yyyy") : "—"}
                                </p>
                                {c.endereco_entrega && <p className="text-xs text-muted-foreground mt-0.5">📍 {c.endereco_entrega}</p>}
                                <p className="font-bold text-primary mt-1">R$ {(c.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-center">
                                  ⏳ Pendente
                                </span>
                                {!isAdminView && (
                                  <Button
                                    size="sm"
                                    onClick={() => setSignatureDialog({ open: true, contract: c })}
                                    className="gap-1.5 text-xs"
                                  >
                                    <PenLine className="w-3.5 h-3.5" /> Assinar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}

                  {assinados.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Contratos Assinados</p>
                      {assinados.map((c) => (
                        <Card key={c.id} className="border-0 shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm">Contrato #{c.numero}</p>
                                <p className="text-xs text-muted-foreground">
                                  Assinado em {c.assinatura_data ? format(new Date(c.assinatura_data), "dd/MM/yyyy 'às' HH:mm") : "—"}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Assinado
                                </span>
                                <button
                                  onClick={() => setSignatureDialog({ open: true, contract: c })}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Ver assinatura
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </TabsContent>

        <TabsContent value="faturas">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contratos</h3>
            {contracts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>}
            {contracts.map((c) => (
              <Card key={c.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">Contrato #{c.numero}</p>
                      <p className="text-xs text-muted-foreground">Início: {c.data_inicio ? format(parseISO(c.data_inicio), "dd/MM/yyyy") : "—"}</p>
                      {c.endereco_entrega && <p className="text-xs text-muted-foreground mt-0.5">📍 {c.endereco_entrega}</p>}
                    </div>
                    <div className="text-right space-y-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full block ${
                        c.status_financeiro === "pago" ? "bg-emerald-100 text-emerald-700" :
                        c.status_financeiro === "parcial" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{c.status_financeiro === "pago" ? "Pago" : c.status_financeiro === "parcial" ? "Parcial" : "Pendente"}</span>
                      {/* Badge de assinatura */}
                      {(c.assinatura_cliente || c.assinatura_entrega_url) ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3 h-3" /> Assinado
                        </span>
                      ) : c.status !== "cancelado" && c.status !== "rascunho" ? (
                        <button
                          onClick={() => !isAdminView && setSignatureDialog({ open: true, contract: c })}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 justify-end hover:bg-amber-200 transition-colors"
                        >
                          <PenLine className="w-3 h-3" /> Assinar
                        </button>
                      ) : null}
                      <p className="font-bold">R$ {(c.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      {(c.saldo_pagar || 0) > 0 && (
                        <p className="text-xs text-red-600">Saldo: R$ {(c.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  </div>
                  {c.itens?.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Materiais</p>
                      <div className="space-y-1">
                        {c.itens.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.equipamento_nome} <span className="text-foreground font-medium">× {item.quantidade_retirada}</span></span>
                            <span className="font-medium">R$ {((item.quantidade_retirada * item.valor_unitario) - (item.desconto || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mt-4">Ordens de Serviço</h3>
            {orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma OS encontrada.</p>}
            {orders.map((o) => (
              <Card key={o.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">OS #{o.numero}</p>
                      <p className="text-xs text-muted-foreground">📍 {o.local_entrega}</p>
                      {o.tipo_cacamba && <p className="text-xs text-muted-foreground">Caçamba: {o.tipo_cacamba}</p>}
                      {o.data_entrega && <p className="text-xs text-muted-foreground">Entrega: {format(new Date(o.data_entrega), "dd/MM/yyyy")}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.status_pagamento === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {o.status_pagamento === "pago" ? "Pago" : "Pendente"}
                      </span>
                      <p className="font-bold mt-1">R$ {(o.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="anuncios">
          {announcements.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">Nenhum anúncio disponível</p>
                <p className="text-sm text-muted-foreground mt-1">Em breve novidades por aqui!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <Card key={ann.id} className={`border-0 shadow-sm overflow-hidden transition-all ${ann.destaque ? "ring-2 ring-amber-300" : ""}`}>
                  {ann.destaque && (
                    <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-700">Destaque</span>
                    </div>
                  )}
                  {ann.imagem_url && (
                    <img src={ann.imagem_url} alt={ann.titulo} className="w-full max-h-48 object-cover" />
                  )}
                  {!ann.imagem_url && (
                    <div className="w-full h-16 bg-gradient-to-r from-primary/10 to-primary/5 flex items-center justify-start px-4">
                      <Megaphone className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight">{ann.titulo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {ann.data ? format(parseISO(ann.data), "dd/MM/yyyy") : "—"}
                        </p>
                      </div>
                    </div>
                    {ann.descricao && (
                      <div>
                        <p className={`text-sm text-muted-foreground leading-relaxed ${expandedAnnouncement !== ann.id ? "line-clamp-3" : ""}`}>
                          {ann.descricao}
                        </p>
                        {ann.descricao.length > 150 && (
                          <button
                            onClick={() => setExpandedAnnouncement(expandedAnnouncement === ann.id ? null : ann.id)}
                            className="text-xs text-primary font-medium mt-1 hover:underline"
                          >
                            {expandedAnnouncement === ann.id ? "Ver menos" : "Ler mais"}
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackTab client={client} isAdminView={isAdminView} />
        </TabsContent>

      </Tabs>

      {/* Dialog: Assinatura Digital do Contrato */}
      {signatureDialog.contract && (
        <ContractSignatureDialog
          open={signatureDialog.open}
          onOpenChange={(v) => setSignatureDialog(p => ({ ...p, open: v }))}
          contract={signatureDialog.contract}
          currentUser={currentUser}
          onSigned={(contractId, dataUrl, data) => {
            setContracts(prev => prev.map(c =>
              c.id === contractId
                ? { ...c, assinatura_cliente: dataUrl, assinatura_entrega_url: dataUrl, assinatura_data: data }
                : c
            ));
            setSignatureDialog({ open: false, contract: null });
          }}
        />
      )}

      {/* Dialog: Payment Note — bloqueado em modo admin */}
      <Dialog open={dialog && !isAdminView} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nota de Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/30 text-sm">
              <p className="font-semibold mb-1">{client.nome_razao_social}</p>
              <p className="text-xs text-muted-foreground">Data: {format(new Date(), "dd/MM/yyyy")}</p>
              <div className="mt-2 space-y-1">
                {selected.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span>{item.descricao}</span>
                    <span className="font-bold">R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                <span>Total</span>
                <span>R$ {totalSelected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Comprovante de Pagamento (opcional)</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 text-sm w-full file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:px-3 file:py-1.5 cursor-pointer"
                onChange={(e) => setComprovante(e.target.files[0])}
              />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="mt-1" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Forma de pagamento utilizada, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading} className="gap-2">
              {uploading ? "Enviando..." : <><Upload className="w-4 h-4" /> Enviar Solicitação</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}