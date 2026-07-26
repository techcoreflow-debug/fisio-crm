import { useState, type FormEvent } from "react";
import { Building2, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCompanies, useHospitalsAllCompanies, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Company } from "@/types/domain";

export default function Empresas() {
  const empresas = useCompanies();
  const hospitais = useHospitalsAllCompanies();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Company | null>(null);

  function abrirNova() {
    setEditando(null);
    setOpen(true);
  }

  function abrirEdicao(empresa: Company) {
    setEditando(empresa);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      name: String(form.get("name") ?? ""),
      cnpj: String(form.get("cnpj") ?? "") || null,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.companies.update(editando.id, dados);
        notificarSucesso("Empresa atualizado(a).");
      } else {
        await repository.companies.create(dados);
        notificarSucesso("Empresa criado(a).");
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
        title="Empresas"
        description="Empresas do grupo. Cada uma mantém dados totalmente isolados dos demais — hospitais, contratos, pacientes e financeiro não se cruzam entre empresas."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova empresa
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "nova"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar empresa" : "Nova empresa"}</SheetTitle>
                  <SheetDescription>
                    {editando
                      ? "Altere os dados da empresa."
                      : "Cria uma nova empresa isolada no grupo. Hospitais, contratos e usuários serão vinculados a ela."}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome da empresa</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Reab Hospitalar Ltda." defaultValue={editando?.name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" defaultValue={editando?.cnpj ?? ""} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar empresa"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {empresas.map((empresa) => {
          const qtdHospitais = hospitais.filter((h) => h.company_id === empresa.id).length;
          return (
            <Card key={empresa.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-50 text-clinical-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Badge variant="clinical">Ativa</Badge>
                </div>
                <p className="mt-3 font-display font-semibold text-ink">{empresa.name}</p>
                <p className="mt-1 font-mono text-xs text-ink-soft">{empresa.cnpj ?? "CNPJ não informado"}</p>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm text-ink-soft">
                  <span>{qtdHospitais} hospitai{qtdHospitais === 1 ? "" : "s"}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Editar ${empresa.name}`} onClick={() => abrirEdicao(empresa)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DeleteButton itemLabel={empresa.name} onConfirm={() => repository.companies.remove(empresa.id)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
