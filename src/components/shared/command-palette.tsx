import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, Users, BedDouble, CornerDownLeft } from "lucide-react";
import { moduleGroups } from "@/app/modules-registry";
import { permissaoPadrao } from "@/lib/permissions";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/auth/auth-provider";
import { usePatients, useAdmissions, useRolePermissions, useBeds, useHospitals } from "@/data/repository";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Resultado {
  id: string;
  tipo: "modulo" | "paciente";
  titulo: string;
  subtitulo?: string;
  icone: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const permissoes = useRolePermissions();
  const pacientes = usePatients();
  const internacoes = useAdmissions();
  const leitos = useBeds();
  const hospitais = useHospitals();

  const [termo, setTermo] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global — Cmd+K (Mac) ou Ctrl+K (Windows/Linux), de qualquer
  // tela. "/" também abre, exceto quando o foco já está num campo de texto.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "/" && !digitando && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setTermo("");
      setIndiceAtivo(0);
      // Radix já move o foco pro conteúdo do dialog; adia um tick pra
      // garantir que o input existe antes de focar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function podeVer(slug: string) {
    if (!profile) return false;
    if (profile.is_platform_admin) return true;
    const linha = permissoes.find((p) => p.role === profile.role && p.module_slug === slug);
    return linha ? linha.can_view : permissaoPadrao(profile.role, slug).can_view;
  }

  const resultados = useMemo<Resultado[]>(() => {
    const q = termo.trim().toLowerCase();
    const lista: Resultado[] = [];

    // Módulos — navegação, filtrada pela permissão de cada usuário.
    for (const grupo of moduleGroups) {
      for (const mod of grupo.modules) {
        if (!podeVer(mod.slug)) continue;
        if (q && !mod.label.toLowerCase().includes(q) && !grupo.label.toLowerCase().includes(q)) continue;
        lista.push({
          id: `modulo-${mod.slug}`,
          tipo: "modulo",
          titulo: mod.label,
          subtitulo: grupo.label,
          icone: <mod.icon className="h-4 w-4" />,
          onSelect: () => {
            navigate(mod.path);
            setOpen(false);
          },
        });
      }
    }

    // Pacientes / internações — só entra em jogo com pelo menos 2 letras
    // digitadas, pra não listar a base inteira à toa.
    if (q.length >= 2) {
      const encontrados = pacientes
        .filter((p) => {
          if (p.full_name.toLowerCase().includes(q)) return true;
          if (p.document && p.document.toLowerCase().includes(q)) return true;
          const internacaoDoPaciente = internacoes.find(
            (i) => i.patient_id === p.id && (i.external_reference ?? "").toLowerCase().includes(q)
          );
          return Boolean(internacaoDoPaciente);
        })
        .slice(0, 6);

      for (const p of encontrados) {
        const internacaoAtiva =
          internacoes.find((i) => i.patient_id === p.id && i.status === "internado") ??
          internacoes.find((i) => i.patient_id === p.id);
        const leito = internacaoAtiva ? leitos.find((l) => l.id === internacaoAtiva.bed_id) : undefined;
        const hospital = internacaoAtiva ? hospitais.find((h) => h.id === internacaoAtiva.hospital_id) : undefined;
        const partes = [
          internacaoAtiva?.external_reference ? `Tasy ${internacaoAtiva.external_reference}` : null,
          leito ? `Leito ${leito.code}` : null,
          hospital?.name ?? null,
        ].filter(Boolean);

        lista.push({
          id: `paciente-${p.id}`,
          tipo: "paciente",
          titulo: p.full_name,
          subtitulo: partes.length > 0 ? partes.join(" · ") : "Sem internação ativa",
          icone: <Users className="h-4 w-4" />,
          onSelect: () => {
            if (internacaoAtiva) {
              navigate(`/internacoes?busca=${encodeURIComponent(p.full_name)}`);
            } else {
              navigate(`/pacientes?busca=${encodeURIComponent(p.full_name)}`);
            }
            setOpen(false);
          },
        });
      }
    }

    return lista.slice(0, 40);
  }, [termo, pacientes, internacoes, leitos, hospitais, profile, permissoes]);

  useEffect(() => {
    setIndiceAtivo(0);
  }, [termo]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      resultados[indiceAtivo]?.onSelect();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[16%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4.5 w-4.5 shrink-0 text-ink-soft" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar paciente, nº Tasy, leito ou uma tela…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-soft sm:inline-block">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {resultados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">
              {termo.trim() ? "Nada encontrado." : "Digite pra buscar uma tela, paciente, nº Tasy ou leito."}
            </p>
          ) : (
            resultados.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={r.onSelect}
                onMouseEnter={() => setIndiceAtivo(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                  i === indiceAtivo ? "bg-clinical-50" : "hover:bg-surface-sunken"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    r.tipo === "paciente" ? "bg-clinical-100 text-clinical-700" : "bg-surface-sunken text-ink-soft"
                  )}
                >
                  {r.icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{r.titulo}</span>
                  {r.subtitulo && <span className="block truncate text-xs text-ink-soft">{r.subtitulo}</span>}
                </span>
                {i === indiceAtivo && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-soft" />}
                {r.tipo === "modulo" && i !== indiceAtivo && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-soft opacity-0 group-hover:opacity-100" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-surface-sunken/60 px-4 py-2 text-[11px] text-ink-soft">
          <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface-raised px-1">↑</kbd><kbd className="rounded border border-line bg-surface-raised px-1">↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface-raised px-1">↵</kbd> abrir</span>
          <span className="ml-auto flex items-center gap-1"><BedDouble className="h-3 w-3" /> Pacientes e internações</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
