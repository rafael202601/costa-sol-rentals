import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck } from "lucide-react";

export default function DriverSelect({ value, onChange, placeholder = "Selecione o motorista..." }) {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    base44.entities.Driver.filter({ status: "ativo" }).then(setDrivers);
  }, []);

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={null}>— Sem motorista —</SelectItem>
        {drivers.map((d) => (
          <SelectItem key={d.id} value={d.nome}>
            {d.nome} {d.veiculo ? `(${d.veiculo})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}