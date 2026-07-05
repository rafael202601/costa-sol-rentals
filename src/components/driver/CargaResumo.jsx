import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CargaResumo({ paradas, filtroTipo }) {
  // Agrupa todos os itens de contratos (apenas entregas de materiais)
  const totais = {};

  paradas.forEach((p) => {
    if (filtroTipo === "recolha" && p.tipo !== "recolha") return;
    if (filtroTipo === "entrega" && p.tipo === "recolha") return;

    (p.itens || []).forEach((item) => {
      const key = item.equipamento_nome || "—";
      if (!totais[key]) totais[key] = { nome: key, codigo: item.codigo || "", quantidade: 0 };
      totais[key].quantidade += item.quantidade_retirada || item.quantidade || 0;
    });
  });

  const lista = Object.values(totais).filter((x) => x.quantidade > 0);

  if (lista.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Resumo de Carga do Dia
          <span className="ml-auto text-xs font-normal text-muted-foreground">{lista.length} itens distintos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {lista.map((item) => (
            <div key={item.nome} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{item.nome}</p>
                {item.codigo && <p className="text-xs text-muted-foreground">Cód: {item.codigo}</p>}
              </div>
              <span className="text-lg font-bold text-primary">{item.quantidade}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}