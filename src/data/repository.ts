import { useShallow } from "zustand/react/shallow";
import { useMockStore } from "@/data/mock-store";
import { useAppStore } from "@/store/app-store";
import type {
  Company,
  Hospital,
  Clinic,
  Unit,
  CostCenter,
  Team,
  HealthInsurance,
  Contract,
  Patient,
  Physiotherapist,
  Bed,
  Room,
  Admission,
  Procedure,
  DailyProduction,
  ClinicalEvolution,
  Shift,
  TasyImport,
  ActivityLog,
  Receivable,
} from "@/types/domain";

/**
 * Camada de repositório — ponto único de acesso a dados.
 *
 * Hoje, cada `create`/`remove` grava no Zustand (src/data/mock-store.ts) e
 * cada `use*()` lê do mesmo lugar. Quando o Supabase do Fisio existir, só o
 * CORPO destas funções muda (troca por `supabase.from("<tabela>")...`); a
 * assinatura permanece igual, então nenhuma tela precisa ser tocada.
 *
 * Todo hook `use*()` (exceto `useCompanies`) filtra pela empresa ativa no
 * seletor do topo — o mesmo isolamento que a RLS vai aplicar no Postgres
 * real, já testado aqui antes de existir banco.
 *
 * Os seletores usam `useShallow` porque `.filter()` devolve um array novo a
 * cada execução: sem ele, qualquer escrita em qualquer parte do store faria
 * TODAS as telas re-renderizarem, mesmo as que não usam o dado alterado.
 * Com comparação rasa, a tela só re-renderiza quando o conteúdo da lista
 * dela realmente muda.
 *
 * Ver docs/supabase-mapping.md para o mapeamento completo tabela ↔ tela.
 */

function useActiveCompanyId(): string {
  return useAppStore((s) => s.activeCompanyId);
}

export function useCompanies(): Company[] {
  return useMockStore(useShallow((s) => s.companies));
}
export function useHospitals(): Hospital[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.hospitals.filter((h) => h.company_id === activeCompanyId)));
}
/**
 * Exceção proposital: a tela de Empresas é a única visão "cross-empresa"
 * do sistema (o painel do administrador/agência que gerencia várias
 * empresas-cliente) — por isso lê hospitais de todas as empresas, sem
 * filtrar pela ativa, só para exibir a contagem por empresa nos cards.
 */
export function useHospitalsAllCompanies(): Hospital[] {
  return useMockStore(useShallow((s) => s.hospitals));
}
export function useClinics(): Clinic[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.clinics.filter((c) => c.company_id === activeCompanyId)));
}
export function useUnits(): Unit[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.units.filter((u) => u.company_id === activeCompanyId)));
}
export function useCostCenters(): CostCenter[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.costCenters.filter((c) => c.company_id === activeCompanyId)));
}
export function useTeams(): Team[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.teams.filter((t) => t.company_id === activeCompanyId)));
}
export function useHealthInsurances(): HealthInsurance[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.healthInsurances.filter((h) => h.company_id === activeCompanyId)));
}
export function useContracts(): Contract[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.contracts.filter((c) => c.company_id === activeCompanyId)));
}
export function usePatients(): Patient[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.patients.filter((p) => p.company_id === activeCompanyId)));
}
export function usePhysiotherapists(): Physiotherapist[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.physiotherapists.filter((f) => f.company_id === activeCompanyId)));
}
export function useBeds(): Bed[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.beds.filter((b) => b.company_id === activeCompanyId)));
}
export function useRooms(): Room[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.rooms.filter((r) => r.company_id === activeCompanyId)));
}
export function useAdmissions(): Admission[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.admissions.filter((a) => a.company_id === activeCompanyId)));
}
export function useProcedures(): Procedure[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.procedures.filter((p) => p.company_id === activeCompanyId)));
}
export function useDailyProduction(): DailyProduction[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.dailyProduction.filter((p) => p.company_id === activeCompanyId)));
}
export function useClinicalEvolutions(): ClinicalEvolution[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.clinicalEvolutions.filter((e) => e.company_id === activeCompanyId)));
}
export function useShifts(): Shift[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.shifts.filter((sh) => sh.company_id === activeCompanyId)));
}
export function useTasyImports(): TasyImport[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.tasyImports.filter((t) => t.company_id === activeCompanyId)));
}
export function useActivityLog(): ActivityLog[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.activityLog.filter((a) => a.company_id === activeCompanyId)));
}
export function useReceivables(): Receivable[] {
  const activeCompanyId = useActiveCompanyId();
  return useMockStore(useShallow((s) => s.receivables.filter((r) => r.company_id === activeCompanyId)));
}

