import { CalendarClock, BedDouble, NotebookPen, ClipboardList, HeartHandshake, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  useAdmissions,
  useDailyProduction,
  useClinicalEvolutions,
  usePatientInsuranceHistory,
  useHospitals,
  useUnits,
  useHealthInsurances,
  usePhysiotherapists,
  useProcedures,
} from "@/data/repository";
import type { Patient } from "@/types/domain";

interface EventoTimeline {
  data: string; // ISO — usado só pra ordenar
  icone: typeof CalendarClock;
  titulo: string;
  detalhe?: string;
  tom: "clinical" | "recovery" | "attention" | "neutral";
}

export function PatientTimeline({ paciente, onClose }: { paciente: Patient | null; onClose: () => void }) {
  const internacoes = useAdmissions().filter((i) => i.patient_id === paciente?.id);
  const producao = useDailyProduction();
  const evolucoes = useClinicalEvolutions();
  const historicoConvenio = usePatientInsuranceHistory(paciente?.id);
  const hospitais = useHospitals();
  const unidades = useUnits();
  const convenios = useHealthInsurances();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();

  if (!paciente) return null;

  const idsInternacoes = new Set(internacoes.map((i) => i.id));

  const eventos: EventoTimeline[] = [];

  for (const i of internacoes) {
    eventos.push({
      data: i.admission_date,
      icone: BedDouble,
      titulo: "Internação",
      detalhe: `${hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"} · ${unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}`,
      tom: "clinical",
    });
    if (i.discharge_at) {
      eventos.push({
        data: i.discharge_at,
        icone: LogOut,
        titulo: "Alta",
        detalhe: i.confirmou_sem_atendimento_alta ? "Sem atendimento registrado no dia da alta" : undefined,
        tom: "neutral",
      });
    }
  }

  for (const p of producao) {
    if (!p.admission_id || !idsInternacoes.has(p.admission_id)) continue;
    eventos.push({
      data: p.production_date,
      icone: ClipboardList,
      titulo: procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "Procedimento",
      detalhe: fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name,
      tom: p.glosado ? "attention" : "recovery",
    });
  }

  for (const e of evolucoes) {
    if (!idsInternacoes.has(e.admission_id)) continue;
    eventos.push({
      data: e.created_at,
      icone: NotebookPen,
      titulo: "Evolução clínica",
      detalhe: e.content.slice(0, 80) + (e.content.length > 80 ? "…" : ""),
      tom: "clinical",
    });
  }

  for (const h of historicoConvenio) {
    eventos.push({
      data: h.changed_at,
      icone: HeartHandshake,
      titulo: "Convênio atualizado",
      detalhe: convenios.find((c) => c.id === h.health_insurance_id)?.name ?? "Sem convênio",
      tom: "neutral",
    });
  }

  eventos.sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Sheet open={paciente !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Linha do tempo</SheetTitle>
          <SheetDescription>{paciente.full_name}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {eventos.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Nenhum evento registrado ainda para este paciente.</p>
          ) : (
            eventos.map((ev, i) => (
              <div key={i} className="flex gap-3 rounded-md border border-line p-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    ev.tom === "clinical"
                      ? "bg-clinical-50 text-clinical-600"
                      : ev.tom === "recovery"
                        ? "bg-recovery-100 text-recovery-600"
                        : ev.tom === "attention"
                          ? "bg-attention-100 text-attention-600"
                          : "bg-surface-sunken text-ink-soft"
                  }`}
                >
                  <ev.icone className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{ev.titulo}</p>
                    <Badge variant="neutral">{new Date(ev.data).toLocaleString("pt-BR")}</Badge>
                  </div>
                  {ev.detalhe && <p className="mt-0.5 text-xs text-ink-soft">{ev.detalhe}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
