import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, Pencil, BedDouble } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useBeds, useUnits, useHospitals, useRooms, useAdmissions, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Bed } from "@/types/domain";

const statusStyles: Record<string, string> = {
  livre: "bg-recovery-100 text-recovery-600 border-recovery-400/40",
  ocupado: "bg-clinical-50 text-clinical-700 border-clinical-300",
  higienizacao: "bg-attention-100 text-attention-600 border-attention-400/40",
};

const statusLabel: Record<string, string> = { livre: "Livre", ocupado: "Ocupado", higienizacao: "Em higienização" };

const legenda = ["livre", "ocupado", "higienizacao"];

const SEM_QUARTO = "__sem_quarto__";

/** Padrão da casa: 2h em higienização antes de poder ser considerado livre de novo. */
const HORAS_HIGIENIZACAO = 2;

export default function Leitos() {
  const leitos = useBeds();
  const unidades = useUnits();
  const hospitais = useHospitals();
  const quartos = useRooms();
  const internacoes = useAdmissions();

  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [quartoId, setQuartoId] = useState(SEM_QUARTO);
  const [editando, setEditando] = useState<Bed | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroHospital, setFiltroHospital] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [filtroSemQuarto, setFiltroSemQuarto] = useState(false);

  const totalLeitos = leitos.length;

  function statusVisual(leito: Bed): "ocupado" | "higienizacao" | "livre" {
    const temInternacaoAtiva = internacoes.some((i) => i.bed_id === leito.id && i.status === "internado");
    if (temInternacaoAtiva) return "ocupado";
    if (leito.status === "higienizacao") {
      if (leito.higienizacao_desde) {
        const decorridoMs = Date.now() - new Date(leito.higienizacao_desde).getTime();
        if (decorridoMs >= HORAS_HIGIENIZACAO * 60 * 60 * 1000) return "livre";
      }
      return "higienizacao";
    }
    return "livre";
  }

  function minutosRestantes(leito: Bed): number | null {
    if (!leito.higienizacao_desde) return null;
    const decorridoMs = Date.now() - new Date(leito.higienizacao_desde).getTime();
    const restanteMs = HORAS_HIGIENIZACAO * 60 * 60 * 1000 - decorridoMs;
    return restanteMs > 0 ? Math.ceil(restanteMs / 60000) : 0;
  }

  const quartosDaUnidade = quartos.filter((q) => q.unit_id === unidadeId);

  useEffect(() => {
    for (const leito of leitos) {
      const visual = statusVisual(leito);
      if (leito.status !== visual && visual === "livre") {
        repository.beds.updateStatus(leito.id, "livre").catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitos, internacoes]);

  const [, forcarAtualizacao] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forcarAtualizacao((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function abrirNovo(unidadePreselecionada?: string) {
    setEditando(null);
    setUnidadeId(unidadePreselecionada ?? unidades[0]?.id ?? "");
    setQuartoId(SEM_QUARTO);
    setOpen(true);
  }

  function abrirEdicao(leito: Bed) {
    setEditando(leito);
    setUnidadeId(leito.unit_id);
    setQuartoId(leito.room_id ?? SEM_QUARTO);
    setOpen(true);
  }

  async function handleExcluir(id: string, code: string) {
    if (!window.confirm(`Excluir o leito "${code}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await repository.beds.remove(id);
      notificarSucesso(`Leito "${code}" excluído.`);
    } catch (erro) {
      notificarErro(`Não foi possível excluir o leito "${code}"`, erro);
    }
  }

  async function handleLiberarLeito(id: string) {
    try {
      await repository.beds.updateStatus(id, "livre");
      notificarSucesso("Leito liberado.");
    } catch (erro) {
      notificarErro("Não foi possível liberar o leito", erro);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!unidade) {
      notificarErro("Não foi possível salvar", "Selecione uma ala/unidade válida.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await repository.beds.update(editando.id, {
          unit_id: unidadeId,
          room_id: quartoId === SEM_QUARTO ? null : quartoId,
          code: String(form.get("code") ?? ""),
          company_id: unidade.company_id,
        });
        notificarSucesso("Leito atualizado.");
      } else {
        await repository.beds.create({
          unit_id: unidadeId,
          room_id: quartoId === SEM_QUARTO ? null : quartoId,
          code: String(form.get("code") ?? ""),
          status: "livre",
          company_id: unidade.company_id,
        });
        notificarSucesso("Leito criado.");
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar o leito", erro);
    } finally {
      setSalvando(false);
    }
  }

  const leitosFiltrados = leitos.filter((l) => {
    const unidade = unidades.find((u) => u.id === l.unit_id);
    if (filtroHospital !== "todos" && unidade?.hospital_id !== filtroHospital) return false;
    if (filtroUnidade !== "todas" && l.unit_id !== filtroUnidade) return false;
    if (filtroSemQuarto && l.room_id !== null) return false;
    if (busca.trim() && !l.code.toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  });

  const ocupados = leitosFiltrados.filter((l) => statusVisual(l) === "ocupado");
  const emHigienizacao = leitosFiltrados.filter((l) => statusVisual(l) === "higienizacao");
  const livres = leitosFiltrados.filter((l) => statusVisual(l) === "livre");

  function contexto(leito: Bed) {
    const unidade = unidades.find((u) => u.id === leito.unit_id);
    const hospital = hospitais.find((h) => h.id === unidade?.hospital_id);
    const quarto = quartos.find((q) => q.id === leito.room_id);
    return { unidade, hospital, quarto };
  }

  function CardLeito({ leito }: { leito: Bed }) {
    const internacaoAtiva = internacoes.find((i) => i.bed_id === leito.id && i.status === "internado");
    const status = statusVisual(leito);
    const { unidade, hospital, quarto } = contexto(leito);
    const restante = status === "higienizacao" ? minutosRestantes(leito) : null;
    return (
      <div
        className={cn(
          "group relative flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-3 text-center",
          statusStyles[status]
        )}
        title={`${hospital?.name ?? "—"} · ${unidade?.name ?? "—"}`}
      >
        {!internacaoAtiva && (
          <>
            <button
              type="button"
              onClick={() => handleExcluir(leito.id, leito.code)}
              aria-label={`Excluir leito ${leito.code}`}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-critical-400 text-white group-hover:flex"
            >
              <X className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => abrirEdicao(leito)}
              aria-label={`Editar leito ${leito.code}`}
              className="absolute -left-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-clinical-500 text-white group-hover:flex"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </>
        )}
        <span className="font-mono text-xs font-semibold">{leito.code}</span>
        <span className="truncate text-[10px] text-ink-soft/80">{quarto ? quarto.code : "sem quarto"}</span>
        {status === "higienizacao" && (
          <>
            {restante !== null && restante > 0 && (
              <span className="text-[10px] text-attention-700">~{restante} min</span>
            )}
            <button
              type="button"
              onClick={() => handleLiberarLeito(leito.id)}
              className="mt-0.5 rounded-sm bg-attention-400 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-attention-600"
            >
              Liberar agora
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leitos"
        description="Mapa de leitos com ocupação em tempo real. Dar alta libera o leito pra higienização — depois de 2h, ele volta a ficar livre sozinho (ou libera na hora, se quiser)."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={() => abrirNovo()}>
                <Plus className="h-4 w-4" /> Novo leito
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar leito" : "Novo leito"}</SheetTitle>
                  <SheetDescription>Vincule o leito a uma ala e, se houver, a um quarto específico.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Ala / Unidade</Label>
                    <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setQuartoId(SEM_QUARTO); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a ala/unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Quarto (opcional)</Label>
                    <Select value={quartoId} onValueChange={setQuartoId}>
                      <SelectTrigger><SelectValue placeholder="Sem quarto definido" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_QUARTO}>Sem quarto definido</SelectItem>
                        {quartosDaUnidade.map((q) => (
                          <SelectItem key={q.id} value={q.id}>{q.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code">Código do leito</Label>
                    <Input id="code" name="code" required placeholder="Ex.: UTI-13" defaultValue={editando?.code} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !unidadeId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar leito"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-ink-soft">
          <span className="font-display font-semibold text-ink">{ocupados.length}</span> de {totalLeitos} leitos ocupados
        </p>
        <div className="flex items-center gap-3">
          {legenda.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span className={cn("h-3 w-3 rounded-sm border", statusStyles[s])} />
              {statusLabel[s]}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código do leito…"
            className="max-w-xs"
          />
          <Select value={filtroHospital} onValueChange={(v) => { setFiltroHospital(v); setFiltroUnidade("todas"); }}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todos os hospitais" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os hospitais</SelectItem>
              {hospitais.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {unidades
                .filter((u) => filtroHospital === "todos" || u.hospital_id === filtroHospital)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={filtroSemQuarto ? "primary" : "secondary"}
            onClick={() => setFiltroSemQuarto((v) => !v)}
          >
            Só sem quarto vinculado
          </Button>
        </CardContent>
      </Card>

      {leitosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <BedDouble className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum leito encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os filtros ou cadastre um novo leito.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Ocupados <span className="font-mono text-sm font-normal text-ink-soft">({ocupados.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ocupados.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-soft">Nenhum leito ocupado no filtro atual.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {ocupados.map((leito) => <CardLeito key={leito.id} leito={leito} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {emHigienizacao.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Em higienização <span className="font-mono text-sm font-normal text-ink-soft">({emHigienizacao.length})</span>
                </CardTitle>
                <p className="text-sm text-ink-soft mt-0.5">Volta a ficar livre sozinho depois de {HORAS_HIGIENIZACAO}h da alta.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {emHigienizacao.map((leito) => <CardLeito key={leito.id} leito={leito} />)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Livres <span className="font-mono text-sm font-normal text-ink-soft">({livres.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {livres.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-soft">Nenhum leito livre no filtro atual.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {livres.map((leito) => <CardLeito key={leito.id} leito={leito} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
