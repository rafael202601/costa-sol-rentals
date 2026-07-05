import { calcularClassificacao, getScoreBadgeClass } from "../../lib/clientScore";
import { TrendingUp } from "lucide-react";

export default function ClientScoreBadge({ score, showLabel = true, size = "md" }) {
  if (score === null || score === undefined) return null;

  const classificacao = calcularClassificacao(score);
  const badgeClass = getScoreBadgeClass(score);
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${badgeClass} ${sizeClass}`}>
      <TrendingUp className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {score} pts
      {showLabel && <span className="font-normal opacity-80">— {classificacao.label}</span>}
    </span>
  );
}