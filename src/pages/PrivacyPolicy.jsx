import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
            <p className="text-sm text-gray-500">Andaimes Costa do Sol</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-sm text-gray-700 space-y-5 leading-relaxed">
          <p>
            A <strong>Andaimes Costa do Sol</strong> respeita sua privacidade e protege os dados
            compartilhados através deste aplicativo e do WhatsApp.
          </p>

          <div>
            <p className="font-semibold text-gray-900 mb-2">As informações coletadas são utilizadas exclusivamente para:</p>
            <ul className="list-disc list-inside space-y-1 ml-1 text-gray-700">
              <li>atendimento ao cliente;</li>
              <li>comunicação comercial;</li>
              <li>emissão de orçamentos;</li>
              <li>suporte e relacionamento.</li>
            </ul>
          </div>

          <p>
            Não compartilhamos dados pessoais com terceiros sem autorização, exceto quando
            necessário para operação dos serviços.
          </p>

          <p>
            O usuário pode solicitar remoção de informações entrando em contato pelos canais
            oficiais da empresa.
          </p>

          <p>
            Ao utilizar nossos serviços, você concorda com esta política de privacidade.
          </p>
        </div>

        {/* Contact */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Contato:</span>{" "}
            <a
              href="mailto:contato@andaimescostadosol.com.br"
              className="text-blue-600 hover:underline"
            >
              contato@andaimescostadosol.com.br
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Última atualização: maio de 2026
          </p>
        </div>

        {/* Back button */}
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}