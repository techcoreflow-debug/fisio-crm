import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Star, MessageCircleQuestion, ClipboardList, ThumbsUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useSatisfactionSurveyTemplates, useSatisfactionSurveys, repository } from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { PerguntaSatisfacao, TipoPerguntaSatisfacao } from "@/types/domain";

const TIPO_LABEL: Record<TipoPerguntaSatisfacao, string> = { nps: "Nota 0-10 (NPS)", estrelas: "Estrelas (1-5)", texto: "Texto livre" };

export default function PesquisaSatisfacao() {
  const templates = useSatisfactionSurveyTemplates();
  const envios = useSatisfactionSurveys();
  const empresaId = useAppStore((s) => s.activeCompanyId);

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaSatisfacao[]>([]);
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setPerguntas([{ id: crypto.randomUUID(), tipo: "nps", texto: "" }]);
    setOpen(true);
  }

  function abrirEditar(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setEditando(id);
    setNome(t.name);
    setPerguntas(t.questions);
    setOpen(true);
  }

  function adicionarPergunta() {
    setPerguntas((p) => [...p, { id: crypto.randomUUID(), tipo: "texto", texto: "" }]);
  }
  function removerPergunta(id: string) {
    setPerguntas((p) => p.filter((q) => q.id !== id));
  }
  function atualizarPergunta(id: string, patch: Partial<PerguntaSatisfacao>) {
    setPerguntas((p) => p.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function handleSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId || perguntas.length === 0 || perguntas.some((p) => !p.texto.trim())) {
      notificarErro("Preencha todas as perguntas", "Toda pergunta do modelo precisa de um texto.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await repository.satisfactionSurveyTemplates.update(editando, { name: nome, questions: perguntas });
        notificarSucesso("Modelo atualizado.");
      } else {
        await repository.satisfactionSurveyTemplates.create({ company_id: empresaId, name: nome, questions: perguntas });
        notificarSucesso("Modelo criado.");
      }
      setOpen(false);
    } catch (erro) {
      notificarErro("Não foi possível salvar o modelo", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarAtivo(id: string, ativo: boolean) {
    try {
      await repository.satisfactionSurveyTemplates.update(id, { ativo: !ativo });
      notificarSucesso(!ativo ? "Modelo ativado." : "Modelo desativado.");
    } catch (erro) {
      notificarErro("Não foi possível alterar", erro);
    }
  }

  async function handleExcluir(id: string) {
    if (!window.confirm("Excluir este modelo? Pesquisas já enviadas com ele continuam existindo.")) return;
    try {
      await repository.satisfactionSurveyTemplates.remove(id);
      notificarSucesso("Modelo excluído.");
    } catch (erro) {
      notificarErro("Não foi possível excluir", erro);
    }
  }

  // Números de impacto
  const respondidas = envios.filter((e) => e.respondido_em);
  const taxaResposta = envios.length > 0 ? Math.round((respondidas.length / envios.length) * 100) : 0;
  const notasNps = respondidas.map((e) => e.nps_score).filter((n): n is number => n !== null);
  const mediaNps = notasNps.length > 0 ? (notasNps.reduce((a, b) => a + b, 0) / notasNps.length).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pesquisa de Satisfação"
        description="Modelos de pesquisa e resultados — o envio (e-mail/WhatsApp) acontece na tela de Pacientes Internados, depois da alta."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Pesquisas enviadas</p>
              <p className="font-display text-2xl font-semibold text-ink">{envios.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600">
              <MessageCircleQuestion className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Taxa de resposta</p>
              <p className="font-display text-2xl font-semibold text-recovery-600">{taxaResposta}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attention-100 text-attention-600">
              <ThumbsUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Nota média (NPS)</p>
              <p className="font-display text-2xl font-semibold text-attention-600">{mediaNps}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Modelos de pesquisa</CardTitle>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" onClick={abrirNovo}>
                  <Plus className="h-4 w-4" /> Novo modelo
                </Button>
              </SheetTrigger>
              <SheetContent>
                <form className="flex h-full flex-col" onSubmit={handleSalvar}>
                  <SheetHeader>
                    <SheetTitle>{editando ? "Editar modelo" : "Novo modelo"}</SheetTitle>
                    <SheetDescription>Monte as perguntas que o paciente/família vai ver no link de resposta.</SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="nome_modelo">Nome do modelo</Label>
                      <Input id="nome_modelo" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex.: NPS simples" />
                    </div>
                    <div className="flex flex-col gap-3">
                      {perguntas.map((p, idx) => (
                        <div key={p.id} className="flex flex-col gap-2 rounded-md border border-line p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">Pergunta {idx + 1}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removerPergunta(p.id)} disabled={perguntas.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Input
                            value={p.texto}
                            onChange={(e) => atualizarPergunta(p.id, { texto: e.target.value })}
                            placeholder="Ex.: De 0 a 10, o quanto você recomendaria..."
                            required
                          />
                          <Select value={p.tipo} onValueChange={(v) => atualizarPergunta(p.id, { tipo: v as TipoPerguntaSatisfacao })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                                <SelectItem key={valor} value={valor}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      <Button type="button" variant="secondary" size="sm" onClick={adicionarPergunta}>
                        <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
                      </Button>
                    </div>
                  </div>
                  <SheetFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={salvando || !nome}>{salvando ? "Salvando…" : "Salvar modelo"}</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Nenhum modelo cadastrado ainda.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-line p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">{t.name}</p>
                    <Badge variant={t.ativo ? "recovery" : "neutral"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{t.questions.length} pergunta(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleAlternarAtivo(t.id, t.ativo)}>
                    {t.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(t.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleExcluir(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-critical-400" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas respostas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {respondidas.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Nenhuma resposta recebida ainda.</p>
          ) : (
            respondidas.slice(0, 20).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  {e.nps_score !== null && (
                    <Badge variant={e.nps_score >= 9 ? "recovery" : e.nps_score >= 7 ? "attention" : "critical"}>
                      <Star className="mr-1 h-3 w-3" /> {e.nps_score}
                    </Badge>
                  )}
                  <span className="text-ink-soft">
                    Respondida em {e.respondido_em ? new Date(e.respondido_em).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
                {typeof e.respostas?.comentario === "string" && e.respostas.comentario && (
                  <p className="max-w-md truncate text-ink-soft italic">"{e.respostas.comentario as string}"</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
