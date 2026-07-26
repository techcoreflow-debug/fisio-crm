import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarEnderecoPorCep, formatarCep } from "@/lib/cep";

export interface EnderecoValue {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface AddressFieldsProps {
  value: EnderecoValue;
  onChange: (value: EnderecoValue) => void;
}

/**
 * Campo de endereço reutilizável: ao completar o CEP, busca automaticamente
 * logradouro, bairro, cidade e estado (API ViaCEP). Cidade e estado ficam
 * bloqueados para edição manual enquanto vierem de uma busca bem-sucedida
 * — evita divergência entre o CEP informado e a cidade/estado gravados.
 * Se a busca falhar, os campos destravam para preenchimento manual.
 */
export function AddressFields({ value, onChange }: AddressFieldsProps) {
  const [buscando, setBuscando] = useState(false);
  const [autoPreenchido, setAutoPreenchido] = useState(false);
  const [erro, setErro] = useState(false);

  async function handleCepChange(raw: string) {
    const formatado = formatarCep(raw);
    onChange({ ...value, cep: formatado });
    setErro(false);

    const digits = formatado.replace(/\D/g, "");
    if (digits.length !== 8) {
      setAutoPreenchido(false);
      return;
    }

    setBuscando(true);
    const endereco = await buscarEnderecoPorCep(formatado);
    setBuscando(false);

    if (endereco) {
      onChange({
        cep: formatado,
        street: endereco.street,
        neighborhood: endereco.neighborhood,
        city: endereco.city,
        state: endereco.state,
      });
      setAutoPreenchido(true);
    } else {
      setAutoPreenchido(false);
      setErro(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cep">CEP</Label>
        <div className="relative">
          <Input
            id="cep"
            name="cep"
            value={value.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
          />
          {buscando && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-soft" />
          )}
        </div>
        {erro && (
          <p className="text-xs text-attention-600">CEP não encontrado — preencha cidade e estado manualmente.</p>
        )}
        {autoPreenchido && !erro && (
          <p className="flex items-center gap-1 text-xs text-recovery-600">
            <MapPin className="h-3 w-3" /> Endereço preenchido automaticamente pelo CEP
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="street">Logradouro</Label>
        <Input
          id="street"
          name="street"
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Rua, avenida…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            name="neighborhood"
            value={value.neighborhood}
            onChange={(e) => onChange({ ...value, neighborhood: e.target.value })}
          />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            name="city"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            readOnly={autoPreenchido}
            className={autoPreenchido ? "bg-surface-sunken text-ink-soft" : ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            name="state"
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase().slice(0, 2) })}
            readOnly={autoPreenchido}
            className={autoPreenchido ? "bg-surface-sunken text-ink-soft" : ""}
          />
        </div>
      </div>
    </div>
  );
}

export const enderecoVazio: EnderecoValue = { cep: "", street: "", neighborhood: "", city: "", state: "" };
