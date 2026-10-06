// Helpers de alta: data/hora e tipo (normal x na UTI externa).
// "Alta na UTI externa" = paciente estava transferido (alta_em_uti_externa).
type AltaLike = {
  status: string;
  discharge_at?: string | null;
  discharge_date?: string | null;
  alta_em_uti_externa?: boolean | null;
};

export type TipoAlta = "normal" | "externa";

export function tipoDaAlta(i: AltaLike): TipoAlta | null {
  if (i.status !== "alta") return null;
  return i.alta_em_uti_externa ? "externa" : "normal";
}

export function rotuloTipoAlta(i: AltaLike): string {
  const t = tipoDaAlta(i);
  if (t === "externa") return "Alta na UTI externa";
  if (t === "normal") return "Alta normal";
  return "—";
}

// dd/mm/aaaa hh:mm (usa discharge_at; sem horário, só a data)
export function dataHoraAlta(i: AltaLike): string {
  if (i.status !== "alta") return "—";
  if (i.discharge_at) {
    const d = new Date(i.discharge_at);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  if (i.discharge_date) {
    const [a, m, d] = i.discharge_date.split("-");
    return `${d}/${m}/${a}`;
  }
  return "—";
}