export const repository = {
  companies: {
    create: async (data: Pick<Company, "name" | "cnpj">): Promise<Company> => useMockStore.getState().addCompany(data),
    update: async (id: string, patch: Partial<Pick<Company, "name" | "cnpj">>): Promise<void> =>
      useMockStore.getState().updateCompany(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeCompany(id),
  },
  hospitals: {
    create: async (
      data: Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">
    ): Promise<Hospital> => useMockStore.getState().addHospital(data),
    update: async (
      id: string,
      patch: Partial<Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>
    ): Promise<void> => useMockStore.getState().updateHospital(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeHospital(id),
  },
  clinics: {
    create: async (
      data: Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">
    ): Promise<Clinic> => useMockStore.getState().addClinic(data),
    update: async (
      id: string,
      patch: Partial<Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>
    ): Promise<void> => useMockStore.getState().updateClinic(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeClinic(id),
  },
  units: {
    create: async (data: Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">): Promise<Unit> =>
      useMockStore.getState().addUnit(data),
    update: async (id: string, patch: Partial<Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateUnit(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeUnit(id),
  },
  costCenters: {
    create: async (data: Pick<CostCenter, "name" | "company_id">): Promise<CostCenter> =>
      useMockStore.getState().addCostCenter(data),
    update: async (id: string, patch: Partial<Pick<CostCenter, "name" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateCostCenter(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeCostCenter(id),
  },
  teams: {
    create: async (data: Pick<Team, "name" | "company_id">): Promise<Team> => useMockStore.getState().addTeam(data),
    update: async (id: string, patch: Partial<Pick<Team, "name" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateTeam(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeTeam(id),
  },
  healthInsurances: {
    create: async (data: Pick<HealthInsurance, "name" | "ans_code" | "company_id">): Promise<HealthInsurance> =>
      useMockStore.getState().addHealthInsurance(data),
    update: async (id: string, patch: Partial<Pick<HealthInsurance, "name" | "ans_code" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateHealthInsurance(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeHealthInsurance(id),
  },
  contracts: {
    create: async (
      data: Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "company_id">
    ): Promise<Contract> => useMockStore.getState().addContract(data),
    update: async (
      id: string,
      patch: Partial<Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "status" | "company_id">>
    ): Promise<void> => useMockStore.getState().updateContract(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeContract(id),
  },
  patients: {
    create: async (data: Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">): Promise<Patient> =>
      useMockStore.getState().addPatient(data),
    update: async (id: string, patch: Partial<Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">>): Promise<void> =>
      useMockStore.getState().updatePatient(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removePatient(id),
  },
  physiotherapists: {
    create: async (
      data: Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">
    ): Promise<Physiotherapist> => useMockStore.getState().addPhysiotherapist(data),
    update: async (
      id: string,
      patch: Partial<Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">>
    ): Promise<void> => useMockStore.getState().updatePhysiotherapist(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removePhysiotherapist(id),
  },
  beds: {
    create: async (data: Pick<Bed, "unit_id" | "room_id" | "code" | "status" | "company_id">): Promise<Bed> =>
      useMockStore.getState().addBed(data),
    update: async (id: string, patch: Partial<Pick<Bed, "unit_id" | "room_id" | "code" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateBed(id, patch),
    updateStatus: async (id: string, status: string): Promise<void> => useMockStore.getState().updateBedStatus(id, status),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeBed(id),
  },
  rooms: {
    create: async (data: Pick<Room, "unit_id" | "code" | "company_id">): Promise<Room> => useMockStore.getState().addRoom(data),
    update: async (id: string, patch: Partial<Pick<Room, "unit_id" | "code" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateRoom(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeRoom(id),
  },
  admissions: {
    create: async (
      data: Pick<Admission, "patient_id" | "hospital_id" | "unit_id" | "bed_id" | "health_insurance_id" | "admission_date" | "company_id">
    ): Promise<Admission> => useMockStore.getState().addAdmission(data),
    discharge: async (id: string, dischargeDate: string): Promise<void> =>
      useMockStore.getState().dischargeAdmission(id, dischargeDate),
  },
  procedures: {
    create: async (data: Pick<Procedure, "name" | "code" | "category" | "company_id">): Promise<Procedure> =>
      useMockStore.getState().addProcedure(data),
    update: async (id: string, patch: Partial<Pick<Procedure, "name" | "code" | "category" | "company_id">>): Promise<void> =>
      useMockStore.getState().updateProcedure(id, patch),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeProcedure(id),
  },
  dailyProduction: {
    create: async (
      data: Pick<DailyProduction, "admission_id" | "physiotherapist_id" | "procedure_id" | "production_date" | "source" | "company_id">
    ): Promise<DailyProduction> => useMockStore.getState().addDailyProduction(data),
  },
  clinicalEvolutions: {
    create: async (
      data: Pick<ClinicalEvolution, "admission_id" | "physiotherapist_id" | "content" | "company_id">
    ): Promise<ClinicalEvolution> => useMockStore.getState().addClinicalEvolution(data),
  },
  shifts: {
    create: async (
      data: Pick<Shift, "physiotherapist_id" | "unit_id" | "shift_date" | "period" | "company_id">
    ): Promise<Shift> => useMockStore.getState().addShift(data),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeShift(id),
  },
  tasyImports: {
    create: async (
      data: Pick<TasyImport, "file_name" | "total_rows" | "inconsistencies" | "company_id">
    ): Promise<TasyImport> => useMockStore.getState().addTasyImport(data),
    undo: async (id: string): Promise<void> => useMockStore.getState().undoTasyImport(id),
  },
  receivables: {
    create: async (
      data: Pick<Receivable, "company_id" | "contract_id" | "competencia" | "amount" | "due_date" | "status">
    ): Promise<Receivable> => useMockStore.getState().addReceivable(data),
    markPaid: async (id: string): Promise<void> => useMockStore.getState().markReceivablePaid(id),
    remove: async (id: string): Promise<void> => useMockStore.getState().removeReceivable(id),
  },
};
