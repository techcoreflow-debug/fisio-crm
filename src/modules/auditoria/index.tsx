import { ShieldAlert, FileEdit, UploadCloud, Trash2, LogOut, Plus, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActivityLog } from "@/data/repository";
import type { ActivityAction } from "@/types/domain";

const iconByAction: Record<ActivityAction, typeof ShieldAlert> = {
  criado: Plus,
  editado: FileEdit,
  excluido: Trash2,
  alta: LogOut,
  importado: UploadCloud,
  desfeito: Undo2,
};

const labelByAction: Record<ActivityAction, string> = {
  criado: "criou",
  editado: "editou",
  excluido: "excluiu",
  alta: "deu alta em",
  importado: "importou",
  desfeito: "desfez a importação de",
};

export default function Auditoria() {
  const eventos = useActivityLog();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoria"
        description="Trilha real de ações sensíveis nesta empresa: cadastros criados, editados, excluídos, altas e importações."
      />

      <Card>
        <CardContent className="flex items-center gap-3 pt-5">
          <ShieldAlert className="h-5 w-5 text-clinical-600" />
          <p className="text-sm text-ink-soft">
            Todo evento aqui é gerado automaticamente pela camada de dados — nenhuma tela grava na
            auditoria diretamente, e o histórico não pode ser editado ou apagado.
          </p>
        </CardContent>
      </Card>

      <Card>
        {eventos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum evento registrado ainda</p>
            <p className="text-sm text-ink-soft">
              Crie, edite ou exclua um cadastro para ver a trilha de auditoria em ação.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {eventos.map((e) => {
              const Icon = iconByAction[e.action];
              return (
                <div key={e.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      <Badge variant="neutral" className="mr-1.5">{e.entity_type}</Badge>
                      {labelByAction[e.action]} <span className="font-medium">{e.entity_label}</span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-soft">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
