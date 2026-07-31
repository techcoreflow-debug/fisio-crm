import { useMemo } from "react";
import { ClipboardList, CheckCircle2, BedDouble } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  usePatientQueue,
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  usePhysiotherapists,
  useDailyProduction,
  repository,
} from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MinhaFila() {
  const { profile } = useAuth();
  const fila = usePatientQueue();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();

  const meuFisioId = fisioterapeutas.find((f) => f.user_id === profile?.id)?.id;

  const filaDeHoje = useMemo(() => {
    if (!meuFisioId) return [];
    return fila
      .filter((item) => item.physiotherapist_id === meuFisioId && item.data === hojeIso())
      .sort((a, b) => a.sequencia - b.sequencia);
  }, [fila, meuFisioId]);

  function internacaoDoItem(admissionId: string) {
    return internacoes.find((i) => i.id === admissionId);
  }

  function temAtendimentoHoje(admissionId: string) {
    return producao.some((p) => p.admission_id === admissionId && p.production_date === hojeIso());
  }

  async function handleConcluir(id: string) {
    try {
      await repository.patientQueue.concluir(id);
      notificarSucesso("Marcado como concluído.");
    } catch (erro) {
      notificarErro("Não foi possível concluir", erro);
    }
  }

  const pendentes = filaDeHoje.filter((i) => i.status === "pendente");
  const concluidos = filaDeHoje.filter((i) => i.status === "concluido");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Minha Fila"
        description={`Pacientes distribuídos pra você hoje, ${new Date().toLocaleDateString("pt-BR")}.`}
      />

      {!meuFisioId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Seu usuário ainda não está vinculado a um cadastro de fisioterapeuta</p>
            <p className="text-sm text-ink-soft">Peça pra um admin vincular seu login ao seu cadastro em Fisioterapeutas.</p>
          </CardContent>
        </Card>
      ) : filaDeHoje.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum paciente distribuído pra você hoje ainda</p>
            <p className="text-sm text-ink-soft">Assim que alguém te distribuir pacientes em Pacientes Internados, eles aparecem aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pendentes.map((item) => {
              const internacao = internacaoDoItem(item.admission_id);
              const paciente = pacientes.find((p) => p.id === internacao?.patient_id);
              const jaAtendido = temAtendimentoHoje(item.admission_id);
              return (
                <Card key={item.id}>
                  <CardContent className="flex items-center gap-3 pt-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-sm font-semibold text-clinical-600">
                      {item.sequencia}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-ink">{paciente?.full_name ?? "—"}</p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <BedDouble className="h-3.5 w-3.5" />
                        {hospitais.find((h) => h.id === internacao?.hospital_id)?.name ?? "—"} ·{" "}
                        {unidades.find((u) => u.id === internacao?.unit_id)?.name ?? "—"}
                      </p>
                    </div>
                    {jaAtendido && <Badge variant="recovery">Lançado hoje</Badge>}
                    <Button variant="secondary" size="sm" onClick={() => handleConcluir(item.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {concluidos.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Concluídos ({concluidos.length})</p>
              {concluidos.map((item) => {
                const internacao = internacaoDoItem(item.admission_id);
                const paciente = pacientes.find((p) => p.id === internacao?.patient_id);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/50 px-4 py-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-recovery-500" />
                    <span className="text-ink-soft line-through">{paciente?.full_name ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
