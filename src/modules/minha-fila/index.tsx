import { useMemo, useState, type FormEvent } from "react";
import { hojeLocalIso } from "@/lib/data-local";
import { ClipboardList, CheckCircle2, BedDouble, ClipboardPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  usePatientQueue,
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  usePhysiotherapists,
  useProcedures,
  useDailyProduction,
  repository,
} from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { PatientQueueItem } from "@/types/domain";

function hojeIso() {
  return hojeLocalIso();
}
function agoraHora() {
  return new Date().toTimeString().slice(0, 5);
}

export default function MinhaFila() {
  const { profile } = useAuth();
  const fila = usePatientQueue();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();
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
  function pacienteDoItem(admissionId: string) {
    const internacao = internacaoDoItem(admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id);
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

  const [itemLancando, setItemLancando] = useState<PatientQueueItem | null>(null);
  const [etapaLancar, setEtapaLancar] = useState<"lancar" | "pergunta">("lancar");
  const [procedimentoLancarId, setProcedimentoLancarId] = useState("");
  const [dataLancar, setDataLancar] = useState(hojeIso());
  const [horaLancar, setHoraLancar] = useState(agoraHora());
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  function abrirLancar(item: PatientQueueItem) {
    setItemLancando(item);
    setEtapaLancar("lancar");
    setProcedimentoLancarId(item.procedure_id ?? "");
    setDataLancar(hojeIso());
    setHoraLancar(agoraHora());
  }

  async function handleLancar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!itemLancando || !meuFisioId) return;
    const internacao = internacaoDoItem(itemLancando.admission_id);
    if (!internacao) return;
    setSalvandoLancamento(true);
    try {
      await repository.dailyProduction.create({
        admission_id: itemLancando.admission_id,
        physiotherapist_id: meuFisioId,
        procedure_id: procedimentoLancarId,
        production_date: dataLancar,
        production_time: horaLancar,
        source: "manual",
        company_id: internacao.company_id,
      });
      notificarSucesso("Procedimento lançado.");
      // Não conclui sozinho — pergunta o que fazer, já que pode ter mais
      // de um procedimento previsto pro mesmo paciente no dia.
      setEtapaLancar("pergunta");
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
    } finally {
      setSalvandoLancamento(false);
    }
  }

  async function handleConcluirAposLancar() {
    if (!itemLancando) return;
    try {
      if (itemLancando.status === "pendente") {
        await repository.patientQueue.concluir(itemLancando.id);
      }
      notificarSucesso("Atendimento concluído.");
    } catch (erro) {
      notificarErro("Não foi possível concluir", erro);
    } finally {
      setItemLancando(null);
    }
  }

  function handleLancarOutro() {
    setEtapaLancar("lancar");
    setProcedimentoLancarId("");
    setHoraLancar(agoraHora());
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
              const paciente = pacienteDoItem(item.admission_id);
              const jaAtendido = temAtendimentoHoje(item.admission_id);
              const procedimentoSugerido = procedimentos.find((p) => p.id === item.procedure_id);
              return (
                <Card key={item.id}>
                  <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center">
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
                      {procedimentoSugerido && (
                        <p className="mt-1 text-xs text-clinical-700">
                          Sugerido: <span className="font-mono">{procedimentoSugerido.code}</span> {procedimentoSugerido.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {jaAtendido && <Badge variant="recovery">Lançado hoje</Badge>}
                      <Button size="sm" onClick={() => abrirLancar(item)}>
                        <ClipboardPlus className="h-3.5 w-3.5" /> Lançar procedimento
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleConcluir(item.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {concluidos.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Concluídos ({concluidos.length})</p>
              {concluidos.map((item) => {
                const paciente = pacienteDoItem(item.admission_id);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/50 px-4 py-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-recovery-500" />
                    <span className="flex-1 text-ink-soft line-through">{paciente?.full_name ?? "—"}</span>
                    <Button variant="ghost" size="sm" onClick={() => abrirLancar(item)}>
                      <ClipboardPlus className="h-3.5 w-3.5" /> Lançar mais um procedimento
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Sheet open={itemLancando !== null} onOpenChange={(open) => !open && setItemLancando(null)}>
        <SheetContent>
          {etapaLancar === "lancar" && (
            <form className="flex h-full flex-col" onSubmit={handleLancar}>
              <SheetHeader>
                <SheetTitle>Lançar procedimento</SheetTitle>
                <SheetDescription>{itemLancando && (pacienteDoItem(itemLancando.admission_id)?.full_name ?? "—")}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                {itemLancando && (() => {
                  const jaLancados = producao.filter((p) => p.admission_id === itemLancando.admission_id && p.production_date === hojeIso());
                  if (jaLancados.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-2 rounded-md bg-clinical-50 px-3 py-2.5 text-sm text-clinical-700">
                      <span>{jaLancados.length} procedimento(s) já lançado(s) hoje pra este paciente:</span>
                      <ul className="flex flex-col gap-1 pl-1 text-xs">
                        {jaLancados.map((p) => (
                          <li key={p.id} className="flex items-center gap-1.5">
                            <span className="font-mono">{p.production_time?.slice(0, 5)}</span>
                            {procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-1.5">
                  <Label>Procedimento</Label>
                  <Combobox
                    value={procedimentoLancarId}
                    onValueChange={setProcedimentoLancarId}
                    options={procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined }))}
                    placeholder="Buscar procedimento…"
                    searchPlaceholder="Nome, código ou categoria…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="data_lancar_fila">Data</Label>
                    <Input id="data_lancar_fila" type="date" required value={dataLancar} onChange={(e) => setDataLancar(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hora_lancar_fila">Horário</Label>
                    <Input id="hora_lancar_fila" type="time" required value={horaLancar} onChange={(e) => setHoraLancar(e.target.value)} />
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setItemLancando(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvandoLancamento || !procedimentoLancarId}>
                  {salvandoLancamento ? "Salvando…" : "Lançar procedimento"}
                </Button>
              </SheetFooter>
            </form>
          )}

          {etapaLancar === "pergunta" && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle>O que fazer agora?</SheetTitle>
                <SheetDescription>
                  Procedimento lançado pra {itemLancando && (pacienteDoItem(itemLancando.admission_id)?.full_name ?? "—")}. O
                  paciente ainda pode precisar de outro atendimento hoje.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col justify-center gap-3">
                <Button onClick={handleConcluirAposLancar}>
                  <CheckCircle2 className="h-4 w-4" /> Concluir atendimento do paciente
                </Button>
                <Button variant="secondary" onClick={handleLancarOutro}>
                  <ClipboardPlus className="h-4 w-4" /> Lançar outro procedimento
                </Button>
                <Button variant="ghost" onClick={() => setItemLancando(null)}>
                  Deixar em aberto por enquanto
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
