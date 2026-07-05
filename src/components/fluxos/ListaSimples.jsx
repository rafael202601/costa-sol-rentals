import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

/**
 * Editor genérico de lista de itens com { id, descricao/condicao, ativa }
 * campo: "descricao" | "condicao"
 */
export default function ListaSimples({ items = [], onChange, placeholder = "Adicionar item...", campo = "descricao" }) {
  const [novo, setNovo] = useState("");

  const add = () => {
    const txt = novo.trim();
    if (!txt) return;
    onChange([...items, { id: `item_${Date.now()}`, [campo]: txt, ativa: true }]);
    setNovo("");
  };

  const toggle = (index) => {
    const n = [...items];
    n[index] = { ...n[index], ativa: !n[index].ativa };
    onChange(n);
  };

  const remove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const update = (index, value) => {
    const n = [...items];
    n[index] = { ...n[index], [campo]: value };
    onChange(n);
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={item.id || i} className={`flex items-center gap-2 ${!item.ativa ? "opacity-50" : ""}`}>
          <Switch checked={item.ativa !== false} onCheckedChange={() => toggle(i)} className="scale-75 shrink-0" />
          <Input
            value={item[campo] || ""}
            onChange={e => update(i, e.target.value)}
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => remove(i)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={add}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}