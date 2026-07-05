import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WhatsAppButton({ phone, message, className }) {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message || "");
  const url = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => window.open(url, "_blank")}
      disabled={!cleanPhone}
    >
      <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
      WhatsApp
    </Button>
  );
}