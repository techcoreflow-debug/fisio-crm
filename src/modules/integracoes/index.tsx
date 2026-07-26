import { UploadCloud, MessageCircle, Receipt, Webhook } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notificarErro } from "@/store/toast-store";

interface Integracao {
  nome: string;
  descricao: string;
  icon: typeof UploadCloud;
  status: "conectado" | "disponivel";
}

const integracoes: Integracao[] = [
  { nome: "Importação Tasy", descricao: "Importação de arquivos exportados do sistema Tasy", icon: UploadCloud, status: "conectado" },
  { nome: "WhatsApp Business", descricao: "Comunicação com pacientes e equipe via WhatsApp", icon: MessageCircle, status: "disponivel" },
  { nome: "NF-e / NFS-e", descricao: "Emissão de notas fiscais de serviço para faturamento", icon: Receipt, status: "disponivel" },
  { nome: "API pública / Webhooks", descricao: "Envio e recebimento de eventos do Fisio para sistemas externos", icon: Webhook, status: "disponivel" },
];

export default function Integracoes() {
  function handleConectar(nome: string) {
    notificarErro(`${nome} ainda não está disponível`, "Essa integração ainda não foi implementada — sem previsão de dados reais por trás dela ainda.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Integrações externas além do Tasy: faturamento, comunicação e dados."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {integracoes.map((i) => (
          <Card key={i.nome}>
            <CardContent className="flex items-start gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-clinical-50 text-clinical-600">
                <i.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-ink">{i.nome}</p>
                  <Badge variant={i.status === "conectado" ? "recovery" : "neutral"}>
                    {i.status === "conectado" ? "Conectado" : "Disponível"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{i.descricao}</p>
                {i.status === "disponivel" && (
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => handleConectar(i.nome)}>
                    Conectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
