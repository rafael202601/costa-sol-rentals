import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, CheckCircle2, AlertCircle, Layers, ArrowRight } from "lucide-react";
import { calcAndaime, buildAndaimeItens, MODULO_COMPRIMENTO, MODULO_ALTURA } from "@/lib/andaimeFachadeiro";

const PECAS_LABEL = {
  andaimes: { label: "Andaimes Fachadeiros", icon: "🏗️" },
  pisos: { label: "Pisos Metálicos (1,60m)", icon: "⬜" },
  tesouras: { label: "Tesouras Fachadeiras", icon: "⚡" },
  elementos: { label: "Elementos Horizontais", icon: "—" },
  bases: { label: "Bases", icon: "🔩" },
};

export default function AndaimeCalculator({ equipment, settings, onApply, diasPeriodo = 0 }) {
  const [comprimento, setComprimento] = useState("");
  const [altura, setAltura] = useState("");
  const [resultado, setResultado] = useState(null);
  const [itens, setItens] = useState([]);

  const diasMin = settings?.minimo_dias || 5;

  const calcular = () => {
    const c = parseFloat(comprimento);
    const h = parseFloat(altura);
    if (!c || !h || c <= 0 || h <= 0) return;
    const qtds = calcAndaime(c, h);
    setResultado(qtds);
    const itensGerados = buildAndaimeItens(qtds, equipment, diasMin, diasPeriodo);
    setItens(itensGerados);
  };

  useEffect(() => {
    if (comprimento && altura) calcular();
  }, [comprimento, altura, equipment]);

  const valorTotal = itens.reduce((sum, item) => {
    const valUnit = item.valor_diario || 0;
    const qtd = item.quantidade_retirada || 0;
    const dias = Math.max(diasMin, diasPeriodo || diasMin);
    return sum + qtd * valUnit * dias;
  }, 0);

  const todosMapeados = itens.every((i) => i.equipamento_id);

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2 text-blue-700">
          <Calculator className="w-4 h-4" />
          Calculadora de Andaime Fachadeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Comprimento (metros)</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Ex: 3.20"
                value={comprimento}
                onChange={(e) => setComprimento(e.target.value)}
                className="pr-8 bg-white"
              />
              <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">m</span>
            </div>
            {comprimento && (
              <p className="text-[10px] text-blue-600 mt-0.5">
                {Math.ceil(parseFloat(comprimento) / MODULO_COMPRIMENTO)} módulo(s) de 1,60m
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Altura (metros)</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Ex: 4.00"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                className="pr-8 bg-white"
              />
              <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">m</span>
            </div>
            {altura && (
              <p className="text-[10px] text-blue-600 mt-0.5">
                {Math.ceil(parseFloat(altura) / MODULO_ALTURA)} nível(is) de 2,00m
              </p>
            )}
          </div>
        </div>

        {/* Resultado */}
        {resultado && itens.length > 0 && (
          <div className="space-y-3">
            {/* Resumo estrutural */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <p className="text-lg font-bold text-blue-700">{resultado.modulos}</p>
                <p className="text-[10px] text-muted-foreground">Módulos</p>
              </div>
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <p className="text-lg font-bold text-blue-700">{resultado.niveis}</p>
                <p className="text-[10px] text-muted-foreground">Níveis</p>
              </div>
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <p className="text-lg font-bold text-blue-700">
                  {resultado.andaimes + resultado.pisos + resultado.tesouras + resultado.elementos + resultado.bases}
                </p>
                <p className="text-[10px] text-muted-foreground">Peças total</p>
              </div>
            </div>

            {/* Lista de peças */}
            <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
              <div className="px-3 py-2 bg-blue-100/60 text-[10px] font-semibold text-blue-700 uppercase tracking-wide flex justify-between">
                <span>Peça</span>
                <div className="flex gap-6">
                  <span>Qtd</span>
                  <span>Val/dia</span>
                  {diasPeriodo > 0 && <span>Subtotal ({Math.max(diasMin, diasPeriodo)}d)</span>}
                </div>
              </div>
              {itens.map((item, idx) => {
                const valUnit = item.valor_diario || 0;
                const dias = Math.max(diasMin, diasPeriodo || diasMin);
                const subtotal = item.quantidade_retirada * valUnit * dias;
                return (
                  <div key={idx} className={`flex items-center justify-between px-3 py-2 text-sm ${idx < itens.length - 1 ? "border-b border-blue-50" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {item.equipamento_id ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate text-xs">
                        {item.equipamento_nome}
                        {!item.equipamento_id && <span className="text-amber-600 ml-1">(não cadastrado)</span>}
                      </span>
                    </div>
                    <div className="flex gap-6 shrink-0 text-xs text-right">
                      <span className="font-bold w-8 text-center">{item.quantidade_retirada}</span>
                      <span className="text-muted-foreground w-16 text-right">
                        {valUnit > 0 ? `R$ ${valUnit.toFixed(2)}` : "—"}
                      </span>
                      {diasPeriodo > 0 && (
                        <span className="font-semibold w-20 text-right">
                          {subtotal > 0 ? `R$ ${subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {diasPeriodo > 0 && valorTotal > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 border-t border-blue-200 font-bold text-sm">
                  <span className="text-blue-700">Total estimado ({Math.max(diasMin, diasPeriodo)} dias)</span>
                  <span className="text-blue-700">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {!todosMapeados && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-100">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Alguns equipamentos não foram encontrados no cadastro. Verifique se todos os itens do andaime fachadeiro estão cadastrados.
              </p>
            )}

            <Button
              type="button"
              onClick={() => onApply(itens)}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight className="w-4 h-4" />
              Aplicar {itens.length} itens calculados
            </Button>
          </div>
        )}

        {(!comprimento || !altura) && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Informe comprimento e altura para calcular automaticamente
          </p>
        )}
      </CardContent>
    </Card>
  );
}