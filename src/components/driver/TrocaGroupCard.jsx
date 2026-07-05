import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Link2 } from "lucide-react";

/**
 * Renderiza um par de paradas de troca de caçamba agrupadas visualmente.
 * - paradaOrigem: OS que está sendo recolhida (caçamba antiga)
 * - paradaNova: OS que está sendo entregue (caçamba nova)
 */
export default function TrocaGroupCard({ paradaOrigem, paradaNova, renderOrigem, renderNova }) {
  // Quantidade da recolha: vem da OS original diretamente, ou do campo trocaQtdOrigem salvo na nova OS
  const qtdRecolher = paradaOrigem?.quantidadeCacambas
    || paradaNova?.trocaQtdOrigem
    || 1;

  // Quantidade da entrega: vem da nova OS diretamente, ou do campo trocaQtdNova salvo na original
  const qtdEntregar = paradaNova?.quantidadeCacambas
    || paradaOrigem?.trocaQtdNova
    || 1;

  return (
    <div className="relative">
      {/* Banner de conexão */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <div className="flex items-center gap-1.5 bg-orange-100 border border-orange-300 rounded-full px-3 py-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="text-xs font-bold text-orange-700">TROCA DE CAÇAMBA</span>
          <Link2 className="w-3 h-3 text-orange-500" />
          <span className="text-[10px] text-orange-600 font-medium">
            OS #{paradaOrigem?.numero} ↔ OS #{paradaNova?.numero}
          </span>
        </div>
      </div>

      {/* Painel das duas OSs em coluna */}
      <div className="border-2 border-orange-300 rounded-2xl bg-orange-50/30 p-2 space-y-2">

        {/* OS Original — Recolha */}
        <div className="relative">
          <div className="absolute -top-2 left-3 z-10 flex items-center gap-1.5">
            <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <ArrowUpFromLine className="w-2.5 h-2.5" /> RETIRA (caçamba antiga)
            </span>
            {/* Quantidade destacada */}
            <span className="flex items-center gap-1 bg-amber-600 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm border border-amber-700">
              {qtdRecolher} caçamba{qtdRecolher !== 1 ? "s" : ""} para recolher
            </span>
          </div>
          <div className="pt-3">
            {renderOrigem()}
          </div>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 h-px bg-orange-200" />
          <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3" /> troca
          </span>
          <div className="flex-1 h-px bg-orange-200" />
        </div>

        {/* Nova OS — Entrega */}
        <div className="relative">
          <div className="absolute -top-2 left-3 z-10 flex items-center gap-1.5">
            <span className="flex items-center gap-1 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <ArrowDownToLine className="w-2.5 h-2.5" /> ENTREGA (caçamba nova)
            </span>
            {/* Quantidade destacada */}
            <span className="flex items-center gap-1 bg-blue-600 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm border border-blue-700">
              {qtdEntregar} caçamba{qtdEntregar !== 1 ? "s" : ""} para entregar
            </span>
          </div>
          <div className="pt-3">
            {renderNova()}
          </div>
        </div>
      </div>
    </div>
  );
}