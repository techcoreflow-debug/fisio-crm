import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { NOVIDADES, ultimaVersaoDeNovidade } from "@/lib/novidades";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAVE_STORAGE = "fisio:ultima-novidade-vista";

function lerUltimaVista(): string {
  try {
    return localStorage.getItem(CHAVE_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/**
 * Sino de novidades — mostra um ponto vermelho quando existe alguma
 * entrada em `NOVIDADES` mais nova do que a última que a pessoa já viu
 * (a lista vem ordenada da mais nova pra mais antiga). Ao abrir o menu,
 * marca tudo como visto — no próximo login, some o ponto.
 */
export function SinoNovidades() {
  const [ultimaVista, setUltimaVista] = useState(lerUltimaVista);
  const [open, setOpen] = useState(false);

  const indiceUltimaVista = NOVIDADES.findIndex((n) => n.versao === ultimaVista);
  const temNovidade = indiceUltimaVista !== 0;

  useEffect(() => {
    if (open && temNovidade) {
      const maisRecente = ultimaVersaoDeNovidade();
      try {
        localStorage.setItem(CHAVE_STORAGE, maisRecente);
      } catch {
        // sem persistência nesse aparelho, tudo bem
      }
      setUltimaVista(maisRecente);
    }
  }, [open, temNovidade]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Novidades do sistema">
          <Bell className="h-4.5 w-4.5" />
          {temNovidade && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-critical-400" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Novidades</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto px-2 py-2">
          {NOVIDADES.map((n) => (
            <div key={`${n.versao}-${n.titulo}`} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{n.titulo}</p>
                <span className="shrink-0 text-[10px] text-ink-soft/70">{n.data}</span>
              </div>
              <p className="text-xs text-ink-soft">{n.descricao}</p>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
