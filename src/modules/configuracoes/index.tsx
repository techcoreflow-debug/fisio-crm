import { useState, type FormEvent } from "react";
import { AlertTriangle, UserX, ListX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAppStore } from "@/store/app-store";
import { useCompanies, usePatients, useProcedures, repository } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import type { NotificationPreferences } from "@/types/domain";

const notificacoes: { chave: keyof NotificationPreferences; texto: string }[] = [
  { chave: "sem_evolucao_48h", texto: "Alertar sobre internações sem evolução clínica há mais de 48h" },
  { chave: "tasy_inconsistencias", texto: "Alertar sobre inconsistências em importações do Tasy" },
  { chave: "contratos_vencendo", texto: "Notificar vencimento de contratos nos próximos 90 dias" },
];

const GRUPOS_LIMPEZA: { chave: string; texto: string; detalhe?: string }[] = [
  { chave: "auditoria", texto: "Auditoria", detalhe: "Trilha de eventos (quem criou/editou/excluiu o quê)" },
  { chave: "tasy", texto: "Importações do Tasy", detalhe: "Histórico de conciliações e pendências" },
  { chave: "financeiro", texto: "Financeiro", detalhe: "Contas a receber" },
  { chave: "atendimento", texto: "Atendimento", detalhe: "Produção diária e evoluções clínicas" },
  { chave: "internacoes", texto: "Internações", detalhe: "Também apaga produção/evoluções vinculadas, mesmo se não marcadas acima" },
  { chave: "escalas", texto: "Escalas", detalhe: "Turnos de trabalho" },
  { chave: "contratos", texto: "Contratos" },
  { chave: "pacientes", texto: "Pacientes", detalhe: "Também apaga internações desses pacientes, mesmo se não marcadas acima" },
  { chave: "equipe", texto: "Fisioterapeutas e equipes" },
  { chave: "procedimentos", texto: "Procedimentos" },
  { chave: "convenios", texto: "Convênios" },
  { chave: "estrutura", texto: "Estrutura física", detalhe: "Hospitais, clínicas, unidades, quartos, leitos, centros de custo" },
];

