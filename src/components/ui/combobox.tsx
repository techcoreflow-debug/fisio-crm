import { useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Linha secundária pequena, ex.: nome da unidade/ala embaixo do paciente */
  sublabel?: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Select com busca embutida — usado sempre que a lista pode crescer muito
 * (internações, pacientes, procedimentos). O `Select` do Radix não tem
 * busca nativa e vira uma lista rolável interminável; este componente
 * resolve isso com um campo de texto que filtra por label/sublabel.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nada encontrado.",
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");

  const selecionado = options.find((o) => o.value === value);

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || o.sublabel?.toLowerCase().includes(t)
    );
  }, [termo, options]);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTermo("");
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-line-strong bg-surface-raised px-3 py-1 text-sm text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("truncate text-left", !selecionado && "text-ink-soft/60")}>
            {selecionado ? selecionado.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[--radix-popover-trigger-width] overflow-hidden rounded-md border border-line bg-surface-raised shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" />
            <input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtradas.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-soft">{emptyText}</p>
            ) : (
              filtradas.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                    setTermo("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {o.value === value && <Check className="h-4 w-4 text-clinical-600" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.sublabel && <span className="block truncate text-xs text-ink-soft">{o.sublabel}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
