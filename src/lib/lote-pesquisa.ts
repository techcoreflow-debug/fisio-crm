// Quem recebe a pesquisa de satisfação em lote: altas recentes, com telefone,
// que ainda não receberam pesquisa. Regras puras — a tela só mostra o resultado.
import { normalizarTelefone } from "@/lib/whatsapp";
import type { Admission, Patient, SatisfactionSurvey } from "@/types/domain";

export interface DestinatarioPesquisa {
  admission: Admission;
  paciente: Patient;
  numero: string;
}

export interface SelecaoLotePesquisa {
  elegiveis: DestinatarioPesquisa[];
  excluidos: {
    obito: number;
    utiExterna: number;
    semTelefone: number;
    optout: number;
    jaTemPesquisa: number;
    repetido: number;
  };
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** `hoje` no formato aaaa-mm-dd (use hojeLocalIso — nunca toISOString, que usa UTC). */
export function selecionarDestinatariosPesquisa(e: {
  internacoes: Admission[];
  pacientes: Patient[];
  pesquisas: Pick<SatisfactionSurvey, "admission_id">[];
  hoje: string;
  dias: number;
}): SelecaoLotePesquisa {
  const desde = somarDias(e.hoje, -e.dias);
  const pacientePorId = new Map(e.pacientes.map((p) => [p.id, p]));
  const comPesquisa = new Set(e.pesquisas.map((p) => p.admission_id).filter(Boolean));
  const excluidos = { obito: 0, utiExterna: 0, semTelefone: 0, optout: 0, jaTemPesquisa: 0, repetido: 0 };

  const candidatas = e.internacoes
    .filter((i) => i.status === "alta" && i.discharge_date && i.discharge_date >= desde && i.discharge_date <= e.hoje)
    .sort((a, b) => (b.discharge_date ?? "").localeCompare(a.discharge_date ?? ""));

  const elegiveis: DestinatarioPesquisa[] = [];
  const pacientesJaIncluidos = new Set<string>();

  for (const i of candidatas) {
    if (i.discharge_type === "obito") { excluidos.obito++; continue; }
    if (i.alta_em_uti_externa) { excluidos.utiExterna++; continue; }
    if (comPesquisa.has(i.id)) { excluidos.jaTemPesquisa++; continue; }
    const paciente = pacientePorId.get(i.patient_id);
    if (!paciente) { excluidos.semTelefone++; continue; }
    if (paciente.whatsapp_optout) { excluidos.optout++; continue; }
    const numero = normalizarTelefone(paciente.phone);
    if (!numero) { excluidos.semTelefone++; continue; }
    if (pacientesJaIncluidos.has(paciente.id)) { excluidos.repetido++; continue; }
    pacientesJaIncluidos.add(paciente.id);
    elegiveis.push({ admission: i, paciente, numero });
  }
  return { elegiveis, excluidos };
}
