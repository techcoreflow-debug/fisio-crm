import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, BedDouble, LogOut, AlertTriangle, ClipboardPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  useBeds,
  useHealthInsurances,
  usePhysiotherapists,
  useProcedures,
  useDailyProduction,
  repository,
} from "@/data/repository";
import { Combobox } from "@/components/ui/combobox";
import { Paginacao, usarPaginacao } from "@/components/shared/paginacao";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useDraftState } from "@/lib/use-draft-state";
import { useAuth } from "@/auth/auth-provider";
import type { Admission } from "@/types/domain";

type StatusInternacao = "internado" | "alta";

const statusConfig: Record<StatusInternacao, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  internado: { label: "Internado", variant: "clinical" },
  alta: { label: "Alta", variant: "neutral" },
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function agoraParaInputDatetime() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 16);
}

export default function Internacoes() {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const leitos = useBeds();
  const convenios = useHealthInsurances();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();
  const producao = useDailyProduction();
  const { profile } = useAuth();
  // Fisioterapeuta lançador: só lança procedimento e cadastra paciente —
  // não administra internação (criar/editar/dar alta continua restrito).
  const podeAdministrarInternacao = !(profile?.role === "fisioterapeuta" && !profile.is_platform_admin);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const internacoesComAtendimentoHoje = useMemo(
    () => new Set(producao.filter((p) => p.production_date === hojeIso).map((p) => p.admission_id)),
    [producao, hojeIso]
  );

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas");
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Rascunho do formulário "Nova/Editar internação" — sobrevive a um
  // reload de aba (tablet descartando aba em 2º plano). Ver use-draft-state.ts.
  const [rascunho, setRascunho, limparRascunho] = useDraftState("internacao-form", {
    open: false,
    editandoId: null as string | null,
    pacienteId: "",
    unidadeId: "",
    leitoId: "",
    convenioId: "",
  });
  const open = rascunho.open;
  const editando = rascunho.editandoId ? internacoes.find((i) => i.id === rascunho.editandoId) ?? null : null;
  const pacienteId = rascunho.pacienteId;
  const unidadeId = rascunho.unidadeId;
  const leitoId = rascunho.leitoId;
  const convenioId = rascunho.convenioId;
  const setOpen = (v: boolean) => setRascunho({ ...rascunho, open: v });
  const setPacienteId = (v: string) => setRascunho({ ...rascunho, pacienteId: v });
  const setUnidadeId = (v: string) => setRascunho({ ...rascunho, unidadeId: v });
  const setLeitoId = (v: string) => setRascunho({ ...rascunho, leitoId: v });
  const setConvenioId = (v: string) => setRascunho({ ...rascunho, convenioId: v });

  const leitosDaUnidade = leitos.filter(
    (l) => l.unit_id === unidadeId && (l.status === "livre" || l.id === editando?.bed_id)
  );

  // Fluxo de alta — precisa de mais de uma etapa quando não há atendimento
  // lançado no dia, por isso vive num Sheet separado com seu próprio estado.
  const [internacaoParaAlta, setInternacaoParaAlta] = useState<Admission | null>(null);
  const [etapaAlta, setEtapaAlta] = useState<"data" | "sem-atendimento" | "lancar">("data");
  const [dataHoraAlta, setDataHoraAlta] = useState(agoraParaInputDatetime());
  const [salvandoAlta, setSalvandoAlta] = useState(false);
  const [fisioAltaId, setFisioAltaId] = useState(fisioterapeutas[0]?.id ?? "");
  const [procedimentoAltaId, setProcedimentoAltaId] = useState(procedimentos[0]?.id ?? "");

  // Lançar procedimento direto da lista — não precisa sair daqui e ir
  // procurar o paciente de novo em Produção Diária.
  const [internacaoParaLancar, setInternacaoParaLancar] = useState<Admission | null>(null);
  const [fisioLancarId, setFisioLancarId] = useState(fisioterapeutas[0]?.id ?? "");
  const [procedimentoLancarId, setProcedimentoLancarId] = useState(procedimentos[0]?.id ?? "");
  const [dataLancar, setDataLancar] = useState(hojeIso);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  function abrirLancarProcedimento(internacao: Admission) {
    setInternacaoParaLancar(internacao);
    setFisioLancarId(fisioterapeutas[0]?.id ?? "");
    setProcedimentoLancarId(procedimentos[0]?.id ?? "");
    setDataLancar(hojeIso);
  }

  async function handleLancarProcedimento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaLancar) return;
    setSalvandoLancamento(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoParaLancar.id,
        physiotherapist_id: fisioLancarId,
        procedure_id: procedimentoLancarId,
        production_date: dataLancar,
        source: "manual",
        company_id: internacaoParaLancar.company_id,
      });
      notificarSucesso("Procedimento lançado.");
      setInternacaoParaLancar(null);
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
    } finally {
      setSalvandoLancamento(false);
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return internacoes.filter((i) => {
      if (filtroUnidade !== "todas" && i.unit_id !== filtroUnidade) return false;
      if (apenasPendentes && (i.status !== "internado" || internacoesComAtendimentoHoje.has(i.id))) return false;
      if (!termo) return true;
      const paciente = pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "";
      return paciente.toLowerCase().includes(termo) || String(i.admission_number).includes(termo);
    });
  }, [busca, filtroUnidade, apenasPendentes, internacoes, pacientes, internacoesComAtendimentoHoje]);

  const { pagina: paginaAtual, totalPaginas, paginaValida } = usarPaginacao(filtradas, 25, pagina);

  function abrirNova() {
    setRascunho({
      open: true,
      editandoId: null,
      pacienteId: pacientes[0]?.id ?? "",
      unidadeId: unidades[0]?.id ?? "",
      leitoId: "",
      convenioId: convenios[0]?.id ?? "",
    });
  }

  function abrirEdicao(internacao: Admission) {
    setRascunho({
      open: true,
      editandoId: internacao.id,
      pacienteId: internacao.patient_id,
      unidadeId: internacao.unit_id ?? "",
      leitoId: internacao.bed_id ?? "",
      convenioId: internacao.health_insurance_id ?? "",
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!paciente || !unidade) return;
    setSalvando(true);
    try {
      const dados = {
        patient_id: pacienteId,
        hospital_id: unidade.hospital_id,
        unit_id: unidadeId,
        bed_id: leitoId || null,
        health_insurance_id: convenioId || null,
        admission_date: String(form.get("admission_date") ?? ""),
        company_id: paciente.company_id,
      };
      if (editando) {
        await repository.admissions.update(editando.id, dados);
        notificarSucesso("Internação atualizada.");
      } else {
        await repository.admissions.create(dados);
        notificarSucesso("Internação registrada.");
      }
      limparRascunho();
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível registrar a internação", erro);
    } finally {
      setSalvando(false);
    }
  }

  function abrirFluxoAlta(internacao: Admission) {
    setInternacaoParaAlta(internacao);
    setEtapaAlta("data");
    setDataHoraAlta(agoraParaInputDatetime());
  }

  async function handleConfirmarData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      await tentarAlta(false);
    } finally {
      setSalvandoAlta(false);
    }
  }

  async function tentarAlta(semAtendimento: boolean) {
    if (!internacaoParaAlta) return;
    try {
      const iso = new Date(dataHoraAlta).toISOString();
      await repository.admissions.discharge(internacaoParaAlta.id, iso, semAtendimento);
      notificarSucesso("Alta registrada. O leito foi liberado para higienização.");
      setInternacaoParaAlta(null);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "SEM_ATENDIMENTO_NA_ALTA") {
        setEtapaAlta("sem-atendimento");
        return;
      }
      notificarErro("Não foi possível registrar a alta", erro);
    }
  }

  async function handleLancarELiberar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoParaAlta.id,
        physiotherapist_id: fisioAltaId,
        procedure_id: procedimentoAltaId,
        production_date: dataHoraAlta.slice(0, 10),
        source: "manual",
        company_id: internacaoParaAlta.company_id,
      });
      await tentarAlta(false);
    } catch (erro) {
      notificarErro("Não foi possível lançar o atendimento", erro);
    } finally {
      setSalvandoAlta(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes Internados"
        description="Pacientes internados acompanhados pela equipe, com leito, hospital, convênio e status de atendimento do dia."
        actions={
          podeAdministrarInternacao ? (
            <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : limparRascunho())}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova internação
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "nova"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar internação" : "Nova internação"}</SheetTitle>
                  <SheetDescription>Ao escolher um leito livre, ele passa automaticamente para ocupado.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Paciente</Label>
                    <Select value={pacienteId} onValueChange={setPacienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>
                        {pacientes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Unidade</Label>
                    <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setLeitoId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Leito (opcional)</Label>
                    <Select value={leitoId} onValueChange={setLeitoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um leito livre" /></SelectTrigger>
                      <SelectContent>
                        {leitosDaUnidade.length === 0 ? (
                          <SelectItem value="none" disabled>Nenhum leito livre nesta unidade</SelectItem>
                        ) : (
                          leitosDaUnidade.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.code}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Convênio</Label>
                    <Select value={convenioId} onValueChange={setConvenioId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="admission_date">Data de entrada</Label>
                    <Input id="admission_date" name="admission_date" type="date" required defaultValue={editando?.admission_date ?? ""} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => limparRascunho()}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !pacienteId || !unidadeId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar internação"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por paciente ou código…" className="pl-9" />
            </div>
            <Select value={filtroUnidade} onValueChange={(v) => { setFiltroUnidade(v); setPagina(1); }}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={apenasPendentes ? "primary" : "secondary"}
              size="sm"
              onClick={() => { setApenasPendentes((v) => !v); setPagina(1); }}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Só pendentes de hoje
            </Button>
          </div>
          <p className="whitespace-nowrap text-sm text-ink-soft">{filtradas.length} de {internacoes.length} internações</p>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BedDouble className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum paciente internado encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os filtros ou registre uma nova internação.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Hospital / Unidade</th>
                  <th className="px-4 py-3 font-medium">Leito</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Hoje</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {paginaAtual.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">IN-{String(i.admission_number).padStart(6, "0")}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"}
                      <span className="block text-xs">{unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">{leitos.find((l) => l.id === i.bed_id)?.code ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{convenios.find((c) => c.id === i.health_insurance_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{formatarData(i.admission_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[i.status as StatusInternacao]?.variant ?? "neutral"}>
                        {statusConfig[i.status as StatusInternacao]?.label ?? i.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {i.status === "internado" ? (
                        internacoesComAtendimentoHoje.has(i.id) ? (
                          <Badge variant="recovery">Lançado</Badge>
                        ) : (
                          <Badge variant="attention">
                            <AlertTriangle className="h-3 w-3" /> Pendente
                          </Badge>
                        )
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {podeAdministrarInternacao && (
                          <Button variant="ghost" size="icon" aria-label="Editar internação" onClick={() => abrirEdicao(i)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {i.status === "internado" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => abrirLancarProcedimento(i)}>
                              <ClipboardPlus className="h-3.5 w-3.5" /> Lançar procedimento
                            </Button>
                            {podeAdministrarInternacao && (
                              <Button variant="ghost" size="sm" onClick={() => abrirFluxoAlta(i)}>
                                <LogOut className="h-3.5 w-3.5" /> Dar alta
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao
          paginaAtual={paginaValida}
          totalPaginas={totalPaginas}
          onChange={setPagina}
          totalItens={filtradas.length}
          itensPorPagina={25}
        />
      </Card>

      <Sheet open={internacaoParaAlta !== null} onOpenChange={(open) => !open && setInternacaoParaAlta(null)}>
        <SheetContent>
          {etapaAlta === "data" && (
            <form className="flex h-full flex-col" onSubmit={handleConfirmarData}>
              <SheetHeader>
                <SheetTitle>Dar alta</SheetTitle>
                <SheetDescription>
                  {internacaoParaAlta && (pacientes.find((p) => p.id === internacaoParaAlta.patient_id)?.full_name ?? "—")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="discharge_at">Data e hora da alta</Label>
                  <Input
                    id="discharge_at"
                    type="datetime-local"
                    required
                    value={dataHoraAlta}
                    onChange={(e) => setDataHoraAlta(e.target.value)}
                  />
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setInternacaoParaAlta(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvandoAlta}>{salvandoAlta ? "Verificando…" : "Confirmar alta"}</Button>
              </SheetFooter>
            </form>
          )}

          {etapaAlta === "sem-atendimento" && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle>Nenhum atendimento lançado hoje</SheetTitle>
                <SheetDescription>
                  Não há procedimento lançado para este paciente na data da alta ({dataHoraAlta.slice(0, 10).split("-").reverse().join("/")}).
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-2.5 rounded-md bg-attention-100 p-3 text-sm text-attention-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Recebeu atendimento antes da alta? Lance agora, ou confirme que não houve atendimento.
                </div>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button type="button" onClick={() => setEtapaAlta("lancar")} disabled={salvandoAlta}>
                  Lançar atendimento agora
                </Button>
                <Button type="button" variant="secondary" onClick={() => tentarAlta(true)} disabled={salvandoAlta}>
                  {salvandoAlta ? "Salvando…" : "Confirmar que não houve atendimento"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEtapaAlta("data")}>Voltar</Button>
              </SheetFooter>
            </div>
          )}

          {etapaAlta === "lancar" && (
            <form className="flex h-full flex-col" onSubmit={handleLancarELiberar}>
              <SheetHeader>
                <SheetTitle>Lançar atendimento antes da alta</SheetTitle>
                <SheetDescription>Registra o procedimento e, em seguida, confirma a alta automaticamente.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Fisioterapeuta</Label>
                  <Select value={fisioAltaId} onValueChange={setFisioAltaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o fisioterapeuta" /></SelectTrigger>
                    <SelectContent>
                      {fisioterapeutas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Procedimento</Label>
                  <Select value={procedimentoAltaId} onValueChange={setProcedimentoAltaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                    <SelectContent>
                      {procedimentos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setEtapaAlta("sem-atendimento")}>Voltar</Button>
                <Button type="submit" disabled={salvandoAlta || !fisioAltaId || !procedimentoAltaId}>
                  {salvandoAlta ? "Salvando…" : "Lançar e confirmar alta"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={internacaoParaLancar !== null} onOpenChange={(open) => !open && setInternacaoParaLancar(null)}>
        <SheetContent>
          <form className="flex h-full flex-col" onSubmit={handleLancarProcedimento}>
            <SheetHeader>
              <SheetTitle>Lançar procedimento</SheetTitle>
              <SheetDescription>
                {internacaoParaLancar && (pacientes.find((p) => p.id === internacaoParaLancar.patient_id)?.full_name ?? "—")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Fisioterapeuta</Label>
                <Combobox
                  value={fisioLancarId}
                  onValueChange={setFisioLancarId}
                  options={fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name }))}
                  placeholder="Buscar fisioterapeuta…"
                  searchPlaceholder="Nome do fisioterapeuta…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Procedimento</Label>
                <Combobox
                  value={procedimentoLancarId}
                  onValueChange={setProcedimentoLancarId}
                  options={procedimentos.map((p) => ({ value: p.id, label: p.name, sublabel: p.category ?? undefined }))}
                  placeholder="Buscar procedimento…"
                  searchPlaceholder="Nome ou categoria…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="data_lancar">Data</Label>
                <Input id="data_lancar" type="date" required value={dataLancar} onChange={(e) => setDataLancar(e.target.value)} />
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setInternacaoParaLancar(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoLancamento || !fisioLancarId || !procedimentoLancarId}>
                {salvandoLancamento ? "Salvando…" : "Lançar procedimento"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