export default function Configuracoes() {
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const companies = useCompanies();
  const empresa = companies.find((c) => c.id === activeCompanyId) ?? companies[0];
  const { profile } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [salvandoPreferencia, setSalvandoPreferencia] = useState<string | null>(null);

  const [gruposSelecionados, setGruposSelecionados] = useState<string[]>([]);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [limpando, setLimpando] = useState(false);

  // --- Exclusão avançada: paciente ou procedimento, ignorando o bloqueio normal de dependências ---
  const pacientes = usePatients();
  const procedimentos = useProcedures();
  const podeExclusaoAvancada = profile?.role === "admin" || profile?.is_platform_admin;

  const [pacienteExcluirId, setPacienteExcluirId] = useState("");
  const [confirmandoPaciente, setConfirmandoPaciente] = useState(false);
  const [excluindoPaciente, setExcluindoPaciente] = useState(false);

  const [procedimentoExcluirId, setProcedimentoExcluirId] = useState("");
  const [confirmandoProcedimento, setConfirmandoProcedimento] = useState(false);
  const [excluindoProcedimento, setExcluindoProcedimento] = useState(false);

  async function handleExcluirPacienteForcado() {
    if (!pacienteExcluirId) return;
    setExcluindoPaciente(true);
    try {
      const paciente = pacientes.find((p) => p.id === pacienteExcluirId);
      const resultado = await repository.patients.removeForcado(pacienteExcluirId);
      notificarSucesso(
        `"${paciente?.full_name}" excluído`,
        `Junto: ${resultado.internacoes} internação(ões), ${resultado.producao} lançamento(s) de produção, ${resultado.evolucoes} evolução(ões).`
      );
      setConfirmandoPaciente(false);
      setPacienteExcluirId("");
    } catch (erro) {
      notificarErro("Não foi possível excluir o paciente", erro);
    } finally {
      setExcluindoPaciente(false);
    }
  }

  async function handleExcluirProcedimentoForcado() {
    if (!procedimentoExcluirId) return;
    setExcluindoProcedimento(true);
    try {
      const procedimento = procedimentos.find((p) => p.id === procedimentoExcluirId);
      const resultado = await repository.procedures.removeForcado(procedimentoExcluirId);
      notificarSucesso(`"${procedimento?.name}" excluído`, `Junto: ${resultado.producao} lançamento(s) de produção.`);
      setConfirmandoProcedimento(false);
      setProcedimentoExcluirId("");
    } catch (erro) {
      notificarErro("Não foi possível excluir o procedimento", erro);
    } finally {
      setExcluindoProcedimento(false);
    }
  }

  function toggleGrupo(chave: string, marcado: boolean) {
    setGruposSelecionados((atual) => (marcado ? [...atual, chave] : atual.filter((g) => g !== chave)));
  }

  async function handleConfirmarLimpeza() {
    if (!empresa) return;
    setLimpando(true);
    try {
      const resultado = await repository.perigo.limparEmpresa(empresa.id, gruposSelecionados);
      const total = Object.values(resultado).reduce((a, b) => a + b, 0);
      notificarSucesso(`Limpeza concluída — ${total} registro(s) apagado(s).`);
      setConfirmandoLimpeza(false);
      setGruposSelecionados([]);
    } catch (erro) {
      notificarErro("Não foi possível concluir a limpeza", erro);
    } finally {
      setLimpando(false);
    }
  }

  async function handleSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresa) return;
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    try {
      await repository.companies.update(empresa.id, {
        name: String(form.get("name") ?? ""),
        cnpj: String(form.get("cnpj") ?? "") || null,
      });
      notificarSucesso("Dados da empresa atualizados.");
    } catch (erro) {
      notificarErro("Não foi possível salvar os dados da empresa", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleTogglePreferencia(chave: keyof NotificationPreferences, valor: boolean) {
    if (!empresa) return;
    setSalvandoPreferencia(chave);
    try {
      await repository.companies.update(empresa.id, {
        notification_preferences: { ...empresa.notification_preferences, [chave]: valor },
      });
    } catch (erro) {
      notificarErro("Não foi possível salvar a preferência", erro);
    } finally {
      setSalvandoPreferencia(null);
    }
  }

  async function handleToggleGlosaDetalhada(valor: boolean) {
    if (!empresa) return;
    setSalvandoPreferencia("glosa_por_procedimento");
    try {
      await repository.companies.update(empresa.id, { glosa_por_procedimento: valor });
      notificarSucesso(valor ? "Glosa por procedimento ativada." : "Glosa por competência ativada.");
    } catch (erro) {
      notificarErro("Não foi possível salvar", erro);
    } finally {
      setSalvandoPreferencia(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Configurações gerais da empresa ativa, marca e preferências." />

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <form onSubmit={handleSalvarDados}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input id="name" name="name" required defaultValue={empresa?.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" defaultValue={empresa?.cnpj ?? ""} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={salvando || !empresa}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {notificacoes.map((n) => (
            <label key={n.chave} className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={empresa?.notification_preferences?.[n.chave] ?? false}
                disabled={!empresa || salvandoPreferencia === n.chave}
                onChange={(e) => handleTogglePreferencia(n.chave, e.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-clinical-500 disabled:opacity-50"
              />
              {n.texto}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Glosa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={empresa?.glosa_por_procedimento ?? false}
              disabled={!empresa || salvandoPreferencia === "glosa_por_procedimento"}
              onChange={(e) => handleToggleGlosaDetalhada(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-strong accent-clinical-500 disabled:opacity-50"
            />
            <span>
              Registrar glosa por procedimento
              <span className="mt-0.5 block text-xs text-ink-soft">
                Ligado: você marca a glosa em cada procedimento na Produção Diária, e a competência soma
                automaticamente no Financeiro. Desligado: você digita o valor glosado direto na conta a
                receber, sem detalhar procedimento a procedimento.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre o {APP_NAME}</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 text-sm text-ink-soft">
          {APP_NAME} v{APP_VERSION} · Um produto InovareTech · Autenticação e dados conectados ao Supabase
        </CardContent>
      </Card>

      {podeExclusaoAvancada && (
        <Card className="border-attention-400/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-attention-700">
              <AlertTriangle className="h-4.5 w-4.5" /> Exclusão avançada
            </CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">
              O botão normal de excluir bloqueia se houver dados dependentes (paciente com internação, procedimento
              com lançamento) — é uma proteção contra perda de dado. Aqui dá pra forçar mesmo assim, apagando junto
              tudo que depende. Sem volta depois de confirmar.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5"><UserX className="h-3.5 w-3.5" /> Excluir paciente (e tudo relacionado)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    value={pacienteExcluirId}
                    onValueChange={setPacienteExcluirId}
                    options={pacientes.map((p) => ({ value: p.id, label: p.full_name }))}
                    placeholder="Buscar paciente…"
                    searchPlaceholder="Nome do paciente…"
                  />
                </div>
                <Button variant="destructive" size="sm" disabled={!pacienteExcluirId} onClick={() => setConfirmandoPaciente(true)}>
                  Excluir
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5"><ListX className="h-3.5 w-3.5" /> Excluir procedimento (e a produção lançada com ele)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    value={procedimentoExcluirId}
                    onValueChange={setProcedimentoExcluirId}
                    options={procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
                    placeholder="Buscar procedimento…"
                    searchPlaceholder="Nome, código ou categoria…"
                  />
                </div>
                <Button variant="destructive" size="sm" disabled={!procedimentoExcluirId} onClick={() => setConfirmandoProcedimento(true)}>
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {profile?.is_platform_admin && (
        <Card className="border-critical-400/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-critical-600">
              <AlertTriangle className="h-4.5 w-4.5" /> Zona de risco — limpeza de base
            </CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">
              Apaga dados de <strong>{empresa?.name ?? "—"}</strong> (só desta empresa). Marque as categorias que
              quer apagar — sem volta depois de confirmar.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {GRUPOS_LIMPEZA.map((g) => (
                <label key={g.chave} className="flex items-start gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={gruposSelecionados.includes(g.chave)}
                    onChange={(e) => toggleGrupo(g.chave, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-line-strong accent-critical-400"
                  />
                  <span>
                    {g.texto}
                    {g.detalhe && <span className="mt-0.5 block text-xs text-ink-soft">{g.detalhe}</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                disabled={gruposSelecionados.length === 0}
                onClick={() => setConfirmandoLimpeza(true)}
              >
                <AlertTriangle className="h-4 w-4" /> Limpar selecionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmandoLimpeza} onOpenChange={setConfirmandoLimpeza}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tem certeza?</DialogTitle>
            <DialogDescription>
              Isso vai apagar permanentemente {gruposSelecionados.length} categoria(s) de dados de{" "}
              <strong>{empresa?.name}</strong>. Não pode ser desfeito.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm text-ink-soft">
            {GRUPOS_LIMPEZA.filter((g) => gruposSelecionados.includes(g.chave)).map((g) => (
              <li key={g.chave}>{g.texto}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmandoLimpeza(false)} disabled={limpando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmarLimpeza} disabled={limpando}>
              {limpando ? "Apagando…" : "Sim, apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmandoPaciente} onOpenChange={setConfirmandoPaciente}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tem certeza?</DialogTitle>
            <DialogDescription>
              Isso apaga <strong>{pacientes.find((p) => p.id === pacienteExcluirId)?.full_name}</strong> e tudo
              relacionado: internações, evoluções clínicas, produção lançada, fila de distribuição e faturamento
              dele. Não pode ser desfeito.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmandoPaciente(false)} disabled={excluindoPaciente}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluirPacienteForcado} disabled={excluindoPaciente}>
              {excluindoPaciente ? "Apagando…" : "Sim, apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmandoProcedimento} onOpenChange={setConfirmandoProcedimento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tem certeza?</DialogTitle>
            <DialogDescription>
              Isso apaga o procedimento <strong>{procedimentos.find((p) => p.id === procedimentoExcluirId)?.name}</strong>{" "}
              e todos os lançamentos de produção feitos com ele — inclusive de meses já fechados. Não pode ser
              desfeito.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmandoProcedimento(false)} disabled={excluindoProcedimento}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluirProcedimentoForcado} disabled={excluindoProcedimento}>
              {excluindoProcedimento ? "Apagando…" : "Sim, apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
