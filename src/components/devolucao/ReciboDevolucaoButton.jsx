import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Eye, Printer } from "lucide-react";
import { generateReciboDevolucaoPDF } from "@/lib/generateReciboDevolucao";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Botão de Recibo de Devolução reutilizável para Contratos e OS
 *
 * Props:
 *   doc           - contrato ou OS
 *   client        - dados do cliente
 *   settings      - CompanySettings
 *   tipo          - "contrato" | "os"
 *   tipoDevolucao - "parcial" | "total"
 *   itensDevolucao- [{nome, quantidade, unidade?, observacao?}]
 *   motorista     - nome do motorista (string)
 *   usuario       - nome do usuário (string)
 *   observacoes   - observações da devolução (string)
 *   numeroDevolucao - número sequencial desta devolução
 *   variant       - variante do botão (default: "outline")
 *   size          - tamanho do botão
 */
export default function ReciboDevolucaoButton({
  doc,
  client,
  settings,
  tipo = "contrato",
  tipoDevolucao = "total",
  itensDevolucao = [],
  motorista = "",
  usuario = "",
  observacoes = "",
  numeroDevolucao = 1,
  assinaturaClienteUrl = null,
  assinaturaResponsavelUrl = null,
  variant = "outline",
  size = "default",
}) {
  const [loading, setLoading] = useState(false);
  const [responsavelAssinatura, setResponsavelAssinatura] = useState(assinaturaResponsavelUrl);

  useEffect(() => {
    // Se não foi passada externamente, busca do usuário logado
    if (!assinaturaResponsavelUrl) {
      base44.auth.me().then(u => {
        if (u?.assinatura_usuario) setResponsavelAssinatura(u.assinatura_usuario);
      }).catch(() => {});
    } else {
      setResponsavelAssinatura(assinaturaResponsavelUrl);
    }
  }, [assinaturaResponsavelUrl]);

  const generate = () => {
    return generateReciboDevolucaoPDF({
      doc,
      client,
      settings,
      tipo,
      tipoDevolucao,
      itensDevolucao,
      motorista,
      usuario,
      observacoes,
      numeroDevolucao,
      assinaturaClienteUrl,
      assinaturaResponsavelUrl: responsavelAssinatura,
    });
  };

  const handleDownload = () => {
    setLoading(true);
    try {
      const pdf = generate();
      const prefix = tipo === "contrato" ? `contrato_${doc?.numero}` : `os_${doc?.numero}`;
      pdf.save(`recibo_devolucao_${prefix}_${numeroDevolucao}.pdf`);
      toast.success("Recibo de devolução gerado!");
    } catch (e) {
      toast.error("Erro ao gerar recibo");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    setLoading(true);
    try {
      const pdf = generate();
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Erro ao visualizar recibo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={loading}
          className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
        >
          <FileDown className="w-4 h-4" />
          {loading ? "Gerando..." : "Recibo Devolução"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handlePreview} className="gap-2 cursor-pointer">
          <Eye className="w-4 h-4" /> Visualizar Recibo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload} className="gap-2 cursor-pointer">
          <FileDown className="w-4 h-4" /> Baixar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload} className="gap-2 cursor-pointer">
          <Printer className="w-4 h-4" /> Reimprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}