import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { ConexaoWhatsapp } from "./conexao";
import { ModelosWhatsapp } from "./modelos";
import { EnviosWhatsapp } from "./envios";

type Aba = "conexao" | "modelos" | "envios";
const ABAS: { id: Aba; label: string }[] = [
  { id: "conexao", label: "Conexão" },
  { id: "modelos", label: "Modelos" },
  { id: "envios", label: "Envios" },
];

export default function WhatsApp() {
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const { profile } = useAuth();
  const [aba, setAba] = useState<Aba>("conexao");
  // Mesma regra da função no servidor: admin da empresa ou admin InovareTech.
  const podeAdministrar = !!profile && (profile.role === "admin" || profile.is_platform_admin === true);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp"
        description="Conecte o número da empresa pela Evolution API para enviar a pesquisa de satisfação pós-alta direto do sistema, sem abrir o WhatsApp Web."
      />
      <div className="flex gap-1 border-b border-line">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              aba === a.id ? "border-clinical-500 text-clinical-700" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      {aba === "conexao" && <ConexaoWhatsapp empresaId={empresaId} podeAdministrar={podeAdministrar} />}
      {aba === "modelos" && <ModelosWhatsapp empresaId={empresaId} podeAdministrar={podeAdministrar} />}
      {aba === "envios" && <EnviosWhatsapp empresaId={empresaId} />}
    </div>
  );
}
