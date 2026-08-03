import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, Pencil } from "lucide-react";
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

  const totalLeitos = leitos.length;

  /**
   * Status VISUAL de um leito — nunca lido direto do banco. Calculado ao
   * vivo a partir de quem está de fato internado ali agora. Antes, a cor
   * do card vinha de `leito.status` (gravado no banco) enquanto o texto
   * "Ocupado" vinha de uma checagem separada contra internações ativas —
   * as duas podiam ficar dessincronizadas (leito mostrando verde/livre
   * com texto "Ocupado" em cima, por exemplo). Agora só existe uma fonte
   * de verdade: se tem internação ativa nesse leito, é "ocupado", ponto.
   */
  function statusVisual(leito: Bed): "ocupado" | "higienizacao" | "livre" {
    const temInternacaoAtiva = internacoes.some((i) => i.bed_id === leito.id && i.status === "internado");
    if (temInternacaoAtiva) return "ocupado";
    if (leito.status === "higienizacao") return "higienizacao";
    return "livre";
  }

  const ocupados = leitos.filter((l) => statusVisual(l) === "ocupado").length;
  const quartosDaUnidade = quartos.filter((q) => q.unit_id === unidadeId);

  // Autocorreção silenciosa: se o banco ainda diz "ocupado" mas não existe
  // internação ativa de verdade nesse leito (resíduo de bugs antigos de
  // sincronia, já corrigidos na origem), corrige sozinho — outras telas
  // (ex.: seletor de leito livre em Nova Internação) leem esse campo
  // direto do banco, então não basta corrigir só a exibição aqui.
  useEffect(() => {
    for (const leito of leitos) {
      if (leito.status === "ocupado" && statusVisual(leito) === "livre") {
        repository.beds.updateStatus(leito.id, "livre").catch(() => {
          // silencioso de propósito — é uma correção oportunista, não uma
          // ação que o usuário pediu; se falhar, tenta de novo no próximo render
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitos, internacoes]);

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

  // Sem critério automático pra saber quando a limpeza física terminou —
  // por isso é uma ação manual: alguém confirma que o leito já foi
  // higienizado e está pronto para uma nova internação.
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leitos"
        description="Mapa de leitos por ala e quarto, com ocupação em tempo real. Dar alta em uma internação libera o leito para higienização automaticamente."
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
          <span className="font-display font-semibold text-ink">{ocupados}</span> de {totalLeitos} leitos ocupados
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

      {unidades.map((unidade) => {
        const leitosDaUnidade = leitos.filter((l) => l.unit_id === unidade.id);
        if (leitosDaUnidade.length === 0) return null;
        const hospital = hospitais.find((h) => h.id === unidade.hospital_id);

        // Agrupa por quarto — reflete a hierarquia real: ala → quarto → leito
        const porQuarto = new Map<string, Bed[]>();
        for (const leito of leitosDaUnidade) {
          const chave = leito.room_id ?? SEM_QUARTO;
          porQuarto.set(chave, [...(porQuarto.get(chave) ?? []), leito]);
        }

        return (
          <Card key={unidade.id}>
            <CardHeader>
              <CardTitle>{unidade.name}</CardTitle>
              <p className="text-sm text-ink-soft mt-0.5">{hospital?.name ?? "—"}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Array.from(porQuarto.entries()).map(([chaveQuarto, leitosDoQuarto]) => {
                const quarto = chaveQuarto === SEM_QUARTO ? null : quartos.find((q) => q.id === chaveQuarto);
                return (
                  <div key={chaveQuarto}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {quarto ? quarto.code : "Sem quarto definido"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {leitosDoQuarto.map((leito) => {
                        const internacaoAtiva = internacoes.find((i) => i.bed_id === leito.id && i.status === "internado");
                        const status = statusVisual(leito);
                        return (
                          <div
                            key={leito.id}
                            className={cn(
                              "group relative flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-center",
                              statusStyles[status]
                            )}
                            title={statusLabel[status]}
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
                            <span className="truncate text-[11px] leading-tight">{statusLabel[status]}</span>
                            {status === "higienizacao" && (
                              <button
                                type="button"
                                onClick={() => handleLiberarLeito(leito.id)}
                                className="mt-0.5 rounded-sm bg-attention-400 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-attention-600"
                              >
                                Concluir
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
