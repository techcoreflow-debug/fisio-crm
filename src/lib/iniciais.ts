/**
 * Iniciais de um nome completo pra avatar — mesmo critério em todo canto
 * (topbar, listas de pacientes/internações): primeiro + segundo nome.
 */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

/** Cor do avatar — determinística a partir do nome, pra cada paciente ter sempre a mesma cor. */
const CORES_AVATAR = [
  { bg: "bg-clinical-100", text: "text-clinical-700" },
  { bg: "bg-recovery-100", text: "text-recovery-600" },
  { bg: "bg-attention-100", text: "text-attention-600" },
  { bg: "bg-surface-sunken", text: "text-ink-soft" },
] as const;

export function corDoAvatar(nome: string): (typeof CORES_AVATAR)[number] {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}
