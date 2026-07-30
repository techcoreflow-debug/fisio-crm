import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Download, TriangleAlert, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useDailyProduction,
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  useHealthInsurances,
  usePhysiotherapists,
  useProcedures,
} from "@/data/repository";
import { exportarCsv, type LinhaRelatorio } from "@/lib/csv";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

const CORES = ["#2f80ed", "#4f8f5f", "#d98d3d", "#bd4238", "#7db3ec", "#a8c4bd"];
const TODOS = "todos";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function PainelProducao() {
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const convenios = useHealthInsurances();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();

  const [periodoDe, setPeriodoDe] = useState(hoje());
  const [periodoAte, setPeriodoAte] = useState(hoje());
  const [hospitalId, setHospitalId] = useState(TODOS);
  const [unidadeId, setUnidadeId] = useState(TODOS);
  const [convenioId, setConvenioId] = useState(TODOS);
  const [fisioId, setFisioId] = useState(TODOS);
  const [categoria, setCategoria] = useState(TODOS);
  const [statusGlosa, setStatusGlosa] = useState<"todos" | "glosado" | "nao-glosado">("todos");

  const categoriasDisponiveis = useMemo(
    () => [...new Set(procedimentos.map((p) => p.category).filter((c): c is string => Boolean(c)))],
    [procedimentos]
  );

  function contexto(p: (typeof producao)[number]) {
    const internacao = internacoes.find((i) => i.id === p.admission_id);
    const procedimento = procedimentos.find((pr) => pr.id === p.procedure_id);
    return {
      internacao,
      procedimento,
      paciente: pacientes.find((pa) => pa.id === internacao?.patient_id),
      hospitalId: internacao?.hospital_id ?? null,
      unidadeId: internacao?.unit_id ?? null,
      convenioId: internacao?.health_insurance_id ?? null,
    };
  }

  const filtrados = useMemo(() => {
    return producao.filter((p) => {
      if (p.production_date < periodoDe || p.production_date > periodoAte) return false;
      const ctx = contexto(p);
      if (hospitalId !== TODOS && ctx.hospitalId !== hospitalId) return false;
      if (unidadeId !== TODOS && ctx.unidadeId !== unidadeId) return false;
      if (convenioId !== TODOS && ctx.convenioId !== convenioId) return false;
      if (fisioId !== TODOS && p.physiotherapist_id !== fisioId) return false;
      if (categoria !== TODOS && ctx.procedimento?.category !== categoria) return false;
      if (statusGlosa === "glosado" && !p.glosado) return false;
      if (statusGlosa === "nao-glosado" && p.glosado) return false;
      return true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [producao, periodoDe, periodoAte, hospitalId, unidadeId, convenioId, fisioId, categoria, statusGlosa, internacoes, procedimentos]);

  const totalProcedimentos = filtrados.length;
  const glosados = filtrados.filter((p) => p.glosado);
  const valorGlosado = glosados.reduce((acc, p) => acc + (p.valor_glosado ?? 0), 0);
  const taxaGlosa = totalProcedimentos > 0 ? Math.round((glosados.length / totalProcedimentos) * 1000) / 10 : 0;

  const porCategoria = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of filtrados) {
      const cat = contexto(p).procedimento?.category ?? "Sem categoria";
      contagem.set(cat, (contagem.get(cat) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).map(([categoria, total]) => ({ categoria, total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, procedimentos, internacoes]);

  const porConvenio = useMemo(() => {
    const contagem = new Map<string, { total: number; glosados: number }>();
    for (const p of filtrados) {
      const nome = convenios.find((c) => c.id === contexto(p).convenioId)?.name ?? "Sem convênio";
      const atual = contagem.get(nome) ?? { total: 0, glosados: 0 };
      atual.total += 1;
      if (p.glosado) atual.glosados += 1;
      contagem.set(nome, atual);
    }
    return Array.from(contagem.entries()).map(([convenio, v]) => ({ convenio, ...v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, convenios, internacoes]);

  const evolucaoDiaria = useMemo(() => {
    const porDia = new Map<string, { total: number; glosados: number }>();
    for (const p of filtrados) {
      const atual = porDia.get(p.production_date) ?? { total: 0, glosados: 0 };
      atual.total += 1;
      if (p.glosado) atual.glosados += 1;
      porDia.set(p.production_date, atual);
    }
    return Array.from(porDia.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ data: data.slice(8, 10) + "/" + data.slice(5, 7), ...v }));
  }, [filtrados]);

  function handleExportar() {
    try {
      const linhas: LinhaRelatorio[] = filtrados.map((p) => {
        const ctx = contexto(p);
        return {
          Data: p.production_date.split("-").reverse().join("/"),
          Hora: p.production_time?.slice(0, 5) ?? "—",
          Hospital: hospitais.find((h) => h.id === ctx.hospitalId)?.name ?? "—",
          Unidade: unidades.find((u) => u.id === ctx.unidadeId)?.name ?? "—",
          Paciente: ctx.paciente?.full_name ?? "—",
          Convênio: convenios.find((c) => c.id === ctx.convenioId)?.name ?? "—",
          Categoria: ctx.procedimento?.category ?? "—",
          "Código do procedimento": ctx.procedimento?.code ?? "—",
          Procedimento: ctx.procedimento?.name ?? "—",
          Fisioterapeuta: fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—",
          Glosado: p.glosado ? "Sim" : "Não",
          "Valor glosado": p.valor_glosado ?? 0,
        };
      });
      exportarCsv("painel-procedimentos", linhas);
      notificarSucesso(`Exportado (${linhas.length} linha(s)).`);
    } catch (erro) {
      notificarErro("Não foi possível exportar", erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel de Procedimentos"
        description="Cruze os procedimentos lançados com glosa — filtre por período, unidade, convênio, fisioterapeuta e categoria."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodo_de">De</Label>
            <Input id="periodo_de" type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodo_ate">Até</Label>
            <Input id="periodo_ate" type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Hospital</Label>
            <Select value={hospitalId} onValueChange={setHospitalId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {hospitais.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {unidades
                  .filter((u) => hospitalId === TODOS || u.hospital_id === hospitalId)
                  .map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Convênio</Label>
            <Select value={convenioId} onValueChange={setConvenioId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Fisioterapeuta</Label>
            <Select value={fisioId} onValueChange={setFisioId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {fisioterapeutas.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {categoriasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Glosa</Label>
            <Select value={statusGlosa} onValueChange={(v) => setStatusGlosa(v as typeof statusGlosa)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="glosado">Só glosados</SelectItem>
                <SelectItem value="nao-glosado">Só não glosados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExportar} disabled={totalProcedimentos === 0} className="ml-auto">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Procedimentos no período</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{totalProcedimentos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Glosados</p>
            <p className="mt-1 font-display text-2xl font-semibold text-critical-600">{glosados.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Valor glosado</p>
            <p className="mt-1 font-display text-2xl font-semibold text-critical-600">R$ {valorGlosado.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Taxa de glosa</p>
            <p className="mt-1 font-display text-2xl font-semibold text-attention-600">{taxaGlosa}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            {porCategoria.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem dados no filtro atual.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porCategoria} dataKey="total" nameKey="categoria" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Por convênio — total x glosados</CardTitle></CardHeader>
          <CardContent className="h-64">
            {porConvenio.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem dados no filtro atual.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porConvenio} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                  <XAxis dataKey="convenio" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="#2f80ed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="glosados" name="Glosados" fill="#bd4238" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Evolução diária</CardTitle></CardHeader>
        <CardContent className="h-64">
          {evolucaoDiaria.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem dados no filtro atual.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoDiaria} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                <XAxis dataKey="data" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#2f80ed" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="glosados" name="Glosados" stroke="#bd4238" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Procedimentos ({totalProcedimentos})</CardTitle></CardHeader>
        {filtrados.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-ink-soft" />
            <p className="text-sm text-ink-soft">Nenhum procedimento no filtro atual.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                  <th className="px-4 py-3 font-medium">Glosa</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 200).map((p) => {
                  const ctx = contexto(p);
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                        {p.production_date.split("-").reverse().join("/")} {p.production_time?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{ctx.paciente?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">{convenios.find((c) => c.id === ctx.convenioId)?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {ctx.procedimento ? <><span className="font-mono text-xs">{ctx.procedimento.code}</span> {ctx.procedimento.name}</> : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {p.glosado ? (
                          <Badge variant="critical"><TriangleAlert className="h-3 w-3" /> R$ {(p.valor_glosado ?? 0).toLocaleString("pt-BR")}</Badge>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtrados.length > 200 && (
              <p className="p-3 text-center text-xs text-ink-soft">
                Mostrando as primeiras 200 de {filtrados.length} linhas — exporte o CSV para ver todas.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
