import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Paleta de cores para novas tags
const PALETA = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

export default function ClientTagsField({ value = [], onChange }) {
  const [allTags, setAllTags] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    base44.entities.ClientTag.list().then(setAllTags).catch(() => {});
  }, []);

  const selectedIds = value || [];

  const toggleTag = (tag) => {
    if (selectedIds.includes(tag.id)) {
      onChange(selectedIds.filter(id => id !== tag.id));
    } else {
      onChange([...selectedIds, tag.id]);
    }
  };

  const handleCreate = async () => {
    if (!newTag.trim()) return;
    setCreating(true);
    const cor = PALETA[allTags.length % PALETA.length];
    const created = await base44.entities.ClientTag.create({ nome: newTag.trim(), cor });
    const updated = [...allTags, created];
    setAllTags(updated);
    onChange([...selectedIds, created.id]);
    setNewTag("");
    setShowInput(false);
    setCreating(false);
    toast.success("Etiqueta criada!");
  };

  const selectedTags = allTags.filter(t => selectedIds.includes(t.id));
  const availableTags = allTags.filter(t => !selectedIds.includes(t.id));

  return (
    <div className="space-y-2">
      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <span key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: tag.cor || "#3b82f6" }}>
              {tag.nome}
              <button onClick={() => toggleTag(tag)} className="hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tags disponíveis */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map(tag => (
            <button key={tag.id} onClick={() => toggleTag(tag)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all hover:opacity-80"
              style={{ borderColor: tag.cor || "#3b82f6", color: tag.cor || "#3b82f6" }}>
              <Plus className="w-3 h-3" /> {tag.nome}
            </button>
          ))}
        </div>
      )}

      {/* Criar nova tag */}
      {showInput ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowInput(false); }}
            placeholder="Nome da etiqueta..."
            className="h-8 text-sm"
          />
          <button onClick={handleCreate} disabled={creating || !newTag.trim()}
            className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {creating ? "..." : "Criar"}
          </button>
          <button onClick={() => setShowInput(false)} className="px-2 py-1 border rounded-lg text-xs">
            Cancelar
          </button>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <Tag className="w-3 h-3" /> Adicionar etiqueta
        </button>
      )}
    </div>
  );
}