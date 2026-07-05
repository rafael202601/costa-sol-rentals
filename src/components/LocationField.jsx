import { useState } from "react";
import { MapPin, Navigation, ExternalLink, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Extrai coordenadas de links do Google Maps / WhatsApp / strings de coordenadas.
 * Retorna { lat, lng } ou null.
 */
function extractCoords(text) {
  if (!text) return null;
  // Coordenadas puras: "-22.9068,  -43.1729" ou "-22.9068 -43.1729"
  const rawCoords = text.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (rawCoords) return { lat: rawCoords[1], lng: rawCoords[2] };
  // maps.google.com/...@lat,lng ou ?q=lat,lng ou ll=lat,lng
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { lat: m[1], lng: m[2] };
  }
  return null;
}

/**
 * Constrói a URL final para abertura no Google Maps.
 */
function buildMapsUrl(location) {
  if (!location) return null;
  if (location.location_url) return location.location_url;
  if (location.latitude && location.longitude) {
    return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  }
  if (location.location_notes) {
    return `https://maps.google.com/?q=${encodeURIComponent(location.location_notes)}`;
  }
  return null;
}

/**
 * Botão compacto para abrir localização — usado em cards do Kanban, Painel do Motorista, etc.
 */
export function OpenLocationButton({ location, className = "" }) {
  const url = buildMapsUrl(location);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium ${className}`}
      title="Abrir no Google Maps"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin className="w-3 h-3 shrink-0" />
      📍 Abrir Localização
    </a>
  );
}

/**
 * Campo completo para edição e visualização de localização.
 * Props:
 *   value: { location_url, latitude, longitude, location_notes }
 *   onChange: (newValue) => void
 *   label: string (default "Localização da Entrega / Obra")
 */
export default function LocationField({ value = {}, onChange, label = "Localização da Entrega / Obra" }) {
  const [pasteInput, setPasteInput] = useState("");
  const [parsed, setParsed] = useState(false);

  const hasLocation = value.location_url || value.latitude || value.location_notes;
  const mapsUrl = buildMapsUrl(value);

  const handlePaste = (text) => {
    const val = text.trim();
    if (!val) return;
    const coords = extractCoords(val);
    const isUrl = val.startsWith("http") || val.startsWith("https");

    const newValue = { ...value };

    if (coords) {
      newValue.latitude = coords.lat;
      newValue.longitude = coords.lng;
      if (isUrl) newValue.location_url = val;
    } else if (isUrl) {
      newValue.location_url = val;
    } else {
      // Endereço manual
      newValue.location_notes = val;
    }

    onChange(newValue);
    setPasteInput("");
    setParsed(true);
    setTimeout(() => setParsed(false), 2000);
  };

  const handleClear = () => {
    onChange({ location_url: "", latitude: "", longitude: "", location_notes: "" });
    setPasteInput("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-primary" />
        {label}
      </Label>

      {/* Localização atual */}
      {hasLocation && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            {value.location_notes && <p className="text-emerald-800 font-medium truncate">{value.location_notes}</p>}
            {value.latitude && value.longitude && (
              <p className="text-emerald-700">{value.latitude}, {value.longitude}</p>
            )}
            {value.location_url && (
              <p className="text-emerald-600 truncate">{value.location_url}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                  <ExternalLink className="w-3 h-3" /> Abrir
                </Button>
              </a>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              title="Remover localização"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Input para colar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Cole link do WhatsApp/Maps, coordenadas GPS ou endereço..."
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) { e.preventDefault(); handlePaste(text); }
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePaste(pasteInput); } }}
            className="h-9 text-sm pr-8"
          />
          {parsed && (
            <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
          )}
        </div>
        {pasteInput && (
          <Button type="button" size="sm" className="h-9 gap-1 px-3" onClick={() => handlePaste(pasteInput)}>
            <Navigation className="w-3.5 h-3.5" /> Salvar
          </Button>
        )}
      </div>

      {/* Campos manuais */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Latitude</Label>
          <Input
            type="text"
            placeholder="-22.9068"
            value={value.latitude || ""}
            onChange={(e) => onChange({ ...value, latitude: e.target.value })}
            className="h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Longitude</Label>
          <Input
            type="text"
            placeholder="-43.1729"
            value={value.longitude || ""}
            onChange={(e) => onChange({ ...value, longitude: e.target.value })}
            className="h-8 text-xs mt-0.5"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] text-muted-foreground">Referência / Observação</Label>
          <Input
            type="text"
            placeholder="Ex: Casa verde com portão azul, próximo à padaria..."
            value={value.location_notes || ""}
            onChange={(e) => onChange({ ...value, location_notes: e.target.value })}
            className="h-8 text-xs mt-0.5"
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        💡 Cole link do WhatsApp, Google Maps, coordenadas GPS ou endereço
      </p>
    </div>
  );
}