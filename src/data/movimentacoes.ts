import { useMemo } from "react";
import {
  useActivityLog,
  useAdmissions,
  useAdmissionUnitHistory,
  useHospitals,
  usePatients,
  useUnits,
} from "@/data/repository";
import { montarMovimentacoes, type Movimentacao } from "@/lib/movimentacoes";

/** Últimas movimentações da operação (internações, unidades, altas, óbitos) — alimenta o sino. */
export function useMovimentacoes(): Movimentacao[] {
  const internacoes = useAdmissions();
  const historico = useAdmissionUnitHistory();
  const atividades = useActivityLog();
  const pacientes = usePatients();
  const unidades = useUnits();
  const hospitais = useHospitals();
  return useMemo(
    () => montarMovimentacoes({ internacoes, historico, atividades, pacientes, unidades, hospitais }),
    [internacoes, historico, atividades, pacientes, unidades, hospitais]
  );
}
