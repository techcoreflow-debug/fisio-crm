import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModuleScaffoldProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** O que este módulo vai conter quando implementado */
  planned: string[];
}

/**
 * Página-base para módulos já roteados e presentes na navegação, mas
 * cuja implementação funcional ainda está na fila de construção.
 * Existe para que a estrutura completa do Fisio já esteja navegável
 * desde o primeiro entregável, com clareza sobre o que vem a seguir.
 */
export function ModuleScaffold({ title, description, icon: Icon, planned }: ModuleScaffoldProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={<Badge variant="attention">Em construção</Badge>} />
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
              <Icon className="h-6 w-6" />
            </div>
            <div className="max-w-md">
              <p className="font-display font-semibold text-ink">Este módulo entra na próxima etapa do build</p>
              <p className="mt-1 text-sm text-ink-soft">
                A estrutura, a rota e a navegação já estão prontas. A implementação funcional deste
                módulo será entregue na sequência do projeto, seguindo a arquitetura definida.
              </p>
            </div>
            <div className="w-full max-w-md rounded-lg border border-line bg-surface-sunken p-4 text-left">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <Hammer className="h-3.5 w-3.5" /> Previsto para este módulo
              </p>
              <ul className="space-y-1.5 text-sm text-ink">
                {planned.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-clinical-500">—</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
