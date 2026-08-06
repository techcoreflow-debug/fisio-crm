import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DeleteButton } from "@/components/shared/delete-button";
import { useProcedures, useProcedureCategories, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Procedure } from "@/types/domain";

export default function Procedimentos() {
  const procedimentos = useProcedures();
  const categorias = useProcedureCategories();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [editando, setEditando] = useState<Procedure | null>(null);
  const [categoriaNome, setCategoriaNome] = useState("");

  const [openNovaCategoria, setOpenNovaCategoria] = useState(false);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState("");
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return procedimentos;
    return procedimentos.filter((p) => p.name.toLowerCase().includes(termo) || (p.code ?? "").includes(termo));
  }, [busca, procedimentos]);

  function abrirNovo() {
    setEditando(null);
    setCategoriaNome("");
    setOpen(true);
  }

  function abrirEdicao(procedimento: Procedure) {
    setEditando(procedimento);
    setCategoriaNome(procedimento.category ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      name: String(form.get("name") ?? ""),
      code: String(form.get("code") ?? "") || null,
      category: categoriaNome.trim() || null,
      company_id: empresaId,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.procedures.update(editando.id, dados);
        notificarSucesso("Procedimento atualizado(a).");
      } else {
        await repository.procedures.create(dados);
        notificarSucesso("Procedimento criado(a).");
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleCriarCategoria() {
    if (!nomeNovaCategoria.trim() || !empresaId) return;
    setSalvandoCategoria(true);
    try {
      const criada = await repository.procedureCategories.criarSeNaoExistir(empresaId, nomeNovaCategoria);
      setCategoriaNome(criada.name);
      notificarSucesso("Categoria criada.");
      setOpenNovaCategoria(false);
    } catch (erro) {
      notificarErro("Não foi possível criar a categoria", erro);
    } finally {
      setSalvandoCategoria(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Procedimentos"
        description="Catálogo de procedimentos fisioterapêuticos, usado na produção diária e no faturamento."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo procedimento
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar procedimento" : "Novo procedimento"}</SheetTitle>
                  <SheetDescription>Cadastre um procedimento para uma empresa do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome do procedimento</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Fisioterapia respiratória" defaultValue={editando?.name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code">Código</Label>
                    <Input id="code" name="code" placeholder="Ex.: 20101015" defaultValue={editando?.code ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Categoria</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Combobox
                          value={categoriaNome}
                          onValueChange={setCategoriaNome}
                          options={categorias.map((c) => ({ value: c.name, label: c.name }))}
                          placeholder="Selecione a categoria"
                          searchPlaceholder="Buscar categoria…"
                          emptyText="Nenhuma categoria ainda — crie uma ao lado."
                        />
                      </div>
                      <Button type="button" variant="secondary" onClick={() => { setNomeNovaCategoria(""); setOpenNovaCategoria(true); }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar procedimento"}</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou código…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {procedimentos.length} procedimentos</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ListChecks className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum procedimento encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo procedimento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="font-mono text-xs text-ink-soft">{p.code ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.category ? <Badge variant="clinical">{p.category}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => abrirEdicao(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={p.name} onConfirm={() => repository.procedures.remove(p.id)} moduleSlug="procedimentos" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={openNovaCategoria} onOpenChange={setOpenNovaCategoria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>Ex.: Respiratória, Motora, Neurológica…</DialogDescription>
          </DialogHeader>
          <Input
            value={nomeNovaCategoria}
            onChange={(e) => setNomeNovaCategoria(e.target.value)}
            placeholder="Nome da categoria"
            autoFocus
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenNovaCategoria(false)}>Cancelar</Button>
            <Button onClick={handleCriarCategoria} disabled={salvandoCategoria || !nomeNovaCategoria.trim()}>
              {salvandoCategoria ? "Criando…" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
