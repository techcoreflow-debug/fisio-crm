import { useMemo } from "react";
import {
  useAdmissions,
  useClinicalEvolutions,
  usePatients,
  useContracts,
  useHospitals,
  useBeds,
} from "@/data/repository";

export interface AlertaOperacional {
  id: string;
  titulo: string;
  detalhe: string;
  tom: "critical" | "attention";
}

/**
 * Alertas operacionais reais — mesma lógica usada no Dashboard Executivo,
 * extraída aqui pra também alimentar o sino de notificações (central
 * única, sem duplicar o critério do que vira alerta em cada lugar).
 */
export function useAlertasOperacionais(): AlertaOperacional[] {
  const internacoes = useAdmissions();
  const evolucoes = useClinicalEvolutions();
  const pacientes = usePatients();
  const contratos = useContracts();
  const hospitais = useHospitals();
  const leitos = useBeds();

  return useMemo(() => {
    const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
    const internacoesSemEvolucao = internacoesAtivas.filter((i) => !evolucoes.some((e) => e.admission_id === i.id));

    const contratosVencendo = contratos.filter((c) => {
      if (!c.end_date || c.status !== "ativo") return false;
      const dias = (new Date(c.end_date).getTime() - Date.now()) / 86400000;
      return dias >= 0 && dias <= 60;
    });

    const porUnidade = new Map<string, { total: number; ocupados: number }>();
    for (const l of leitos) {
      const atual = porUnidade.get(l.unit_id) ?? { total: 0, ocupados: 0 };
      atual.total += 1;
      if (l.status === "ocupado") atual.ocupados += 1;
      porUnidade.set(l.unit_id, atual);
    }
    const unidadesLotadas = Array.from(porUnidade.entries()).filter(([, v]) => v.total > 0 && v.ocupados / v.total >= 0.9);

    const lista: AlertaOperacional[] = [
      ...internacoesSemEvolucao.map((i) => ({
        id: `evolucao-${i.id}`,
        titulo: "Internação sem evolução clínica registrada",
        detalhe: pacientes.find((p) => p.id === i.patient_id)?.full_name ?? `Internação ${i.id.slice(0, 8)}`,
        tom: "critical" as const,
      })),
      ...contratosVencendo.map((c) => ({
        id: `contrato-${c.id}`,
        titulo: "Contrato vencendo nos próximos 60 dias",
        detalhe: `${hospitais.find((h) => h.id === c.hospital_id)?.name ?? "—"} · vence em ${new Date(c.end_date!).toLocaleDateString("pt-BR")}`,
        tom: "attention" as const,
      })),
      ...unidadesLotadas.map(([unitId, v]) => ({
        id: `unidade-${unitId}`,
        titulo: "Unidade com ocupação acima de 90%",
        detalhe: `${v.ocupados} de ${v.total} leitos ocupados`,
        tom: "attention" as const,
      })),
    ];

    // Críticos primeiro.
    return lista.sort((a, b) => (a.tom === b.tom ? 0 : a.tom === "critical" ? -1 : 1));
  }, [internacoes, evolucoes, pacientes, contratos, hospitais, leitos]);
}
