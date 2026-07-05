import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ArrowRight, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { calcAndaimeTubularPadrao, calcAndaimeTubularIntercalada, buildAndaimeTubularItens, PECAS_DISPONIVEIS } from "@/lib/andaimeTubular";

export default function AndaimeTubularCalculator({ equipment, onApply }) {
  const [tipoMontagem, setTipoMontagem] = useState("padrao");

  // Padrão
  const [altura, setAltura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [tamanhoPeca, setTamanhoPeca] = useState("1.0");

  // Intercalada
  const [alturaInt, setAlturaInt] = useState("");
  const [peca1, setPeca1] = useState("1.5");
  const [peca2, setPeca2] = useState("1.0");

  const [comBase, setComBase] = useState(false);
  const [comRoda, setComRoda] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");

  const pecasIguais = tipoMontagem === "intercalada" && peca1 === peca2;

  const calcular = () => {
    setErro("");

    if (tipoMontagem === "padrao") {
      const h = parseFloat(altura);
      const c = parseFloat(comprimento);
      if (!h || !c || h <= 0 || c <= 0) return;
      if (h < 2) { setErro("Altura mínima é 2 metros."); return; }
      const qtds = calcAndaimeTubularPadrao({ altura: h, comprimento: c, tamanhoPeca: parseFloat(tamanhoPeca), comBase, comRoda });
      setResultado(qtds);
      setItens(buildAndaimeTubularItens(qtds, equipment, "padrao"));
    } else {
      const h = parseFloat(alturaInt);
      if (!h || h <= 0) return;
      if (h < 2) { setErro("Altura mínima é 2 metros."); return; }
      if (peca1 === peca2) { setErro("Peça 1 e Peça 2 não podem ser iguais."); return; }
      const qtds = calcAndaimeTubularIntercalada({ altura: h, peca1: parseFloat(peca1), peca2: parseFloat(peca2), comBase, comRoda });
      setResultado(qtds);
      setItens(buildAndaimeTubularItens(qtds, equipment, "intercalada"));
    }
  };

  useEffect(() => {
    calcular();
  }, [altura, comprimento, tamanhoPeca, alturaInt, peca1, peca2, tipoMontagem, comBase, comRoda, equipment]);

  const todosMapeados = itens.every((i) => i.equipamento_id);
  const pronto = tipoMontagem === "padrao" ? (altura && comprimento) : alturaInt;

  return (
    <Card className="border-2 border-emerald-200 bg-emerald-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2 text-emerald-700">
          <Calculator className="w-4 h-4" />
          Calculadora de Andaime Tubular
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Tipo de montagem */}
        <div>
          <Label className="text-xs">Tipo de Montagem *</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setTipoMontagem("padrao"); setResultado(null); setItens([]); setErro(""); }}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${tipoMontagem === "padrao" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-border bg-white text-muted-foreground hover:border-emerald-300"}`}
            >
              <p className="font-semibold">Montagem Padrão</p>
              <p className="text-xs opacity-70 mt-0.5">Comprimento + tamanho da peça</p>
            </button>
            <button
              type="button"
              onClick={() => { setTipoMontagem("intercalada"); setResultado(null); setItens([]); setErro(""); }}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${tipoMontagem === "intercalada" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-border bg-white text-muted-foreground hover:border-emerald-300"}`}
            >
              <p className="font-semibold">Montagem Intercalada</p>
              <p className="text-xs opacity-70 mt-0.5">Duas peças alternadas por altura</p>
            </button>
          </div>
        </div>

        {/* ── PADRÃO ── */}
        {tipoMontagem === "padrao" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Altura (metros) *</Label>
                <div className="relative mt-1">
                  <Input type="number" step="0.5" min="2" placeholder="Mín: 2m" value={altura} onChange={(e) => setAltura(e.target.value)} className="pr-8 bg-white" />
                  <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">m</span>
                </div>
                {altura && parseFloat(altura) < 2 && <p className="text-[10px] text-red-600 mt-0.5">⚠ Mínimo: 2m</p>}
              </div>
              <div>
                <Label className="text-xs">Comprimento (metros) *</Label>
                <div className="relative mt-1">
                  <Input type="number" step="0.5" min="0.5" placeholder="Ex: 6" value={comprimento} onChange={(e) => setComprimento(e.target.value)} className="pr-8 bg-white" />
                  <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">m</span>
                </div>
                {comprimento && tamanhoPeca && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    {Math.ceil(parseFloat(comprimento) / parseFloat(tamanhoPeca))} módulo(s) de {tamanhoPeca}m
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Tamanho da Peça</Label>
              <Select value={tamanhoPeca} onValueChange={setTamanhoPeca}>
                <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PECAS_DISPONIVEIS.map((p) => (
                    <SelectItem key={p} value={String(p)}>{p.toFixed(2)}m</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* ── INTERCALADA ── */}
        {tipoMontagem === "intercalada" && (
          <>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Na montagem intercalada, selecione dois tamanhos de peça diferentes. A quantidade é calculada pela <strong>altura</strong>: a cada 1m = 2 peças (1 de cada tipo).</span>
            </div>

            <div>
              <Label className="text-xs">Altura (metros) *</Label>
              <div className="relative mt-1">
                <Input type="number" step="0.5" min="2" placeholder="Mín: 2m" value={alturaInt} onChange={(e) => setAlturaInt(e.target.value)} className="pr-8 bg-white" />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">m</span>
              </div>
              {alturaInt && parseFloat(alturaInt) < 2 && <p className="text-[10px] text-red-600 mt-0.5">⚠ Mínimo: 2m</p>}
              {alturaInt && parseFloat(alturaInt) >= 2 && (
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Total: {parseFloat(alturaInt) * 2} peças ({parseFloat(alturaInt)} de cada tipo)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Peça 1 (tamanho) *</Label>
                <Select value={peca1} onValueChange={setPeca1}>
                  <SelectTrigger className={`mt-1 bg-white ${pecasIguais ? "border-red-400" : ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PECAS_DISPONIVEIS.map((p) => (
                      <SelectItem key={p} value={String(p)}>{p.toFixed(2)}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Peça 2 (tamanho) *</Label>
                <Select value={peca2} onValueChange={setPeca2}>
                  <SelectTrigger className={`mt-1 bg-white ${pecasIguais ? "border-red-400" : ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PECAS_DISPONIVEIS.map((p) => (
                      <SelectItem key={p} value={String(p)}>{p.toFixed(2)}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pecasIguais && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Peça 1 e Peça 2 não podem ser iguais. Selecione tamanhos diferentes.
              </div>
            )}

            {alturaInt && !pecasIguais && parseFloat(alturaInt) >= 2 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <p className="font-semibold mb-1">📐 Padrão de montagem:</p>
                <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                  {[...Array(Math.min(6, parseFloat(alturaInt) * 2))].map((_, i) => (
                    <span key={i} className={i % 2 === 0 ? "text-emerald-700 font-bold" : "text-blue-600"}>
                      → {i % 2 === 0 ? `${Math.max(parseFloat(peca1), parseFloat(peca2)).toFixed(2)}m` : `${Math.min(parseFloat(peca1), parseFloat(peca2)).toFixed(2)}m`}
                    </span>
                  ))}
                  {parseFloat(alturaInt) * 2 > 6 && <span className="text-muted-foreground">... (continua)</span>}
                </div>
              </div>
            )}
          </>
        )}

        {/* Opcionais */}
        <div>
          <Label className="text-xs">Opcionais</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setComBase(!comBase); if (!comBase) setComRoda(false); }}
              className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${comBase ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-border bg-white text-muted-foreground hover:border-emerald-300"}`}
            >
              🔩 Base Regulável {comBase ? "✓" : "(+ 4 un)"}
            </button>
            <button
              type="button"
              onClick={() => { setComRoda(!comRoda); if (!comRoda) setComBase(false); }}
              className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${comRoda ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-border bg-white text-muted-foreground hover:border-emerald-300"}`}
            >
              🔵 Rodas {comRoda ? "✓" : "(+ 4 un)"}
            </button>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {erro}
          </div>
        )}

        {/* Resultado */}
        {resultado && itens.length > 0 && !erro && (
          <div className="space-y-3">
            {/* Resumo */}
            <div className="p-3 rounded-xl bg-emerald-100/80 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-800 mb-2">📐 Resumo do Cálculo</p>

              {tipoMontagem === "padrao" ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-base font-bold text-emerald-700">{resultado.modulos}</p>
                    <p className="text-[10px] text-muted-foreground">Módulos</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-base font-bold text-emerald-700">{resultado.alturaEfetiva}m</p>
                    <p className="text-[10px] text-muted-foreground">Altura</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-base font-bold text-emerald-700">{resultado.travas}</p>
                    <p className="text-[10px] text-muted-foreground">Travas</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-base font-bold text-emerald-700">{resultado.alturaEfetiva}m</p>
                      <p className="text-[10px] text-muted-foreground">Altura</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-base font-bold text-emerald-700">{resultado.andaimes_a + resultado.andaimes_b}</p>
                      <p className="text-[10px] text-muted-foreground">Total de peças</p>
                    </div>
                  </div>
                  <div className="text-[11px] bg-white/70 rounded-lg p-2 space-y-0.5 text-emerald-800">
                    <p>🏗️ Peças {resultado.tamanhoPecaA}m: <strong>{resultado.andaimes_a}</strong></p>
                    <p>🏗️ Peças {resultado.tamanhoPecaB}m: <strong>{resultado.andaimes_b}</strong></p>
                    <p>⬜ Piso {resultado.tamanhoPecaA}m (maior): <strong>{resultado.pisos}</strong></p>
                    {resultado.travas > 0 && (
                      <>
                        <p>🔩 Travas {resultado.tamanhoPecaA}m: <strong>{resultado.travas_a}</strong></p>
                        <p>🔩 Travas {resultado.tamanhoPecaB}m: <strong>{resultado.travas_b}</strong></p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {tipoMontagem === "padrao" && (
                <div className="text-[10px] text-emerald-800 bg-white/70 rounded-lg p-2 mt-2 space-y-0.5">
                  <p>⬜ Piso Metálico <strong>{resultado.pisoTamanho}m</strong>: <strong>{resultado.pisos}</strong></p>
                  <p>🔩 Travas: <strong>{resultado.travas_a}</strong> × {resultado.tamanhoPecaA}m</p>
                </div>
              )}
            </div>

            {/* Lista de peças */}
            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
              <div className="px-3 py-2 bg-emerald-100/60 text-[10px] font-semibold text-emerald-800 uppercase tracking-wide flex justify-between">
                <span>Peça</span>
                <span>Qtd</span>
              </div>
              {itens.map((item, idx) => (
                <div key={idx} className={`flex items-center justify-between px-3 py-2 text-sm ${idx < itens.length - 1 ? "border-b border-emerald-50" : ""}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {item.equipamento_id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className="text-xs truncate">
                      {item.equipamento_nome}
                      {!item.equipamento_id && <span className="text-amber-600 ml-1">(não cadastrado)</span>}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-emerald-700 shrink-0 ml-2">{item.quantidade}</span>
                </div>
              ))}
            </div>

            {!todosMapeados && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-100">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Alguns equipamentos não encontrados no cadastro. Verifique se estão cadastrados corretamente.
              </p>
            )}

            <Button
              type="button"
              onClick={() => onApply(itens, resultado.resumo)}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowRight className="w-4 h-4" />
              Aplicar {itens.length} itens calculados
            </Button>
          </div>
        )}

        {!pronto && (
          <p className="text-xs text-muted-foreground text-center py-1">
            {tipoMontagem === "padrao"
              ? "Informe altura e comprimento para calcular"
              : "Informe a altura e selecione as duas peças para calcular"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}