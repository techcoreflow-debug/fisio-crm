import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ClipboardCheck, CircleDashed, ClipboardList, Building2, Download, TriangleAlert, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useDailyProduction,
  useAdmissions,
  usePatients,
  useHospitals,
  useHealthInsurances,
  useProcedures,
} from "@/data/repository";
import { exportarCsv, type LinhaRelatorio } from "@/lib/csv";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

const TODOS = "todos";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}
function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function primeiroDiaSemana(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const diaSemana = d.getDay() || 7;
  d.setDate(d.getDate() - diaSemana + 1);
  return d.toISOString().slice(0, 10);
}
function primeiroDiaMes(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

type Preset = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

export default function Fechamento() {
  const [atualizadoAgora, setAtualizadoAgora] = useState(false);
  function handleAtualizarAgora() {
    window.dispatchEvent(new Event("fisio:forcar-recarga"));
    setAtualizadoAgora(true);
    setTimeout(() => setAtualizadoAgora(false), 2000);
  }
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();
  const procedimentos = useProcedures();

  const hoje = hojeIso();
  const [preset, setPreset] = useState<Preset>("semana");
  const [personalizadoDe, setPersonalizadoDe] = useState(primeiroDiaSemana(hoje));
  const [personalizadoAte, setPersonalizadoAte] = useState(hoje);
  const [hospitalId, setHospitalId] = useState(TODOS);
  const [convenioId, setConvenioId] = useState(TODOS);

  const { periodoDe, periodoAte } = useMemo(() => {
    switch (preset) {
      case "hoje":
        return { periodoDe: hoje, periodoAte: hoje };
      case "ontem": {
        const ontem = somarDias(hoje, -1);
        return { periodoDe: ontem, periodoAte: ontem };
      }
      case "semana":
        return { periodoDe: primeiroDiaSemana(hoje), periodoAte: hoje };
      case "mes":
        return { periodoDe: primeiroDiaMes(hoje), periodoAte: hoje };
      default:
        return { periodoDe: personalizadoDe, periodoAte: personalizadoAte };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, personalizadoDe, personalizadoAte, hoje]);

  function contexto(p: (typeof producao)[number]) {
    const internacao = internacoes.find((i) => i.id === p.admission_id);
    return {
      paciente: pacientes.find((pa) => pa.id === internacao?.patient_id),
      hospitalId: internacao?.hospital_id ?? null,
      convenioId: internacao?.health_insurance_id ?? null,
      nrAtendimento: internacao?.external_reference ?? null,
    };
  }

  const filtrados = useMemo(() => {
    return producao.filter((p) => {
      if (p.production_date < periodoDe || p.production_date > periodoAte) return false;
      const ctx = contexto(p);
      if (hospitalId !== TODOS && ctx.hospitalId !== hospitalId) return false;
      if (convenioId !== TODOS && ctx.convenioId !== convenioId) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producao, periodoDe, periodoAte, hospitalId, convenioId, internacoes, pacientes]);

  const totalLancado = filtrados.length;
  const confirmados = filtrados.filter((p) => p.confirmado_tasy);
  const naoConfirmados = filtrados.filter((p) => !p.confirmado_tasy);
  const taxaConfirmacao = totalLancado > 0 ? Math.round((confirmados.length / totalLancado) * 100) : 0;

  const porDia = useMemo(() => {
    const mapa = new Map<string, { lancado: number; confirmado: number }>();
    for (const p of filtrados) {
      const atual = mapa.get(p.production_date) ?? { lancado: 0, confirmado: 0 };
      atual.lancado += 1;
      if (p.confirmado_tasy) atual.confirmado += 1;
      mapa.set(p.production_date, atual);
    }
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ dia: data.slice(8, 10) + "/" + data.slice(5, 7), ...v }));
  }, [filtrados]);

  const porHospital = useMemo(() => {
    const mapa = new Map<string, { lancado: number; confirmado: number }>();
    for (const p of filtrados) {
      const nome = hospitais.find((h) => h.id === contexto(p).hospitalId)?.name ?? "Sem hospital";
      const atual = mapa.get(nome) ?? { lancado: 0, confirmado: 0 };
      atual.lancado += 1;
      if (p.confirmado_tasy) atual.confirmado += 1;
      mapa.set(nome, atual);
    }
    return Array.from(mapa.entries()).map(([hospital, v]) => ({ hospital, ...v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, hospitais, internacoes]);

  function handleExportar() {
    try {
      const linhas: LinhaRelatorio[] = filtrados.map((p) => {
        const ctx = contexto(p);
        const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
        return {
          Data: p.production_date.split("-").reverse().join("/"),
          Hora: p.production_time?.slice(0, 5) ?? "—",
          Paciente: ctx.paciente?.full_name ?? "—",
          Hospital: hospitais.find((h) => h.id === ctx.hospitalId)?.name ?? "—",
          Convênio: convenios.find((c) => c.id === ctx.convenioId)?.name ?? "—",
          "Código do procedimento": proc?.code ?? "—",
          Procedimento: proc?.name ?? "—",
          Status: p.confirmado_tasy ? "Confirmado" : "Não confirmado",
        };
      });
      exportarCsv("fechamento", linhas);
      notificarSucesso(`Exportado (${linhas.length} linha(s)).`);
    } catch (erro) {
      notificarErro("Não foi possível exportar", erro);
    }
  }

  const presets: { id: Preset; label: string }[] = [
    { id: "hoje", label: "Hoje" },
    { id: "ontem", label: "Ontem" },
    { id: "semana", label: "Esta semana" },
    { id: "mes", label: "Este mês" },
    { id: "personalizado", label: "Personalizado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fechamento"
        description="Lançado × confirmado pelo Tasy — o fechamento do período, por hospital, pronto para conferência."
        actions={
          <Button variant="secondary" size="sm" onClick={handleAtualizarAgora}>
            <RefreshCw className="h-3.5 w-3.5" /> {atualizadoAgora ? "Atualizado!" : "Atualizar agora"}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? "primary" : "secondary"}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {preset === "personalizado" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={personalizadoDe}
                onChange={(e) => setPersonalizadoDe(e.target.value)}
                className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink"
              />
              <span className="text-xs text-ink-soft">até</span>
              <input
                type="date"
                value={personalizadoAte}
                onChange={(e) => setPersonalizadoAte(e.target.value)}
                className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink"
              />
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={hospitalId} onValueChange={setHospitalId}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os hospitais</SelectItem>
                {hospitais.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={convenioId} onValueChange={setConvenioId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os convênios</SelectItem>
                {convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={handleExportar} disabled={totalLancado === 0}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge value={taxaConfirmacao} label="Taxa de confirmação" tone="clinical" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Lançado</p>
                <p className="font-display text-2xl font-semibold text-ink">{totalLancado}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Confirmado (Tasy)</p>
                <p className="font-display text-2xl font-semibold text-recovery-600">{confirmados.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attention-100 text-attention-600">
                <CircleDashed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Não confirmado</p>
                <p className="font-display text-2xl font-semibold text-attention-600">{naoConfirmados.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {totalLancado > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="bg-recovery-500" style={{ width: `${taxaConfirmacao}%` }} />
              <div className="bg-attention-400" style={{ width: `${100 - taxaConfirmacao}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-soft">
              <span>{confirmados.length} confirmado(s)</span>
              <span>{naoConfirmados.length} não confirmado(s)</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lançado × confirmado por dia</CardTitle></CardHeader>
          <CardContent className="h-64">
            {porDia.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem lançamentos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="lancado" name="Lançado" fill="#2f80ed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="confirmado" name="Confirmado" fill="#4f8f5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4.5 w-4.5" /> Por hospital</CardTitle></CardHeader>
          <CardContent className="h-64">
            {porHospital.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem lançamentos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porHospital} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                  <XAxis dataKey="hospital" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="lancado" name="Lançado" fill="#2f80ed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="confirmado" name="Confirmado" fill="#4f8f5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TriangleAlert className="h-4.5 w-4.5 text-attention-600" /> Não confirmados ({naoConfirmados.length})</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">
            Lançados no período mas que ainda não bateram com o Tasy. Edite, confirme os dados, ou registre glosa
            em Produção Diária.
          </p>
        </CardHeader>
        {naoConfirmados.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-ink-soft">Tudo confirmado neste período.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Nr. Atendimento</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Glosa</th>
                </tr>
              </thead>
              <tbody>
                {naoConfirmados.slice(0, 100).map((p) => {
                  const ctx = contexto(p);
                  const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                        {p.production_date.split("-").reverse().join("/")} {p.production_time?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{ctx.nrAtendimento ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-ink">{ctx.paciente?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">{hospitais.find((h) => h.id === ctx.hospitalId)?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {proc ? <><span className="font-mono text-xs">{proc.code}</span> {proc.name}</> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.glosado ? (
                          <Badge variant="critical">R$ {(p.valor_glosado ?? 0).toLocaleString("pt-BR")}</Badge>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {naoConfirmados.length > 100 && (
              <p className="p-3 text-center text-xs text-ink-soft">
                Mostrando as primeiras 100 de {naoConfirmados.length} — exporte o CSV para ver todas.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
