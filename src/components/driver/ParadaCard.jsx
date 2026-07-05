import { useState, useEffect } from "react";
import { ArrowDownToLine, ArrowUpFromLine, MapPin, GripVertical, Package, CheckCircle2, PenLine, ExternalLink, Camera, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { OpenLocationButton } from "../LocationField";
import { Card, CardContent } from "@/components/ui/card";
import DriverStatusActions from "./DriverStatusActions";
import TrocaStatusActions from "./TrocaStatusActions";
import DriverPhotoUpload from "./DriverPhotoUpload";
import { base44 } from "@/api/base44Client";

const STATUS_LABELS = {
  contrato: {
    rascunho: { label: "Lançado", color: "bg-slate-100 text-slate-600" },
    em_transito: { label: "Em Trânsito", color: "bg-blue-100 text-blue-700" },
    na_obra: { label: "Entregue ✓", color: "bg-emerald-100 text-emerald-700" },
    aguardando_recolha: { label: "Aguardando Recolha", color: "bg-amber-100 text-amber-700" },
    devolvido_parcial: { label: "Dev. Parcial", color: "bg-purple-100 text-purple-700" },
    finalizado: { label: "Finalizado", color: "bg-green-100 text-green-700" },
  },
  os: {
    pendente: { label: "Pendente", color: "bg-slate-100 text-slate-600" },
    em_transito: { label: "Em Trânsito", color: "bg-blue-100 text-blue-700" },
    entregue: { label: "Entregue ✓", color: "bg-emerald-100 text-emerald-700" },
    aguardando_recolha: { label: "Aguard. Recolha", color: "bg-amber-100 text-amber-700" },
    recolhida: { label: "Recolhida", color: "bg-purple-100 text-purple-700" },
    finalizada: { label: "Finalizada", color: "bg-green-100 text-green-700" },
  },
};

export default function ParadaCard({ parada, index, isDragging, listeners, attributes, driverMode, driverName, onStatusUpdated, currentUser }) {
  const isEntrega = parada.tipo === "entrega";
  const isRecolha = parada.tipo === "recolha";
  const isTroca = parada.tipo === "troca";
  const [showSigs, setShowSigs] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [fotos, setFotos] = useState([]);

  const loadFotos = () => {
    if (!parada.docId) return;
    const entity = parada.docTipo === "contrato" ? base44.entities.Contract : base44.entities.ServiceOrder;
    entity.list().then(res => {
      const doc = res?.find(d => d.id === parada.docId);
      setFotos(doc?.fotos || []);
    }).catch(() => {});
  };

  useEffect(() => {
    loadFotos();
  }, [parada.docId, parada.docTipo]);

  const handlePhotoUploaded = () => {
    loadFotos();
    onStatusUpdated?.();
  };

  // Tipos de foto relevantes para esta parada
  const tiposFoto = parada.tipo === "ambos"
    ? ["entrega", "recolha"]
    : parada.tipo === "entrega"
    ? ["entrega"]
    : ["recolha"];

  const totalFotosParada = fotos.filter(f => tiposFoto.includes(f.tipo)).length;

  const statusInfo = STATUS_LABELS[parada.docTipo]?.[parada.currentStatus] || { label: parada.currentStatus, color: "bg-slate-100 text-slate-600" };
  const hasSignatures = parada.assinaturaEntrega || parada.assinaturaDevolucao;
  const tentativasNaoConcluidas = parada.historicoTentativas?.length || 0;

  return (
    <Card
      className={`border-0 shadow-sm transition-all ${isDragging ? "opacity-50 scale-95" : ""} ${
        tentativasNaoConcluidas > 0
          ? "border-l-4 border-l-red-500 bg-red-50/40"
          : isTroca
          ? "border-l-4 border-l-orange-400"
          : isEntrega
          ? "border-l-4 border-l-blue-400"
          : isRecolha
          ? "border-l-4 border-l-amber-400"
          : "border-l-4 border-l-purple-400"
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag handle + número */}
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            {!driverMode && (
              <button
                {...listeners}
                {...attributes}
                className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                title="Arrastar para reorganizar"
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Alerta de tentativas não concluídas */}
            {tentativasNaoConcluidas > 0 && (
              <div className="flex items-center gap-1.5 bg-red-100 border border-red-300 rounded-lg px-2.5 py-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-xs font-bold text-red-700">
                  ⚠️ {tentativasNaoConcluidas} tentativa(s) não concluída(s)
                </span>
                <span className="text-[10px] text-red-600 ml-auto">
                  Último: {parada.historicoTentativas[tentativasNaoConcluidas - 1]?.motivo}
                </span>
              </div>
            )}
            {/* Badge de vínculo de troca de caçamba */}
            {parada.trocaTipo === "nova" && parada.trocaOsOrigemNumero && (
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 mb-2">
                <ArrowUpFromLine className="w-3 h-3 text-orange-500 shrink-0" />
                <span className="text-[10px] font-semibold text-orange-700">
                  🔄 Troca — retira OS #{parada.trocaOsOrigemNumero} (caçamba antiga)
                </span>
              </div>
            )}
            {parada.trocaTipo === "original" && parada.trocaOsNovaNumero && (
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 mb-2">
                <ArrowDownToLine className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="text-[10px] font-semibold text-orange-700">
                  🔄 Troca — entrega nova OS #{parada.trocaOsNovaNumero}
                </span>
              </div>
            )}

            {/* Cabeçalho */}
            {isTroca ? (
              <div className="space-y-1.5">
                {/* Banner TROCA destacado */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    <ArrowLeftRight className="w-3.5 h-3.5" /> TROCA DE EQUIPAMENTO
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    parada.trocaStatus === "concluida" ? "bg-emerald-100 text-emerald-700"
                    : parada.trocaStatus === "em_rota_troca" ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
                  }`}>
                    {parada.trocaStatus === "concluida" ? "✓ Concluída"
                     : parada.trocaStatus === "em_rota_troca" ? "🚚 Em Rota"
                     : "⏳ Solicitada"}
                  </span>
                </div>
                <p className="font-semibold text-sm leading-tight">Contrato #{parada.numero}</p>
                <p className="text-xs text-muted-foreground">{parada.clienteNome}</p>
                {parada.trocaMotivo && (
                  <p className="text-xs text-orange-700 font-medium">Motivo: {parada.trocaMotivo}</p>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-sm leading-tight">
                    {parada.docTipo === "contrato" ? `Contrato #${parada.numero}` : `OS #${parada.numero}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{parada.clienteNome}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isEntrega
                        ? "bg-blue-100 text-blue-700"
                        : isRecolha
                        ? "bg-amber-100 text-amber-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {isEntrega ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                    {parada.tipo === "ambos" ? "Entrega + Recolha" : isEntrega ? "Entrega" : "Recolha"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            )}

            {/* Endereço */}
            {parada.endereco && (
              <p className="text-xs flex items-center gap-1 text-muted-foreground mt-1 leading-tight">
                <MapPin className="w-3 h-3 shrink-0 text-primary" />
                <span className="truncate">{parada.endereco}</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(parada.endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-primary hover:text-primary/70"
                  title="Abrir no Maps"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            )}
            {/* Localização GPS/link salva */}
            {parada.location && (
              <OpenLocationButton location={parada.location} className="mt-1" />
            )}

            {/* Itens — só para entrega/recolha, não para troca (troca tem seção própria abaixo) */}
            {!isTroca && parada.itens?.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3" /> MATERIAIS
                </p>
                <div className="space-y-0.5">
                  {parada.itens.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/80">{item.equipamento_nome || item.nome}</span>
                      <span className="font-semibold text-primary ml-2 shrink-0">
                        × {item.quantidade_retirada || item.quantidade || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhes específicos da troca */}
            {isTroca && (
              <div className="mt-2 space-y-1.5">
                {parada.trocaDataAgendada && (
                  <p className="text-xs text-orange-700 font-medium">
                    📅 Agendada: {parada.trocaDataAgendada}
                  </p>
                )}
                {parada.itensSaindo?.length > 0 && (
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[10px] font-bold text-red-700 mb-1">↑ RETIRANDO</p>
                    {parada.itensSaindo.map((i, idx) => (
                      <p key={idx} className="text-xs text-red-800">{i.quantidade}× {i.nome}</p>
                    ))}
                  </div>
                )}
                {parada.itensEntrando?.length > 0 && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-700 mb-1">↓ ENTREGANDO</p>
                    {parada.itensEntrando.map((i, idx) => (
                      <p key={idx} className="text-xs text-emerald-800">{i.quantidade}× {i.nome}</p>
                    ))}
                  </div>
                )}
                {parada.trocaObservacao && (
                  <p className="text-xs text-muted-foreground italic mt-1">📝 {parada.trocaObservacao}</p>
                )}

                {parada.trocaAssinatura && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Assinatura de Troca
                    </p>
                    <img src={parada.trocaAssinatura} alt="Assinatura troca" className="max-h-16 border rounded-lg bg-white p-1" />
                  </div>
                )}
              </div>
            )}

            {/* Ações de status — apenas no modo motorista OU admin visualizando */}
            <div className="mt-3 pt-2 border-t flex items-center gap-2 flex-wrap">
              {isTroca ? (
                <TrocaStatusActions
                  parada={parada}
                  driverName={driverName}
                  onUpdated={onStatusUpdated}
                />
              ) : (
              <DriverStatusActions
                parada={parada}
                driverName={driverName}
                onUpdated={onStatusUpdated}
              />
              )}

              {/* Assinaturas coletadas */}
              {hasSignatures && (
                <button
                  onClick={() => setShowSigs(v => !v)}
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <PenLine className="w-3 h-3" />
                  {showSigs ? "Ocultar" : "Ver"} assinaturas
                </button>
              )}

              {/* Fotos */}
              <button
                onClick={() => setShowPhotos(v => !v)}
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-all ${
                  totalFotosParada > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Camera className="w-3 h-3" />
                {totalFotosParada > 0 ? `${totalFotosParada} foto(s)` : "Fotos"}
              </button>
            </div>

            {/* Assinaturas */}
            {showSigs && (
              <div className="mt-2 space-y-2">
                {parada.assinaturaEntrega && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Assinatura de Entrega
                    </p>
                    <img
                      src={parada.assinaturaEntrega}
                      alt="Assinatura entrega"
                      className="max-h-20 border rounded-lg bg-white p-1"
                    />
                  </div>
                )}
                {parada.assinaturaDevolucao && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Assinatura de Devolução
                    </p>
                    <img
                      src={parada.assinaturaDevolucao}
                      alt="Assinatura devolução"
                      className="max-h-20 border rounded-lg bg-white p-1"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Seção de Fotos */}
            {showPhotos && (
              <div className="mt-3 pt-2 border-t space-y-3">
                {tiposFoto.includes("entrega") && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                      📷 Fotos de Entrega
                    </p>
                    <DriverPhotoUpload
                      docTipo={parada.docTipo}
                      docId={parada.docId}
                      tipoFoto="entrega"
                      driverName={driverName}
                      currentFotos={fotos}
                      onUploaded={handlePhotoUploaded}
                    />
                  </div>
                )}
                {tiposFoto.includes("recolha") && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                      📷 Fotos de Recolha
                    </p>
                    <DriverPhotoUpload
                      docTipo={parada.docTipo}
                      docId={parada.docId}
                      tipoFoto="recolha"
                      driverName={driverName}
                      currentFotos={fotos}
                      onUploaded={handlePhotoUploaded}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}