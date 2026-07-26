import { useAppStore } from "@/store/app-store";
import {
  useSupabaseCollection,
  inserirLinha,
  atualizarLinha,
  excluirLinha,
  contarDependentes,
  registrarAuditoria,
} from "@/data/supabase-collection";
import type {
  Company,
  Profile,
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
 * Camada de repositório — ponto único de acesso a dados, agora contra o
 * Supabase real (era mock em memória antes desta troca).
 *
 * Toda tela continua chamando só `use*()` e `repository.*` — a assinatura
 * não mudou, então nenhum componente precisou ser tocado nesta troca.
 *
 * Os hooks usam `useSupabaseCollection` (busca + Supabase Realtime) e
 * filtram pela empresa ativa — o mesmo isolamento que a RLS já garante no
 * banco, aplicado também no client para não buscar dado de mais.
 *
 * As funções de `remove` fazem a mesma checagem de integridade que o mock
 * fazia (contar dependentes antes de excluir) porque a maioria das FKs no
 * banco está com `on delete cascade` — sem essa checagem na aplicação, o
 * Postgres apagaria em cascata em vez de bloquear com uma mensagem clara.
 *
 * Ver docs/supabase-mapping.md para o histórico e docs/revisao-arquitetura.md
 * para os pontos de atenção.
 */

function useActiveCompanyId(): string {
  return useAppStore((s) => s.activeCompanyId);
}

// ---------------------------------------------------------------------------
// Hooks de leitura
// ---------------------------------------------------------------------------

export function useCompanies(): Company[] {
  return useSupabaseCollection<Company>("companies", {});
}
/** Exceção proposital: painel do admin InovareTech, cross-empresa (ver Empresas). */
export function useHospitalsAllCompanies(): Hospital[] {
  return useSupabaseCollection<Hospital>("hospitals", {});
}
export function useHospitals(): Hospital[] {
  return useSupabaseCollection<Hospital>("hospitals", { company_id: useActiveCompanyId() });
}
export function useClinics(): Clinic[] {
  return useSupabaseCollection<Clinic>("clinics", { company_id: useActiveCompanyId() });
}
export function useUnits(): Unit[] {
  return useSupabaseCollection<Unit>("units", { company_id: useActiveCompanyId() });
}
export function useCostCenters(): CostCenter[] {
  return useSupabaseCollection<CostCenter>("cost_centers", { company_id: useActiveCompanyId() });
}
export function useTeams(): Team[] {
  return useSupabaseCollection<Team>("teams", { company_id: useActiveCompanyId() });
}
export function useHealthInsurances(): HealthInsurance[] {
  return useSupabaseCollection<HealthInsurance>("health_insurances", { company_id: useActiveCompanyId() });
}
export function useContracts(): Contract[] {
  return useSupabaseCollection<Contract>("contracts", { company_id: useActiveCompanyId() });
}
export function usePatients(): Patient[] {
  return useSupabaseCollection<Patient>("patients", { company_id: useActiveCompanyId() });
}
export function usePhysiotherapists(): Physiotherapist[] {
  return useSupabaseCollection<Physiotherapist>("physiotherapists", { company_id: useActiveCompanyId() });
}
export function useBeds(): Bed[] {
  return useSupabaseCollection<Bed>("beds", { company_id: useActiveCompanyId() });
}
export function useRooms(): Room[] {
  return useSupabaseCollection<Room>("rooms", { company_id: useActiveCompanyId() });
}
export function useAdmissions(): Admission[] {
  return useSupabaseCollection<Admission>("admissions", { company_id: useActiveCompanyId() });
}
export function useProcedures(): Procedure[] {
  return useSupabaseCollection<Procedure>("procedures", { company_id: useActiveCompanyId() });
}
export function useDailyProduction(): DailyProduction[] {
  return useSupabaseCollection<DailyProduction>("daily_production", { company_id: useActiveCompanyId() });
}
export function useClinicalEvolutions(): ClinicalEvolution[] {
  return useSupabaseCollection<ClinicalEvolution>("clinical_evolutions", { company_id: useActiveCompanyId() });
}
export function useShifts(): Shift[] {
  return useSupabaseCollection<Shift>("shifts", { company_id: useActiveCompanyId() });
}
export function useTasyImports(): TasyImport[] {
  return useSupabaseCollection<TasyImport>("tasy_imports", { company_id: useActiveCompanyId() });
}
export function useActivityLog(): ActivityLog[] {
  return useSupabaseCollection<ActivityLog>("activity_log", { company_id: useActiveCompanyId() });
}
export function useReceivables(): Receivable[] {
  return useSupabaseCollection<Receivable>("receivables", { company_id: useActiveCompanyId() });
}
export function useProfiles(): Profile[] {
  return useSupabaseCollection<Profile>("profiles", { company_id: useActiveCompanyId() });
}
/** Usuários que criaram conta mas ainda não foram vinculados a nenhuma empresa. */
export function useUnassignedProfiles(): Profile[] {
  return useSupabaseCollection<Profile>("profiles", { company_id: null });
}

// ---------------------------------------------------------------------------
// Guard de exclusão genérico: conta dependentes e lança erro descritivo
// ---------------------------------------------------------------------------

interface DependenciaCheck {
  table: Parameters<typeof contarDependentes>[0];
  coluna: string;
  rotulo: string;
}

async function bloquearSeTiverDependentes(id: string, checks: DependenciaCheck[], sujeito: string) {
  const bloqueios: string[] = [];
  for (const check of checks) {
    const total = await contarDependentes(check.table, check.coluna, id);
    if (total > 0) bloqueios.push(`${total} ${check.rotulo}`);
  }
  if (bloqueios.length > 0) {
    throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a ${sujeito}.`);
  }
}

// ---------------------------------------------------------------------------
// Repository — criar / editar / excluir
// ---------------------------------------------------------------------------

export const repository = {
  companies: {
    create: async (data: Pick<Company, "name" | "cnpj">): Promise<Company> => {
      const row = await inserirLinha<Company>("companies", data);
      await registrarAuditoria({ company_id: row.id, action: "criado", entity_type: "Empresa", entity_label: row.name });
      return row;
    },
    update: async (id: string, patch: Partial<Pick<Company, "name" | "cnpj" | "notification_preferences">>): Promise<void> => {
      await atualizarLinha("companies", id, patch);
      await registrarAuditoria({ company_id: id, action: "editado", entity_type: "Empresa", entity_label: patch.name ?? id });
    },
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "hospitals", coluna: "company_id", rotulo: "hospital(is)" },
          { table: "clinics", coluna: "company_id", rotulo: "clínica(s)" },
          { table: "patients", coluna: "company_id", rotulo: "paciente(s)" },
        ],
        "esta empresa"
      );
      await excluirLinha("companies", id);
    },
  },

  hospitals: {
    create: async (
      data: Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">
    ): Promise<Hospital> => {
      const row = await inserirLinha<Hospital>("hospitals", data);
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Hospital", entity_label: row.name });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>
    ): Promise<void> => {
      await atualizarLinha("hospitals", id, patch);
      if (patch.company_id) {
        await registrarAuditoria({ company_id: patch.company_id, action: "editado", entity_type: "Hospital", entity_label: patch.name ?? id });
      }
    },
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "units", coluna: "hospital_id", rotulo: "ala(s)/unidade(s)" },
          { table: "contracts", coluna: "hospital_id", rotulo: "contrato(s)" },
          { table: "admissions", coluna: "hospital_id", rotulo: "internação(ões)" },
        ],
        "este hospital"
      );
      const { supabase } = await import("@/lib/supabase");
      const { data: hospital } = await supabase.from("hospitals").select("company_id, name").eq("id", id).maybeSingle();
      await excluirLinha("hospitals", id);
      if (hospital) {
        await registrarAuditoria({ company_id: hospital.company_id, action: "excluido", entity_type: "Hospital", entity_label: hospital.name });
      }
    },
  },

  clinics: {
    create: async (
      data: Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">
    ): Promise<Clinic> => inserirLinha<Clinic>("clinics", data),
    update: async (
      id: string,
      patch: Partial<Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>
    ): Promise<void> => atualizarLinha("clinics", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "units", coluna: "clinic_id", rotulo: "unidade(s)" }], "esta clínica");
      await excluirLinha("clinics", id);
    },
  },

  units: {
    create: async (data: Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">): Promise<Unit> =>
      inserirLinha<Unit>("units", data),
    update: async (id: string, patch: Partial<Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">>): Promise<void> =>
      atualizarLinha("units", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "rooms", coluna: "unit_id", rotulo: "quarto(s)" },
          { table: "beds", coluna: "unit_id", rotulo: "leito(s)" },
          { table: "admissions", coluna: "unit_id", rotulo: "internação(ões)" },
          { table: "shifts", coluna: "unit_id", rotulo: "turno(s) de escala" },
        ],
        "esta ala/unidade"
      );
      await excluirLinha("units", id);
    },
  },

  costCenters: {
    create: async (data: Pick<CostCenter, "name" | "company_id">): Promise<CostCenter> =>
      inserirLinha<CostCenter>("cost_centers", data),
    update: async (id: string, patch: Partial<Pick<CostCenter, "name" | "company_id">>): Promise<void> =>
      atualizarLinha("cost_centers", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "contracts", coluna: "cost_center_id", rotulo: "contrato(s)" }], "este centro de custo");
      await excluirLinha("cost_centers", id);
    },
  },

  teams: {
    create: async (data: Pick<Team, "name" | "company_id">): Promise<Team> => inserirLinha<Team>("teams", data),
    update: async (id: string, patch: Partial<Pick<Team, "name" | "company_id">>): Promise<void> =>
      atualizarLinha("teams", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "physiotherapists", coluna: "team_id", rotulo: "fisioterapeuta(s)" }], "esta equipe");
      await excluirLinha("teams", id);
    },
  },

  healthInsurances: {
    create: async (data: Pick<HealthInsurance, "name" | "ans_code" | "company_id">): Promise<HealthInsurance> =>
      inserirLinha<HealthInsurance>("health_insurances", data),
    update: async (id: string, patch: Partial<Pick<HealthInsurance, "name" | "ans_code" | "company_id">>): Promise<void> =>
      atualizarLinha("health_insurances", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "contracts", coluna: "health_insurance_id", rotulo: "contrato(s)" },
          { table: "admissions", coluna: "health_insurance_id", rotulo: "internação(ões)" },
        ],
        "este convênio"
      );
      await excluirLinha("health_insurances", id);
    },
  },

  contracts: {
    create: async (
      data: Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "company_id">
    ): Promise<Contract> => {
      const row = await inserirLinha<Contract>("contracts", { ...data, status: "ativo" });
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Contrato", entity_label: `Contrato ${row.id.slice(0, 8)}` });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "status" | "company_id">>
    ): Promise<void> => atualizarLinha("contracts", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "receivables", coluna: "contract_id", rotulo: "lançamento(s) financeiro(s)" }], "este contrato");
      await excluirLinha("contracts", id);
    },
  },

  patients: {
    create: async (data: Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">): Promise<Patient> => {
      const row = await inserirLinha<Patient>("patients", data);
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Paciente", entity_label: row.full_name });
      return row;
    },
    update: async (id: string, patch: Partial<Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">>): Promise<void> =>
      atualizarLinha("patients", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "admissions", coluna: "patient_id", rotulo: "internação(ões)" }], "este paciente");
      await excluirLinha("patients", id);
    },
  },

  physiotherapists: {
    create: async (
      data: Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">
    ): Promise<Physiotherapist> => {
      const row = await inserirLinha<Physiotherapist>("physiotherapists", data);
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Fisioterapeuta", entity_label: row.full_name });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">>
    ): Promise<void> => atualizarLinha("physiotherapists", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "daily_production", coluna: "physiotherapist_id", rotulo: "lançamento(s) de produção" },
          { table: "clinical_evolutions", coluna: "physiotherapist_id", rotulo: "evolução(ões) clínica(s)" },
          { table: "shifts", coluna: "physiotherapist_id", rotulo: "turno(s) de escala" },
        ],
        "este fisioterapeuta"
      );
      await excluirLinha("physiotherapists", id);
    },
  },

  beds: {
    create: async (data: Pick<Bed, "unit_id" | "room_id" | "code" | "status" | "company_id">): Promise<Bed> =>
      inserirLinha<Bed>("beds", data),
    update: async (id: string, patch: Partial<Pick<Bed, "unit_id" | "room_id" | "code" | "company_id">>): Promise<void> =>
      atualizarLinha("beds", id, patch),
    updateStatus: async (id: string, status: string): Promise<void> => atualizarLinha("beds", id, { status }),
    remove: async (id: string): Promise<void> => {
      const { supabase } = await import("@/lib/supabase");
      const { count } = await supabase
        .from("admissions")
        .select("id", { count: "exact", head: true })
        .eq("bed_id", id)
        .eq("status", "internado");
      if ((count ?? 0) > 0) {
        throw new Error("Não é possível excluir: este leito está ocupado por uma internação ativa. Dê alta antes de excluir.");
      }
      await excluirLinha("beds", id);
    },
  },

  rooms: {
    create: async (data: Pick<Room, "unit_id" | "code" | "company_id">): Promise<Room> => inserirLinha<Room>("rooms", data),
    update: async (id: string, patch: Partial<Pick<Room, "unit_id" | "code" | "company_id">>): Promise<void> =>
      atualizarLinha("rooms", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "beds", coluna: "room_id", rotulo: "leito(s)" }], "este quarto");
      await excluirLinha("rooms", id);
    },
  },

  admissions: {
    create: async (
      data: Pick<Admission, "patient_id" | "hospital_id" | "unit_id" | "bed_id" | "health_insurance_id" | "admission_date" | "company_id">
    ): Promise<Admission> => {
      const row = await inserirLinha<Admission>("admissions", { ...data, status: "internado" });
      if (row.bed_id) await atualizarLinha("beds", row.bed_id, { status: "ocupado" });
      return row;
    },
    discharge: async (id: string, dischargeDate: string): Promise<void> => {
      const { supabase } = await import("@/lib/supabase");
      const { data: admissao, error } = await supabase.from("admissions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!admissao) throw new Error("Internação não encontrada.");
      if (admissao.status === "alta") throw new Error("Esta internação já teve alta registrada.");
      await atualizarLinha("admissions", id, { status: "alta", discharge_date: dischargeDate });
      if (admissao.bed_id) await atualizarLinha("beds", admissao.bed_id, { status: "higienizacao" });
      await registrarAuditoria({
        company_id: admissao.company_id,
        action: "alta",
        entity_type: "Internação",
        entity_label: `Internação ${id.slice(0, 8)}`,
      });
    },
  },

  procedures: {
    create: async (data: Pick<Procedure, "name" | "code" | "category" | "company_id">): Promise<Procedure> =>
      inserirLinha<Procedure>("procedures", data),
    update: async (id: string, patch: Partial<Pick<Procedure, "name" | "code" | "category" | "company_id">>): Promise<void> =>
      atualizarLinha("procedures", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "daily_production", coluna: "procedure_id", rotulo: "lançamento(s) de produção" }], "este procedimento");
      await excluirLinha("procedures", id);
    },
  },

  dailyProduction: {
    create: async (
      data: Pick<DailyProduction, "admission_id" | "physiotherapist_id" | "procedure_id" | "production_date" | "source" | "company_id">
    ): Promise<DailyProduction> => inserirLinha<DailyProduction>("daily_production", data),
  },

  clinicalEvolutions: {
    create: async (
      data: Pick<ClinicalEvolution, "admission_id" | "physiotherapist_id" | "content" | "company_id">
    ): Promise<ClinicalEvolution> => {
      if (data.content.trim().length < 10) {
        throw new Error("A evolução precisa ter pelo menos 10 caracteres.");
      }
      return inserirLinha<ClinicalEvolution>("clinical_evolutions", data);
    },
  },

  shifts: {
    create: async (
      data: Pick<Shift, "physiotherapist_id" | "unit_id" | "shift_date" | "period" | "company_id">
    ): Promise<Shift> => {
      try {
        return await inserirLinha<Shift>("shifts", data);
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "";
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          throw new Error("Este fisioterapeuta já tem um turno cadastrado nesta data e período.");
        }
        throw erro;
      }
    },
    remove: async (id: string): Promise<void> => excluirLinha("shifts", id),
  },

  tasyImports: {
    create: async (
      data: Pick<TasyImport, "file_name" | "total_rows" | "inconsistencies" | "company_id">
    ): Promise<TasyImport> => {
      const row = await inserirLinha<TasyImport>("tasy_imports", { ...data, status: "concluida" });
      await registrarAuditoria({ company_id: row.company_id, action: "importado", entity_type: "Importação Tasy", entity_label: row.file_name });
      return row;
    },
    undo: async (id: string): Promise<void> => {
      const { supabase } = await import("@/lib/supabase");
      const { data: importacao, error } = await supabase.from("tasy_imports").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!importacao) throw new Error("Importação não encontrada.");
      if (importacao.status === "desfeita") throw new Error("Esta importação já foi desfeita.");
      await atualizarLinha("tasy_imports", id, { status: "desfeita", undone_at: new Date().toISOString() });
      await registrarAuditoria({ company_id: importacao.company_id, action: "desfeito", entity_type: "Importação Tasy", entity_label: importacao.file_name });
    },
  },

  receivables: {
    create: async (
      data: Pick<Receivable, "company_id" | "contract_id" | "competencia" | "amount" | "due_date" | "status">
    ): Promise<Receivable> => {
      try {
        return await inserirLinha<Receivable>("receivables", data);
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "";
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          throw new Error("Já existe um lançamento para este contrato nesta competência.");
        }
        throw erro;
      }
    },
    markPaid: async (id: string): Promise<void> => {
      const { supabase } = await import("@/lib/supabase");
      const { data: recebivel, error } = await supabase.from("receivables").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!recebivel) throw new Error("Lançamento não encontrado.");
      if (recebivel.status === "pago") throw new Error("Este lançamento já está marcado como pago.");
      await atualizarLinha("receivables", id, { status: "pago", paid_at: new Date().toISOString() });
    },
    remove: async (id: string): Promise<void> => excluirLinha("receivables", id),
  },

  profiles: {
    update: async (
      id: string,
      patch: Partial<Pick<Profile, "full_name" | "role" | "company_id">>
    ): Promise<void> => atualizarLinha("profiles", id, patch),
  },
};
