import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Pencil, UserRound, History } from "lucide-react";
import { iniciais, corDoAvatar } from "@/lib/iniciais";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { DeleteButton } from "@/components/shared/delete-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PatientTimeline } from "@/components/shared/patient-timeline";
import { Paginacao, usarPaginacao } from "@/components/shared/paginacao";
import { usePatients, useHealthInsurances, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Patient } from "@/types/domain";

function idade(nascimento: string | null) {
  if (!nascimento) return null;
  const hoje = new Date();
  const nasc = new Date(nascimento);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

export default function Pacientes() {
  const pacientes = usePatients();
  const convenios = useHealthInsurances();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const densidade = useAppStore((s) => s.densidade);
  const compacta = densidade === "compacta";
  // Busca global (Cmd+K) manda o termo pela URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const buscaInicial = searchParams.get("busca") ?? "";
  const [busca, setBusca] = useState(buscaInicial);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    if (!buscaInicial) return;
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete("busca");
      return novo;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Patient | null>(null);
  const [sexo, setSexo] = useState<string>("");
  const [convenioId, setConvenioId] = useState<string>("");
  const [pacienteTimeline, setPacienteTimeline] = useState<Patient | null>(null);
  const [nomeForm, setNomeForm] = useState("");
  const [documentoForm, setDocumentoForm] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pacientes;
    return pacientes.filter((p) => p.full_name.toLowerCase().includes(termo));
  }, [busca, pacientes]);

  const { pagina: paginaAtual, totalPaginas, paginaValida } = usarPaginacao(filtrados, 25, pagina);

  // Prevenção de cadastro duplicado — mesmo padrão do módulo Novo
  // Atendimento: aviso por nome parecido (não bloqueia), bloqueio duro por
  // CPF exato (ignora o próprio registro quando está editando).
  function normalizarNome(nome: string): string[] {
    return nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  const possiveisDuplicados = useMemo(() => {
    if (editando) return [];
    const tokensNovo = normalizarNome(nomeForm);
    if (tokensNovo.length === 0) return [];
    return pacientes.filter((p) => {
      const tokensExistente = normalizarNome(p.full_name);
      const encontrados = tokensNovo.filter((t) => tokensExistente.includes(t));
      const minimoNecessario = tokensNovo.length < 2 ? tokensNovo.length : 2;
      return encontrados.length >= minimoNecessario;
    });
  }, [editando, nomeForm, pacientes]);

  const documentoDuplicado = useMemo(() => {
    const digitos = documentoForm.replace(/\D/g, "");
    if (digitos.length < 11) return null;
    return pacientes.find((p) => p.id !== editando?.id && (p.document ?? "").replace(/\D/g, "") === digitos) ?? null;
  }, [documentoForm, pacientes, editando]);

  function abrirNovo() {
    setEditando(null);
    setSexo("");
    setConvenioId("");
    setNomeForm("");
    setDocumentoForm("");
    setOpen(true);
  }

  function abrirEdicao(paciente: Patient) {
    setEditando(paciente);
    setSexo(paciente.sexo ?? "");
    setConvenioId(paciente.health_insurance_id ?? "");
    setNomeForm(paciente.full_name);
    setDocumentoForm(paciente.document ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (documentoDuplicado) {
      notificarErro("CPF já cadastrado", `Este CPF já pertence a ${documentoDuplicado.full_name}.`);
      return;
    }
    const dados = {
      full_name: String(form.get("full_name") ?? ""),
      birth_date: String(form.get("birth_date") ?? "") || null,
      document: String(form.get("document") ?? "") || null,
      sexo: (sexo || null) as "M" | "F" | null,
      health_insurance_id: convenioId || null,
      company_id: empresaId,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.patients.update(editando.id, dados);
        notificarSucesso("Paciente atualizado(a).");
      } else {
        await repository.patients.create(dados);
        notificarSucesso("Paciente criado(a).");
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes"
        description="Cadastro de pacientes atendidos pelas empresas do grupo, com histórico clínico e internações vinculadas."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo paciente
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar paciente" : "Novo paciente"}</SheetTitle>
                  <SheetDescription>Cadastre um paciente para vincular a internações e evoluções.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      required
                      placeholder="Ex.: Marina Salgado Costa"
                      value={nomeForm}
                      onChange={(e) => setNomeForm(e.target.value)}
                    />
                  </div>
                  {possiveisDuplicados.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-md border border-attention-400/40 bg-attention-100 p-3 text-sm">
                      <span className="font-medium text-attention-700">
                        {possiveisDuplicados.length === 1 ? "Já existe um paciente com nome parecido:" : "Já existem pacientes com nome parecido:"}
                      </span>
                      <ul className="flex flex-col gap-1">
                        {possiveisDuplicados.slice(0, 5).map((p) => (
                          <li key={p.id} className="text-attention-700">{p.full_name}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-attention-700">Confira antes de criar um novo cadastro.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="birth_date">Data de nascimento</Label>
                      <Input id="birth_date" name="birth_date" type="date" defaultValue={editando?.birth_date ?? ""} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Sexo</Label>
                      <Select value={sexo} onValueChange={setSexo}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                    {editando && editando.health_insurance_id !== (convenioId || null) && (
                      <p className="text-xs text-attention-600">
                        Trocar o convênio fica registrado no histórico do paciente, com a data de hoje.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="document">CPF (opcional)</Label>
                    <Input
                      id="document"
                      name="document"
                      placeholder="000.000.000-00"
                      value={documentoForm}
                      onChange={(e) => setDocumentoForm(e.target.value)}
                    />
                    {documentoDuplicado && (
                      <p className="text-xs font-medium text-critical-600">
                        Este CPF já pertence a {documentoDuplicado.full_name} — não é possível salvar.
                      </p>
                    )}
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !empresaId || !!documentoDuplicado}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar paciente"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              placeholder="Buscar por nome…"
              className="pl-9"
            />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {pacientes.length} pacientes</p>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={busca ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado ainda"}
            description={busca ? "Ajuste os termos da busca ou cadastre um novo paciente." : "Cadastre o primeiro paciente pra começar a lançar internações e procedimentos."}
            actionLabel="Cadastrar paciente"
            onAction={abrirNovo}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Idade</th>
                  <th className="px-4 py-3 font-medium">Sexo</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {paginaAtual.map((paciente) => {
                  const corAvatar = corDoAvatar(paciente.full_name);
                  return (
                  <tr key={paciente.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-sunken/60">
                    <td className={compacta ? "px-4 py-1.5" : "px-4 py-3"}>
                      <div className="flex items-center gap-3">
                        {!compacta && (
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold ${corAvatar.bg} ${corAvatar.text}`}
                            aria-hidden="true"
                          >
                            {iniciais(paciente.full_name)}
                          </div>
                        )}
                        <p className="font-medium text-ink">{paciente.full_name}</p>
                      </div>
                    </td>
                    <td className={cn("text-ink-soft", compacta ? "px-4 py-1.5" : "px-4 py-3")}>{idade(paciente.birth_date) ?? "—"}</td>
                    <td className={cn("text-ink-soft", compacta ? "px-4 py-1.5" : "px-4 py-3")}>{paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Feminino" : "—"}</td>
                    <td className={compacta ? "px-4 py-1.5" : "px-4 py-3"}>
                      {paciente.health_insurance_id ? (
                        <Badge variant="clinical">{convenios.find((c) => c.id === paciente.health_insurance_id)?.name ?? "—"}</Badge>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className={cn("font-mono text-xs text-ink-soft", compacta ? "px-4 py-1.5" : "px-4 py-3")}>{paciente.document ?? "—"}</td>
                    <td className={compacta ? "px-4 py-1.5 text-right" : "px-4 py-3 text-right"}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Linha do tempo de ${paciente.full_name}`} onClick={() => setPacienteTimeline(paciente)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Editar ${paciente.full_name}`} onClick={() => abrirEdicao(paciente)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={paciente.full_name} onConfirm={() => repository.patients.remove(paciente.id)} moduleSlug="pacientes" />
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao
          paginaAtual={paginaValida}
          totalPaginas={totalPaginas}
          onChange={setPagina}
          totalItens={filtrados.length}
          itensPorPagina={25}
        />
      </Card>

      <PatientTimeline paciente={pacienteTimeline} onClose={() => setPacienteTimeline(null)} />
    </div>
  );
}
