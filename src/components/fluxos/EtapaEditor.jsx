import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

function EtapaRow({ etapa, index, onChange, onDelete, onMoveUp, onMoveDown, total }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-background">
      <div className="flex items-center gap-2 p-2.5">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{index + 1}</span>
        <Input
          value={etapa.nome || ""}
          onChange={e => onChange({ ...etapa, nome: e.target.value })}
          placeholder="Nome da etapa..."
          className="h-7 text-xs flex-1"
        />
        <Input
          value={etapa.chave || ""}
          onChange={e => onChange({ ...etapa, chave: e.target.value })}
          placeholder="chave_campo"
          className="h-7 text-xs w-28"
        />
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => onMoveUp(index)}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === total - 1} onClick={() => onMoveDown(index)}>
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(index)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo do Dado</Label>
            <Select value={etapa.tipo_dado || "texto"} onValueChange={v => onChange({ ...etapa, tipo_dado: v })}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texto">Texto</SelectItem>
                <SelectItem value="numero">Número</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="lista">Lista</SelectItem>
                <SelectItem value="endereco">Endereço</SelectItem>
                <SelectItem value="booleano">Sim/Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch
              checked={etapa.obrigatoria !== false}
              onCheckedChange={v => onChange({ ...etapa, obrigatoria: v })}
              className="scale-75"
            />
            <Label className="text-xs">Obrigatória</Label>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Pergunta para o Cliente</Label>
            <Textarea
              value={etapa.pergunta || ""}
              onChange={e => onChange({ ...etapa, pergunta: e.target.value })}
              placeholder="Ex: Qual a quantidade de andaimes necessária?"
              className="text-xs min-h-[56px] resize-none"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Instrução para a IA nesta Etapa</Label>
            <Textarea
              value={etapa.dica_ia || ""}
              onChange={e => onChange({ ...etapa, dica_ia: e.target.value })}
              placeholder="Ex: Aceitar valores numéricos inteiros. Se o cliente disser 'algumas', pergunte novamente."
              className="text-xs min-h-[56px] resize-none"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Validação (opcional)</Label>
            <Input
              value={etapa.validacao || ""}
              onChange={e => onChange({ ...etapa, validacao: e.target.value })}
              placeholder="Ex: Deve ser maior que 0"
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function EtapaEditor({ etapas = [], onChange }) {
  const handleChange = (index, updated) => {
    const novo = [...etapas];
    novo[index] = updated;
    onChange(novo);
  };

  const handleDelete = (index) => {
    onChange(etapas.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const nova = {
      id: `etapa_${Date.now()}`,
      ordem: etapas.length + 1,
      nome: "",
      chave: "",
      pergunta: "",
      obrigatoria: true,
      tipo_dado: "texto",
      dica_ia: "",
      validacao: ""
    };
    onChange([...etapas, nova]);
  };

  const move = (index, dir) => {
    const novo = [...etapas];
    const temp = novo[index];
    novo[index] = novo[index + dir];
    novo[index + dir] = temp;
    onChange(novo);
  };

  return (
    <div className="space-y-2">
      {etapas.map((etapa, i) => (
        <EtapaRow
          key={etapa.id || i}
          etapa={etapa}
          index={i}
          total={etapas.length}
          onChange={(upd) => handleChange(i, upd)}
          onDelete={handleDelete}
          onMoveUp={(idx) => move(idx, -1)}
          onMoveDown={(idx) => move(idx, 1)}
        />
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={handleAdd}>
        <Plus className="w-3.5 h-3.5" /> Adicionar Etapa
      </Button>
    </div>
  );
}