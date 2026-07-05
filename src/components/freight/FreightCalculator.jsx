import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Calculator } from "lucide-react";

const ORIGEM = "Rua Alemanha 98, Jardim Caiçara";

export default function FreightCalculator({ settings, value, onChange }) {
  const tipo = settings?.tipo_calculo_frete || "manual";
  const [bairroSel, setBairroSel] = useState("");
  const [calcLoading, setCalcLoading] = useState(false);
  const tabela = settings?.tabela_frete_bairros || [];

  const handleBairroSelect = (local) => {
    setBairroSel(local);
    const entry = tabela.find((t) => t.local === local);
    if (entry) onChange(entry.valor || 0);
  };

  const calcularPorKM = async (destino) => {
    if (!destino) return;
    setCalcLoading(true);
    // Simulate: since we can't call Google Maps API from frontend directly,
    // show an estimate or let user enter KM manually
    setCalcLoading(false);
  };

  if (tipo === "manual") {
    return (
      <div>
        <Label className="text-xs flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Frete (R$) — Manual
        </Label>
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1"
          placeholder="0,00"
        />
      </div>
    );
  }

  if (tipo === "por_km") {
    const valorPorKM = settings?.valor_por_km || 3.5;
    return (
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Frete — Por KM (R$ {valorPorKM}/km)
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              step="0.1"
              placeholder="KM até o destino"
              onChange={(e) => {
                const km = Number(e.target.value) || 0;
                onChange(km * valorPorKM * 2); // ida e volta
              }}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="mt-1"
              placeholder="Valor final (editável)"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Origem: {ORIGEM} • Ida e volta calculado automaticamente. Valor editável.
        </p>
      </div>
    );
  }

  if (tipo === "por_bairro") {
    return (
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Frete — Por Bairro/Cidade
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={bairroSel} onValueChange={handleBairroSelect}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar bairro/cidade..." />
              </SelectTrigger>
              <SelectContent>
                {tabela.length === 0 && (
                  <SelectItem value="__empty__" disabled>Nenhum bairro cadastrado</SelectItem>
                )}
                {tabela.map((t, i) => (
                  <SelectItem key={i} value={t.local}>
                    {t.local} — R$ {(t.valor || 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="mt-1"
              placeholder="Valor"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Valor editável para ajustes pontuais.</p>
      </div>
    );
  }

  return null;
}