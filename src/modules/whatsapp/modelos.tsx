import { useState, type FormEvent } from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useWhatsappTemplates, whatsapp } from "@/data/whatsapp";
import { VARIAVEIS_TEMPLATE, renderizarTemplate } from "@/lib/whatsapp";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { WhatsappTemplate } from "@/types/domain";

const CATEGORIAS: Record<string, string> = {
  pesquisa_satisfacao: "Pesquisa de satisfação",
  pos_alta: "Pós-alta",
  outro: "Outro",
};

const EXEMPLO = {
  primeiro_nome: "Maria",
  nome: "Maria da Silva",
  empresa: "sua empresa",
  hospital: "Hospital Exemplo",
  data_alta: "10/10/2026",
  link: "https://exemplo.com/pesquisa/abc123",
};

export function ModelosWhatsapp({ empresaId, podeAdministrar }: { empresaId: string; podeAdministrar: boolean }) {
  const modelos = useWhatsappTemplates();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<WhatsappTemplate | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("outro");
  const [corpo, setCorpo] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrir(m: WhatsappTemplate | null) {
    setEditando(m);
    setNome(m?.name ?? "");
    setCategoria(m?.category ?? "outro");
    setCorpo(m?.body ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) await whatsapp.templates.atualizar(editando.id, { name: nome.trim(), category: categoria, body: corpo.trim() });
      else await whatsapp.templates.criar({ company_id: empresaId, name: nome.trim(), category: categoria, body: corpo.trim() });
      setAberto(false);
      notificarSucesso("Modelo salvo");
    } catch (erro) {
      notificarErro("Não foi possível salvar o modelo", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(m: WhatsappTemplate) {
    if (!window.confirm(`Excluir o modelo "${m.name}"?`)) return;
    try {
      await whatsapp.templates.excluir(m.id);
    } catch (erro) {
      notificarErro("Não foi possível excluir", erro);
    }
  }

  async function handleAlternar(m: WhatsappTemplate) {
    try {
      await whatsapp.templates.atualizar(m.id, { active: !m.active });
    } catch (erro) {
      notificarErro("Não foi possível alterar", erro);
    }
  }

  async function handlePadrao() {
    try {
      await whatsapp.templates.criarPadrao();
      notificarSucesso("Modelos padrão criados");
    } catch (erro) {
      notificarErro("Não foi possível criar os modelos padrão", erro);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {podeAdministrar && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => abrir(null)}>
            <Plus /> Novo modelo
          </Button>
          {modelos.length === 0 && (
            <Button variant="secondary" onClick={handlePadrao}>
              <Sparkles /> Criar modelos padrão
            </Button>
          )}
        </div>
      )}

      {modelos.length === 0 && <p className="text-sm text-ink-soft">Nenhum modelo ainda.</p>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {modelos.map((m) => (
          <Card key={m.id} className={m.active ? "" : "opacity-60"}>
            <CardContent className="flex flex-col gap-2 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display font-semibold text-ink">{m.name}</p>
                  <Badge variant="clinical" className="mt-1">{CATEGORIAS[m.category] ?? m.category}</Badge>
                </div>
                {podeAdministrar && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleAlternar(m)}>{m.active ? "Desativar" : "Ativar"}</Button>
                    <Button variant="ghost" size="sm" onClick={() => abrir(m)} aria-label="Editar"><Pencil /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExcluir(m)} aria-label="Excluir"><Trash2 /></Button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-sm text-ink-soft">{m.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <form onSubmit={handleSalvar} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar modelo" : "Novo modelo"}</DialogTitle>
              <DialogDescription>Use as variáveis entre chaves duplas; elas são trocadas no envio.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-nome">Nome</Label>
              <Input id="mt-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-cat">Categoria</Label>
              <select id="mt-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm">
                {Object.entries(CATEGORIAS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-corpo">Mensagem</Label>
              <Textarea id="mt-corpo" rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)} required />
              <div className="flex flex-wrap gap-1.5">
                {VARIAVEIS_TEMPLATE.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    title={v.descricao}
                    onClick={() => setCorpo((c) => `${c}{{${v.chave}}}`)}
                    className="rounded-full bg-clinical-50 px-2 py-0.5 font-mono text-xs text-clinical-700 hover:bg-clinical-100"
                  >
                    {`{{${v.chave}}}`}
                  </button>
                ))}
              </div>
            </div>
            {corpo && (
              <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase text-ink-soft">Prévia com dados de exemplo</p>
                <p className="whitespace-pre-wrap">{renderizarTemplate(corpo, EXEMPLO)}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
