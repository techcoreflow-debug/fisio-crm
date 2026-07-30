import { useMemo, useState, type FormEvent } from "react";
import { UserRound, BedDouble, ClipboardList, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  usePatients,
  useHealthInsurances,
  useUnits,
  useBeds,
  usePhysiotherapists,
  useProcedures,
  repository,
} from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Patient, Admission } from "@/types/domain";

type Etapa = "paciente" | "internacao" | "procedimento" | "concluido";

function Passo({ numero, titulo, ativo, feito }: { numero: number; titulo: string; ativo: boolean; feito: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          feito ? "bg-recovery-500 text-white" : ativo ? "bg-clinical-500 text-white" : "bg-surface-sunken text-ink-soft"
        }`}
      >
        {feito ? <CheckCircle2 className="h-4 w-4" /> : numero}
      </div>
      <span className={`text-sm ${ativo ? "font-medium text-ink" : "text-ink-soft"}`}>{titulo}</span>
    </div>
  );
}

export default function NovoAtendimento() {
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const pacientes = usePatients();
  const convenios = useHealthInsurances();
  const unidades = useUnits();
  const leitos = useBeds();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();

  const [etapa, setEtapa] = useState<Etapa>("paciente");
  const [salvando, setSalvando] = useState(false);

  const [modoPaciente, setModoPaciente] = useState<"existente" | "novo">("existente");
  const [pacienteExistenteId, setPacienteExistenteId] = useState("");
  const [pacienteCriado, setPacienteCriado] = useState<Patient | null>(null);
  const [convenioNovoPaciente, setConvenioNovoPaciente] = useState("");
  const [sexoNovoPaciente, setSexoNovoPaciente] = useState("");

  const [unidadeId, setUnidadeId] = useState("");
  const [leitoId, setLeitoId] = useState("");
  const [convenioInternacaoId, setConvenioInternacaoId] = useState("");
  const [internacaoCriada, setInternacaoCriada] = useState<Admission | null>(null);

  const [fisioId, setFisioId] = useState("");
  const [procedimentoId, setProcedimentoId] = useState("");

  const pacienteAtual = pacienteCriado ?? pacientes.find((p) => p.id === pacienteExistenteId) ?? null;

  const opcoesPacientes = useMemo(() => pacientes.map((p) => ({ value: p.id, label: p.full_name })), [pacientes]);
  const opcoesUnidades = useMemo(() => unidades.map((u) => ({ value: u.id, label: u.name })), [unidades]);
  const leitosDaUnidade = leitos.filter((l) => l.unit_id === unidadeId && l.status === "livre");
  const opcoesFisioterapeuta = useMemo(() => fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name })), [fisioterapeutas]);
  const opcoesProcedimento = useMemo(
    () => procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined })),
    [procedimentos]
  );

  function reiniciar() {
    setEtapa("paciente");
    setModoPaciente("existente");
    setPacienteExistenteId("");
    setPacienteCriado(null);
    setConvenioNovoPaciente("");
    setSexoNovoPaciente("");
    setUnidadeId("");
    setLeitoId("");
    setConvenioInternacaoId("");
    setInternacaoCriada(null);
    setFisioId("");
    setProcedimentoId("");
  }

  async function handleSubmitPaciente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (modoPaciente === "existente") {
      if (!pacienteExistenteId) return;
      setEtapa("internacao");
      return;
    }
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    try {
      const criado = await repository.patients.create({
        full_name: String(form.get("full_name") ?? ""),
        birth_date: String(form.get("birth_date") ?? "") || null,
        document: String(form.get("document") ?? "") || null,
        sexo: (sexoNovoPaciente || null) as "M" | "F" | null,
        health_insurance_id: convenioNovoPaciente || null,
        company_id: empresaId,
      });
      setPacienteCriado(criado);
      notificarSucesso("Paciente cadastrado.");
      setEtapa("internacao");
    } catch (erro) {
      notificarErro("Não foi possível cadastrar o paciente", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSubmitInternacao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!pacienteAtual || !unidade) return;
    setSalvando(true);
    try {
      const criada = await repository.admissions.create({
        patient_id: pacienteAtual.id,
        hospital_id: unidade.hospital_id,
        unit_id: unidadeId,
        bed_id: leitoId || null,
        health_insurance_id: convenioInternacaoId || null,
        admission_date: String(form.get("admission_date") ?? ""),
        admission_time: String(form.get("admission_time") ?? ""),
        company_id: pacienteAtual.company_id,
      });
      setInternacaoCriada(criada);
      notificarSucesso("Internação registrada.");
      setEtapa("procedimento");
    } catch (erro) {
      notificarErro("Não foi possível registrar a internação", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSubmitProcedimento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!internacaoCriada) return;
    setSalvando(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoCriada.id,
        physiotherapist_id: fisioId,
        procedure_id: procedimentoId,
        production_date: String(form.get("production_date") ?? ""),
        production_time: String(form.get("production_time") ?? ""),
        source: "manual",
        company_id: internacaoCriada.company_id,
      });
      notificarSucesso("Procedimento lançado.");
      setEtapa("concluido");
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Novo Atendimento"
        description="Cadastra paciente, internação e o primeiro procedimento em sequência — pode parar em qualquer etapa, não precisa completar tudo de uma vez."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-5">
          <Passo numero={1} titulo="Paciente" ativo={etapa === "paciente"} feito={etapa !== "paciente"} />
          <ArrowRight className="h-4 w-4 text-ink-soft" />
          <Passo numero={2} titulo="Internação" ativo={etapa === "internacao"} feito={etapa === "procedimento" || etapa === "concluido"} />
          <ArrowRight className="h-4 w-4 text-ink-soft" />
          <Passo numero={3} titulo="Procedimento" ativo={etapa === "procedimento"} feito={etapa === "concluido"} />
        </CardContent>
      </Card>

      {etapa === "paciente" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-4.5 w-4.5" /> Paciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex rounded-md bg-surface-sunken p-1 sm:w-80">
              <button
                type="button"
                onClick={() => setModoPaciente("existente")}
                className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${modoPaciente === "existente" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-soft"}`}
              >
                Paciente já cadastrado
              </button>
              <button
                type="button"
                onClick={() => setModoPaciente("novo")}
                className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${modoPaciente === "novo" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-soft"}`}
              >
                Novo paciente
              </button>
            </div>

            <form onSubmit={handleSubmitPaciente} className="flex flex-col gap-4">
              {modoPaciente === "existente" ? (
                <div className="flex flex-col gap-1.5 sm:w-96">
                  <Label>Selecione o paciente</Label>
                  <Combobox
                    value={pacienteExistenteId}
                    onValueChange={setPacienteExistenteId}
                    options={opcoesPacientes}
                    placeholder="Buscar paciente…"
                    searchPlaceholder="Nome do paciente…"
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5 sm:w-96">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input id="full_name" name="full_name" required placeholder="Ex.: Marina Salgado Costa" />
                  </div>
                  <div className="grid gap-3 sm:w-96 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="birth_date">Data de nascimento</Label>
                      <Input id="birth_date" name="birth_date" type="date" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Sexo</Label>
                      <Select value={sexoNovoPaciente} onValueChange={setSexoNovoPaciente}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:w-96">
                    <Label>Convênio</Label>
                    <Select value={convenioNovoPaciente} onValueChange={setConvenioNovoPaciente}>
                      <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:w-96">
                    <Label htmlFor="document">CPF (opcional)</Label>
                    <Input id="document" name="document" placeholder="000.000.000-00" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={salvando || (modoPaciente === "existente" && !pacienteExistenteId)}>
                  {salvando ? "Salvando…" : "Continuar para internação"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {etapa === "internacao" && pacienteAtual && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BedDouble className="h-4.5 w-4.5" /> Internação — {pacienteAtual.full_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitInternacao} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label>Unidade</Label>
                <Combobox
                  value={unidadeId}
                  onValueChange={(v) => { setUnidadeId(v); setLeitoId(""); }}
                  options={opcoesUnidades}
                  placeholder="Buscar unidade…"
                  searchPlaceholder="Nome da unidade…"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label>Leito (opcional)</Label>
                <Select value={leitoId} onValueChange={setLeitoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um leito livre" /></SelectTrigger>
                  <SelectContent>
                    {leitosDaUnidade.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum leito livre nesta unidade</SelectItem>
                    ) : (
                      leitosDaUnidade.map((l) => <SelectItem key={l.id} value={l.id}>{l.code}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label>Convênio</Label>
                <Select value={convenioInternacaoId} onValueChange={setConvenioInternacaoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:w-96 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admission_date">Data de entrada</Label>
                  <Input id="admission_date" name="admission_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admission_time">Horário</Label>
                  <Input id="admission_time" name="admission_time" type="time" required defaultValue={new Date().toTimeString().slice(0, 5)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEtapa("concluido")}>
                  Concluir aqui (sem internação)
                </Button>
                <Button type="submit" disabled={salvando || !unidadeId}>
                  {salvando ? "Salvando…" : "Continuar para procedimento"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {etapa === "procedimento" && pacienteAtual && internacaoCriada && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4.5 w-4.5" /> Procedimento — {pacienteAtual.full_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitProcedimento} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label>Fisioterapeuta</Label>
                <Combobox
                  value={fisioId}
                  onValueChange={setFisioId}
                  options={opcoesFisioterapeuta}
                  placeholder="Buscar fisioterapeuta…"
                  searchPlaceholder="Nome do fisioterapeuta…"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label>Procedimento</Label>
                <Combobox
                  value={procedimentoId}
                  onValueChange={setProcedimentoId}
                  options={opcoesProcedimento}
                  placeholder="Buscar procedimento…"
                  searchPlaceholder="Nome ou categoria…"
                />
              </div>
              <div className="grid gap-3 sm:w-96 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="production_date">Data</Label>
                  <Input id="production_date" name="production_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="production_time">Horário</Label>
                  <Input id="production_time" name="production_time" type="time" required defaultValue={new Date().toTimeString().slice(0, 5)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEtapa("concluido")}>
                  Concluir aqui (sem procedimento)
                </Button>
                <Button type="submit" disabled={salvando || !fisioId || !procedimentoId}>
                  {salvando ? "Salvando…" : "Lançar e concluir"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {etapa === "concluido" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-recovery-500" />
            <p className="font-display font-semibold text-ink">Feito!</p>
            <p className="text-sm text-ink-soft">
              {pacienteAtual?.full_name}
              {internacaoCriada ? " · internação registrada" : ""}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {internacaoCriada && (
                <Button
                  onClick={() => {
                    setProcedimentoId("");
                    setEtapa("procedimento");
                  }}
                >
                  <ClipboardList className="h-4 w-4" /> Adicionar mais procedimentos para o mesmo paciente
                </Button>
              )}
              <Button variant="secondary" onClick={reiniciar}>
                <RotateCcw className="h-4 w-4" /> Novo atendimento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
