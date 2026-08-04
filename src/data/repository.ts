import { useAppStore } from "@/store/app-store";
import {
  useSupabaseCollection,
  inserirLinha,
  atualizarLinha,
  excluirLinha,
  excluirLinhaPorEmpresa,
  excluirLinhaPorColuna,
  contarDependentes,
  registrarAuditoria,
  buscarOuCriarEmLote,
  emLotes,
} from "@/data/supabase-collection";
import { parseTasyReport, resumirImportacao } from "@/lib/tasy-parser";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/auth-provider";
import { permissaoPadrao, type Permissao } from "@/lib/permissions";
import { hojeLocalIso } from "@/lib/data-local";
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
  ContractUnit,
  Patient,
  PatientInsuranceHistory,
  Physiotherapist,
  Bed,
  Room,
  Admission,
  Procedure,
  DailyProduction,
  ClinicalEvolution,
  Shift,
  TasyImport,
  TasyImportRow,
  RolePermission,
  BillingEntry,
  PatientQueueItem,
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
  return useSupabaseCollection<Company>("companies", {}, "name");
}
/** Exceção proposital: painel do admin InovareTech, cross-empresa (ver Empresas). */
export function useHospitalsAllCompanies(): Hospital[] {
  return useSupabaseCollection<Hospital>("hospitals", {}, "name");
}
export function useHospitals(): Hospital[] {
  return useSupabaseCollection<Hospital>("hospitals", { company_id: useActiveCompanyId() }, "name");
}
export function useClinics(): Clinic[] {
  return useSupabaseCollection<Clinic>("clinics", { company_id: useActiveCompanyId() }, "name");
}
export function useUnits(): Unit[] {
  return useSupabaseCollection<Unit>("units", { company_id: useActiveCompanyId() }, "name");
}
export function useCostCenters(): CostCenter[] {
  return useSupabaseCollection<CostCenter>("cost_centers", { company_id: useActiveCompanyId() }, "name");
}
export function useTeams(): Team[] {
  return useSupabaseCollection<Team>("teams", { company_id: useActiveCompanyId() }, "name");
}
export function useHealthInsurances(): HealthInsurance[] {
  return useSupabaseCollection<HealthInsurance>("health_insurances", { company_id: useActiveCompanyId() }, "name");
}
export function useContracts(): Contract[] {
  return useSupabaseCollection<Contract>("contracts", { company_id: useActiveCompanyId() }, "start_date");
}
export function usePatients(): Patient[] {
  return useSupabaseCollection<Patient>("patients", { company_id: useActiveCompanyId() }, "full_name");
}
export function usePatientInsuranceHistory(patientId: string | undefined): PatientInsuranceHistory[] {
  return useSupabaseCollection<PatientInsuranceHistory>("patient_insurance_history", {
    company_id: useActiveCompanyId(),
    patient_id: patientId,
  });
}
export function useContractUnits(): ContractUnit[] {
  return useSupabaseCollection<ContractUnit>("contract_units", { company_id: useActiveCompanyId() });
}
export function usePhysiotherapists(): Physiotherapist[] {
  return useSupabaseCollection<Physiotherapist>("physiotherapists", { company_id: useActiveCompanyId() }, "full_name");
}
export function useBeds(): Bed[] {
  return useSupabaseCollection<Bed>("beds", { company_id: useActiveCompanyId() }, "code");
}
export function useRooms(): Room[] {
  return useSupabaseCollection<Room>("rooms", { company_id: useActiveCompanyId() }, "code");
}
export function useAdmissions(): Admission[] {
  return useSupabaseCollection<Admission>("admissions", { company_id: useActiveCompanyId() });
}
export function useProcedures(): Procedure[] {
  return useSupabaseCollection<Procedure>("procedures", { company_id: useActiveCompanyId() }, "code");
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
export function useTasyImportRowsPendentes(): TasyImportRow[] {
  return useSupabaseCollection<TasyImportRow>("tasy_import_rows", { company_id: useActiveCompanyId(), status: "pendente" });
}
export function useRolePermissions(): RolePermission[] {
  return useSupabaseCollection<RolePermission>("role_permissions", { company_id: useActiveCompanyId() });
}
export function useBillingEntries(): BillingEntry[] {
  return useSupabaseCollection<BillingEntry>("billing_entries", { company_id: useActiveCompanyId() });
}
export function usePatientQueue(): PatientQueueItem[] {
  return useSupabaseCollection<PatientQueueItem>("patient_queue", { company_id: useActiveCompanyId() });
}

/**
 * Permissão efetiva do usuário logado pra um módulo — admin InovareTech
 * sempre tem tudo; senão usa a linha de `role_permissions` se existir,
 * caindo pro padrão embutido (`permissaoPadrao`) quando não existe.
 */
export function usePermission(moduleSlug: string): Permissao {
  const { profile } = useAuth();
  const permissoes = useRolePermissions();
  if (!profile) return { can_view: false, can_create: false, can_edit: false, can_delete: false };
  if (profile.is_platform_admin) return { can_view: true, can_create: true, can_edit: true, can_delete: true };
  const linha = permissoes.find((p) => p.role === profile.role && p.module_slug === moduleSlug);
  if (linha) return { can_view: linha.can_view, can_create: linha.can_create, can_edit: linha.can_edit, can_delete: linha.can_delete };
  return permissaoPadrao(profile.role, moduleSlug);
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
    update: async (id: string, patch: Partial<Pick<Company, "name" | "cnpj" | "notification_preferences" | "glosa_por_procedimento">>): Promise<void> => {
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
      data: Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "aplica_todas_unidades" | "company_id">
    ): Promise<Contract> => {
      const row = await inserirLinha<Contract>("contracts", { ...data, status: "ativo" });
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Contrato", entity_label: `Contrato ${row.id.slice(0, 8)}` });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "status" | "aplica_todas_unidades" | "company_id">>
    ): Promise<void> => atualizarLinha("contracts", id, patch),
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "receivables", coluna: "contract_id", rotulo: "lançamento(s) financeiro(s)" }], "este contrato");
      await excluirLinha("contracts", id);
    },
  },

  contractUnits: {
    /** Substitui por completo as unidades associadas a um contrato específico. */
    definirUnidades: async (contractId: string, companyId: string, unitIds: string[]): Promise<void> => {
      const { error: errorDelete } = await supabase.from("contract_units").delete().eq("contract_id", contractId);
      if (errorDelete) throw new Error(errorDelete.message);
      if (unitIds.length === 0) return;
      const { error: errorInsert } = await supabase
        .from("contract_units")
        .insert(unitIds.map((unitId) => ({ company_id: companyId, contract_id: contractId, unit_id: unitId })));
      if (errorInsert) throw new Error(errorInsert.message);
    },
  },

  patients: {
    create: async (
      data: Pick<Patient, "full_name" | "birth_date" | "document" | "sexo" | "health_insurance_id" | "company_id">
    ): Promise<Patient> => {
      const row = await inserirLinha<Patient>("patients", data);
      if (row.health_insurance_id) {
        await inserirLinha("patient_insurance_history", {
          company_id: row.company_id,
          patient_id: row.id,
          health_insurance_id: row.health_insurance_id,
        });
      }
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Paciente", entity_label: row.full_name });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Patient, "full_name" | "birth_date" | "document" | "sexo" | "health_insurance_id" | "company_id">>
    ): Promise<void> => {
      // Muda de convênio? Grava no histórico antes de sobrescrever — nunca
      // perde o registro de qual convênio o paciente tinha antes.
      if ("health_insurance_id" in patch) {
        const { supabase } = await import("@/lib/supabase");
        const { data: atual } = await supabase.from("patients").select("company_id, health_insurance_id").eq("id", id).maybeSingle();
        if (atual && atual.health_insurance_id !== patch.health_insurance_id) {
          await inserirLinha("patient_insurance_history", {
            company_id: atual.company_id,
            patient_id: id,
            health_insurance_id: patch.health_insurance_id ?? null,
          });
        }
      }
      await atualizarLinha("patients", id, patch);
    },
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(id, [{ table: "admissions", coluna: "patient_id", rotulo: "internação(ões)" }], "este paciente");
      await excluirLinha("patients", id);
    },
    /**
     * Exclusão forçada — apaga o paciente e TUDO que depende dele
     * (evoluções, produção, fila, faturamento, internações), em vez de
     * bloquear. Uso deliberado e raro (Configurações → Exclusão
     * avançada), não o botão normal de excluir da tela de Pacientes.
     */
    removeForcado: async (id: string): Promise<{ internacoes: number; producao: number; evolucoes: number }> => {
      const { supabase } = await import("@/lib/supabase");
      const { data: internacoesDoPaciente, error: errBusca } = await supabase.from("admissions").select("id").eq("patient_id", id);
      if (errBusca) throw new Error(errBusca.message);
      const idsInternacoes = (internacoesDoPaciente ?? []).map((a) => a.id as string);

      let producaoApagada = 0;
      let evolucoesApagadas = 0;
      for (const admissionId of idsInternacoes) {
        producaoApagada += await excluirLinhaPorColuna("daily_production", "admission_id", admissionId);
        evolucoesApagadas += await excluirLinhaPorColuna("clinical_evolutions", "admission_id", admissionId);
        await excluirLinhaPorColuna("patient_queue", "admission_id", admissionId);
        await excluirLinhaPorColuna("billing_entries", "admission_id", admissionId);
      }
      await excluirLinhaPorColuna("patient_insurance_history", "patient_id", id);
      await excluirLinhaPorColuna("admissions", "patient_id", id);
      await excluirLinha("patients", id);
      return { internacoes: idsInternacoes.length, producao: producaoApagada, evolucoes: evolucoesApagadas };
    },
  },

  physiotherapists: {
    create: async (
      data: Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "user_id" | "company_id">
    ): Promise<Physiotherapist> => {
      const row = await inserirLinha<Physiotherapist>("physiotherapists", data);
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Fisioterapeuta", entity_label: row.full_name });
      return row;
    },
    update: async (
      id: string,
      patch: Partial<Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "user_id" | "company_id">>
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
    updateStatus: async (id: string, status: string): Promise<void> =>
      atualizarLinha("beds", id, { status, higienizacao_desde: status === "higienizacao" ? new Date().toISOString() : null }),
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
    /**
     * Excluir internação — só pro papel admin (empresa ou InovareTech).
     * Bloqueia se já tiver produção, evolução, fila ou faturamento
     * lançado, igual o padrão do resto do sistema — evita apagar
     * histórico por engano. Pra isso, é preciso ir em Configurações →
     * Exclusão avançada.
     */
    remove: async (id: string): Promise<void> => {
      await bloquearSeTiverDependentes(
        id,
        [
          { table: "daily_production", coluna: "admission_id", rotulo: "lançamento(s) de produção" },
          { table: "clinical_evolutions", coluna: "admission_id", rotulo: "evolução(ões) clínica(s)" },
          { table: "patient_queue", coluna: "admission_id", rotulo: "item(ns) de fila" },
          { table: "billing_entries", coluna: "admission_id", rotulo: "lançamento(s) de faturamento" },
        ],
        "esta internação"
      );
      await excluirLinha("admissions", id);
    },
    create: async (
      data: Pick<Admission, "patient_id" | "hospital_id" | "unit_id" | "bed_id" | "health_insurance_id" | "admission_date" | "admission_time" | "external_reference" | "diagnostico" | "company_id">
    ): Promise<Admission> => {
      try {
        const row = await inserirLinha<Admission>("admissions", { ...data, status: "internado" });
        if (row.bed_id) await atualizarLinha("beds", row.bed_id, { status: "ocupado" });
        return row;
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "";
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          throw new Error("Já existe uma internação com esse Nr. Atendimento nesta empresa.");
        }
        throw erro;
      }
    },
    update: async (
      id: string,
      patch: Partial<Pick<Admission, "patient_id" | "hospital_id" | "unit_id" | "bed_id" | "health_insurance_id" | "admission_date" | "admission_time" | "external_reference" | "diagnostico" | "company_id">>
    ): Promise<void> => {
      try {
        await atualizarLinha("admissions", id, patch);
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "";
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          throw new Error("Já existe uma internação com esse Nr. Atendimento nesta empresa.");
        }
        throw erro;
      }
      // Só reocupa o leito se a internação ainda estiver ativa — editar
      // uma internação já com alta (ex.: corrigir a unidade) não pode
      // devolver o leito pra "ocupado" outra vez.
      if (patch.bed_id) {
        const { data: atual } = await supabase.from("admissions").select("status").eq("id", id).maybeSingle();
        if (atual?.status === "internado") {
          await atualizarLinha("beds", patch.bed_id, { status: "ocupado" });
        }
      }
    },
    /**
     * Dar alta é bloqueado por padrão se não houver nenhum procedimento
     * lançado na data da alta — precisa lançar o atendimento antes, ou
     * confirmar explicitamente que não houve atendimento (`semAtendimento`).
     * Lança um erro com esse sentinela específico pra a tela reconhecer e
     * mostrar a pergunta certa, em vez de um erro genérico.
     */
    discharge: async (id: string, dischargeAtISO: string, semAtendimento = false): Promise<void> => {
      const { data: admissao, error } = await supabase.from("admissions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!admissao) throw new Error("Internação não encontrada.");
      if (admissao.status === "alta") throw new Error("Esta internação já teve alta registrada.");

      const dataAlta = dischargeAtISO.slice(0, 10);
      if (!semAtendimento) {
        const { count, error: errorCount } = await supabase
          .from("daily_production")
          .select("id", { count: "exact", head: true })
          .eq("admission_id", id)
          .eq("production_date", dataAlta);
        if (errorCount) throw new Error(errorCount.message);
        if ((count ?? 0) === 0) {
          throw new Error("SEM_ATENDIMENTO_NA_ALTA");
        }
      }

      await atualizarLinha("admissions", id, {
        status: "alta",
        discharge_date: dataAlta,
        discharge_at: dischargeAtISO,
        confirmou_sem_atendimento_alta: semAtendimento,
      });
      if (admissao.bed_id) {
        await atualizarLinha("beds", admissao.bed_id, { status: "higienizacao", higienizacao_desde: new Date().toISOString() });
      }
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
    /**
     * Exclusão forçada — apaga o procedimento e os lançamentos de
     * produção que o usam. Apaga histórico de verdade (afeta relatórios
     * já fechados), por isso fica em Configurações → Exclusão avançada,
     * não no botão normal da tela de Procedimentos.
     */
    removeForcado: async (id: string): Promise<{ producao: number }> => {
      const producaoApagada = await excluirLinhaPorColuna("daily_production", "procedure_id", id);
      await excluirLinha("procedures", id);
      return { producao: producaoApagada };
    },
  },

  dailyProduction: {
    create: async (
      data: Pick<DailyProduction, "admission_id" | "physiotherapist_id" | "procedure_id" | "production_date" | "production_time" | "source" | "company_id">
    ): Promise<DailyProduction> => inserirLinha<DailyProduction>("daily_production", data),
    update: async (
      id: string,
      patch: Partial<Pick<DailyProduction, "physiotherapist_id" | "procedure_id" | "production_date" | "production_time">>
    ): Promise<void> => {
      const { data: atual, error } = await supabase.from("daily_production").select("confirmado_tasy").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (atual?.confirmado_tasy) {
        throw new Error("Este lançamento já foi confirmado pelo Tasy e não pode mais ser editado.");
      }
      await atualizarLinha("daily_production", id, patch);
    },
    remove: async (id: string): Promise<void> => {
      const { data: atual, error } = await supabase.from("daily_production").select("confirmado_tasy").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (atual?.confirmado_tasy) {
        throw new Error("Este lançamento já foi confirmado pelo Tasy e não pode mais ser excluído.");
      }
      await excluirLinha("daily_production", id);
    },
    registrarGlosa: async (id: string, valor: number, motivo: string): Promise<void> => {
      if (valor <= 0) throw new Error("O valor glosado precisa ser maior que zero.");
      await atualizarLinha("daily_production", id, {
        glosado: true,
        valor_glosado: valor,
        motivo_glosa: motivo || null,
        data_glosa: hojeLocalIso(),
      });
    },
    removerGlosa: async (id: string): Promise<void> => {
      await atualizarLinha("daily_production", id, { glosado: false, valor_glosado: null, motivo_glosa: null, data_glosa: null });
    },
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
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Importação Tasy", entity_label: row.file_name });
      return row;
    },
    undo: async (id: string): Promise<void> => {
      const { data: importacao, error } = await supabase.from("tasy_imports").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!importacao) throw new Error("Importação não encontrada.");
      if (importacao.status === "desfeita") throw new Error("Esta importação já foi desfeita.");

      // Desfazer de verdade agora: reverte confirmado_tasy de tudo que essa
      // importação confirmou — não é só marcar um status, é voltar o
      // estado real dos lançamentos.
      const { data: linhasConfirmadas, error: errorLinhas } = await supabase
        .from("tasy_import_rows")
        .select("matched_daily_production_id")
        .eq("import_id", id)
        .eq("status", "confirmado");
      if (errorLinhas) throw new Error(errorLinhas.message);
      const idsParaReverter = (linhasConfirmadas ?? [])
        .map((l) => l.matched_daily_production_id)
        .filter((v): v is string => Boolean(v));
      for (const lote of emLotes(idsParaReverter, 200)) {
        const { error: errorReverter } = await supabase
          .from("daily_production")
          .update({ confirmado_tasy: false, confirmado_em: null })
          .in("id", lote);
        if (errorReverter) throw new Error(errorReverter.message);
      }

      await atualizarLinha("tasy_imports", id, { status: "desfeita", undone_at: new Date().toISOString() });
      await registrarAuditoria({ company_id: importacao.company_id, action: "desfeito", entity_type: "Importação Tasy", entity_label: importacao.file_name });
    },
    /**
     * O Tasy NÃO é mais uma carga — é uma conferência contra o que a
     * equipe já lançou manualmente. Nenhum paciente/procedimento/hospital/
     * convênio/internação é criado aqui. Cada linha do relatório tenta
     * casar (paciente + código do procedimento + data) com um lançamento
     * de `daily_production` ainda não confirmado:
     *   - bateu → marca `confirmado_tasy = true` (baixado/finalizado)
     *   - não bateu → vira uma linha "pendente" em `tasy_import_rows`,
     *     pra alguém decidir depois (não vira glosa sozinho)
     */
    processarArquivo: async (
      companyId: string,
      fileName: string,
      texto: string
    ): Promise<{
      totalLinhas: number;
      confirmados: number;
      pendentes: number;
      avisos: string[];
      resumo: ReturnType<typeof resumirImportacao>;
      tasyImport: TasyImport;
    }> => {
      const resultado = parseTasyReport(texto);
      if (resultado.linhas.length === 0) {
        throw new Error(
          "Nenhuma linha de produção foi reconhecida neste arquivo. Confira se é uma exportação " +
            "\"Produtividade Médica\" do Tasy no formato esperado."
        );
      }

      // A internação precisa já existir, cadastrada com o Nr. Atendimento
      // certo — é a CHAVE de conciliação agora, não paciente+procedimento.
      // Um Nr. Atendimento é 1:1 com uma internação, que pode ter vários
      // procedimentos em várias datas enquanto o paciente estiver internado.
      const referencias = [...new Set(resultado.linhas.map((l) => l.referenciaExterna).filter(Boolean))];
      const { data: internacoesExistentes, error: errInt } = await supabase
        .from("admissions")
        .select("id, external_reference")
        .eq("company_id", companyId)
        .in("external_reference", referencias);
      if (errInt) throw new Error(`Falha ao buscar internações: ${errInt.message}`);
      const admissionIdPorReferencia = new Map((internacoesExistentes ?? []).map((a) => [a.external_reference as string, a.id as string]));

      const codigos = [...new Set(resultado.linhas.map((l) => l.procedimentoCodigo))];
      const { data: procedimentosExistentes, error: errProc } = await supabase
        .from("procedures")
        .select("id, code")
        .eq("company_id", companyId)
        .in("code", codigos);
      if (errProc) throw new Error(`Falha ao buscar procedimentos: ${errProc.message}`);
      const procedimentoIdPorCodigo = new Map((procedimentosExistentes ?? []).map((p) => [p.code as string, p.id as string]));

      // Candidatos a conciliar: lançamentos ainda não confirmados, das
      // internações que batem com algum Nr. Atendimento do arquivo.
      const admissionIdsCandidatos = [...admissionIdPorReferencia.values()];
      let candidatos: { id: string; admission_id: string | null; procedure_id: string | null; production_date: string }[] = [];
      if (admissionIdsCandidatos.length > 0) {
        const { data: candidatosData, error: errCand } = await supabase
          .from("daily_production")
          .select("id, admission_id, procedure_id, production_date")
          .eq("company_id", companyId)
          .eq("confirmado_tasy", false)
          .in("admission_id", admissionIdsCandidatos);
        if (errCand) throw new Error(`Falha ao buscar lançamentos existentes: ${errCand.message}`);
        candidatos = candidatosData ?? [];
      }

      // Map de fila: pode haver 2+ lançamentos do MESMO procedimento na
      // MESMA internação no mesmo dia (ex.: Motora de manhã e à tarde) —
      // cada linha do Tasy consome UM candidato da fila, não um único "o"
      // candidato fixo. A conciliação valida quantidade por dia, não
      // horário exato.
      const indice = new Map<string, string[]>(); // chave -> fila de daily_production.id
      for (const c of candidatos) {
        if (!c.admission_id || !c.procedure_id) continue;
        const chave = `${c.admission_id}|${c.procedure_id}|${c.production_date}`;
        const fila = indice.get(chave) ?? [];
        fila.push(c.id);
        indice.set(chave, fila);
      }

      let confirmados = 0;
      let pendentes = 0;
      const idsParaConfirmar: string[] = [];
      const linhasParaImportRows = resultado.linhas.map((l) => {
        const admissionId = admissionIdPorReferencia.get(l.referenciaExterna);
        const procedureId = procedimentoIdPorCodigo.get(l.procedimentoCodigo);
        let matchId: string | null = null;
        if (admissionId && procedureId) {
          const chave = `${admissionId}|${procedureId}|${l.dataProducao}`;
          const fila = indice.get(chave);
          if (fila && fila.length > 0) {
            matchId = fila.shift()!; // consome um da fila — a próxima linha do Tasy com a mesma chave pega o próximo
          }
        }
        if (matchId) {
          confirmados++;
          idsParaConfirmar.push(matchId);
        } else {
          pendentes++;
        }
        return {
          company_id: companyId,
          raw_data: {
            hospital: l.hospitalNome,
            convenio: l.convenioNome,
            fisioterapeuta: l.fisioterapeutaNome,
            paciente: l.pacienteNome,
            procedimentoCodigo: l.procedimentoCodigo,
            procedimentoNome: l.procedimentoNome,
            data: l.dataProducao,
            referenciaExterna: l.referenciaExterna,
          },
          matched_daily_production_id: matchId,
          status: (matchId ? "confirmado" : "pendente") as "confirmado" | "pendente",
        };
      });

      for (const lote of emLotes(idsParaConfirmar, 200)) {
        const { error: errConfirmar } = await supabase
          .from("daily_production")
          .update({ confirmado_tasy: true, confirmado_em: new Date().toISOString() })
          .in("id", lote);
        if (errConfirmar) throw new Error(`Falha ao confirmar lançamentos: ${errConfirmar.message}`);
      }

      const tasyImport = await inserirLinha<TasyImport>("tasy_imports", {
        company_id: companyId,
        file_name: fileName,
        total_rows: resultado.linhas.length,
        inconsistencies: pendentes,
        status: "concluida",
      });

      for (const lote of emLotes(linhasParaImportRows, 500)) {
        const { error: errRows } = await supabase
          .from("tasy_import_rows")
          .insert(lote.map((r) => ({ ...r, import_id: tasyImport.id })));
        if (errRows) throw new Error(`Falha ao gravar linhas da importação: ${errRows.message}`);
      }

      const resumo = resumirImportacao(resultado.linhas);
      await registrarAuditoria({ company_id: companyId, action: "importado", entity_type: "Importação Tasy", entity_label: fileName });

      return { totalLinhas: resultado.linhas.length, confirmados, pendentes, avisos: resultado.avisos, resumo, tasyImport };
    },

    /**
     * Modo alternativo — "carga inicial": cria hospital/convênio/
     * fisioterapeuta/paciente/procedimento/internação a partir do
     * arquivo, quando ainda não existem (não sobrescreve quem já existe
     * por nome/código). Útil pra popular uma empresa nova de uma vez,
     * mesmo sabendo que pode precisar corrigir detalhes depois — bem
     * diferente do modo de conciliação (que nunca cria nada). Tudo que
     * entra por aqui já nasce `confirmado_tasy = true`, porque veio
     * direto do relatório do Tasy.
     */
    processarComoCarga: async (
      companyId: string,
      fileName: string,
      texto: string
    ): Promise<{ totalLinhas: number; totalInseridos: number; totalDuplicados: number; resumo: ReturnType<typeof resumirImportacao> }> => {
      const resultado = parseTasyReport(texto);
      if (resultado.linhas.length === 0) {
        throw new Error("Nenhuma linha de produção foi reconhecida neste arquivo.");
      }

      const hospitalPorNome = await buscarOuCriarEmLote(
        "hospitals", "name", resultado.linhas.map((l) => l.hospitalNome), () => ({ company_id: companyId })
      );
      const convenioPorNome = await buscarOuCriarEmLote(
        "health_insurances", "name", resultado.linhas.map((l) => l.convenioNome), () => ({ company_id: companyId })
      );
      const fisioPorNome = await buscarOuCriarEmLote(
        "physiotherapists", "full_name", resultado.linhas.map((l) => l.fisioterapeutaNome), () => ({ company_id: companyId })
      );
      const pacientePorNome = await buscarOuCriarEmLote(
        "patients", "full_name", resultado.linhas.map((l) => l.pacienteNome), () => ({ company_id: companyId })
      );

      const nomePorCodigo = new Map<string, string>();
      for (const l of resultado.linhas) if (!nomePorCodigo.has(l.procedimentoCodigo)) nomePorCodigo.set(l.procedimentoCodigo, l.procedimentoNome);
      const procedimentoPorCodigo = await buscarOuCriarEmLote(
        "procedures", "code", resultado.linhas.map((l) => l.procedimentoCodigo),
        (codigo) => ({ company_id: companyId, name: nomePorCodigo.get(codigo) ?? codigo })
      );

      const gruposPorAtendimento = new Map<string, typeof resultado.linhas>();
      for (const l of resultado.linhas) {
        const grupo = gruposPorAtendimento.get(l.referenciaExterna) ?? [];
        grupo.push(l);
        gruposPorAtendimento.set(l.referenciaExterna, grupo);
      }
      const admissaoPorReferencia = await buscarOuCriarEmLote(
        "admissions", "external_reference", [...gruposPorAtendimento.keys()],
        (referencia) => {
          const grupo = gruposPorAtendimento.get(referencia)!;
          const primeira = grupo[0];
          const dataMinima = grupo.reduce((min, l) => (l.dataProducao < min ? l.dataProducao : min), primeira.dataProducao);
          const patientId = pacientePorNome.get(primeira.pacienteNome);
          const hospitalId = hospitalPorNome.get(primeira.hospitalNome);
          const healthInsuranceId = convenioPorNome.get(primeira.convenioNome);
          if (!patientId || !hospitalId) throw new Error(`Não foi possível resolver paciente/hospital para o atendimento ${referencia}.`);
          return {
            company_id: companyId,
            patient_id: patientId,
            hospital_id: hospitalId,
            health_insurance_id: healthInsuranceId ?? null,
            admission_date: dataMinima,
            admission_time: "08:00",
            external_reference: referencia,
            status: "internado",
          };
        }
      );

      const linhasParaInserir = resultado.linhas.map((l) => ({
        company_id: companyId,
        admission_id: admissaoPorReferencia.get(l.referenciaExterna) ?? null,
        physiotherapist_id: fisioPorNome.get(l.fisioterapeutaNome) ?? null,
        procedure_id: procedimentoPorCodigo.get(l.procedimentoCodigo) ?? null,
        production_date: l.dataProducao,
        production_time: l.dataHoraISO?.slice(11, 16) || "08:00",
        source: "tasy" as const,
        tasy_reference: `${l.referenciaExterna}-${l.procedimentoCodigo}-${l.dataHoraISO}`,
        confirmado_tasy: true,
        confirmado_em: new Date().toISOString(),
      }));

      let totalInseridos = 0;
      for (const lote of emLotes(linhasParaInserir, 500)) {
        const { data, error } = await supabase
          .from("daily_production")
          .upsert(lote, { onConflict: "company_id,tasy_reference", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error(`Falha ao gravar produção diária: ${error.message}`);
        totalInseridos += (data ?? []).length;
      }

      const resumo = resumirImportacao(resultado.linhas);
      await registrarAuditoria({ company_id: companyId, action: "importado", entity_type: "Importação Tasy (carga inicial)", entity_label: fileName });

      return { totalLinhas: resultado.linhas.length, totalInseridos, totalDuplicados: linhasParaInserir.length - totalInseridos, resumo };
    },
  },

  tasyImportRows: {
    ignorar: async (id: string): Promise<void> => {
      await atualizarLinha("tasy_import_rows", id, { status: "ignorado" });
    },
  },

  rolePermissions: {
    /** Cria ou atualiza a permissão de um papel num módulo — upsert pela chave única (empresa, papel, módulo). */
    definir: async (companyId: string, role: string, moduleSlug: string, patch: Partial<Permissao>): Promise<void> => {
      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          { company_id: companyId, role, module_slug: moduleSlug, ...patch },
          { onConflict: "company_id,role,module_slug" }
        );
      if (error) throw new Error(error.message);
    },
  },

  billingEntries: {
    create: async (
      data: Pick<BillingEntry, "admission_id" | "procedure_id" | "competencia" | "data_atendimento" | "quantidade" | "valor_repasse" | "valor_glosado" | "company_id">
    ): Promise<BillingEntry> => {
      const row = await inserirLinha<BillingEntry>("billing_entries", { ...data, origem: "manual" });
      await registrarAuditoria({ company_id: row.company_id, action: "criado", entity_type: "Faturamento", entity_label: `Repasse ${row.valor_repasse}` });
      return row;
    },
    remove: async (id: string): Promise<void> => excluirLinha("billing_entries", id),
  },

  patientQueue: {
    /**
     * Distribui uma lista de internações pra um fisioterapeuta, numa
     * data — a ordem do array vira a sequência. Reatribuir um paciente já
     * distribuído no mesmo dia substitui a distribuição anterior (upsert
     * pela chave única empresa+internação+data).
     */
    distribuir: async (
      companyId: string,
      physiotherapistId: string,
      data: string,
      admissionIds: string[],
      distribuidoPor: string | null,
      procedureId: string | null = null
    ): Promise<void> => {
      const linhas = admissionIds.map((admissionId, i) => ({
        company_id: companyId,
        admission_id: admissionId,
        physiotherapist_id: physiotherapistId,
        procedure_id: procedureId,
        data,
        sequencia: i + 1,
        status: "pendente" as const,
        distribuido_por: distribuidoPor,
      }));
      const { error } = await supabase.from("patient_queue").upsert(linhas, { onConflict: "company_id,admission_id,data" });
      if (error) throw new Error(error.message);
      await registrarAuditoria({ company_id: companyId, action: "criado", entity_type: "Distribuição de fila", entity_label: `${admissionIds.length} paciente(s)` });
    },
    concluir: async (id: string): Promise<void> => {
      await atualizarLinha("patient_queue", id, { status: "concluido" });
    },
    remover: async (id: string): Promise<void> => excluirLinha("patient_queue", id),
  },

  /**
   * Zona de risco — só o admin InovareTech usa isso, e só na tela de
   * Configurações com confirmação explícita. Apaga dados de UMA empresa
   * (nunca de todas), por categoria escolhida, numa ordem que respeita as
   * dependências entre tabelas (filhos antes dos pais) para não esbarrar
   * em restrição de chave estrangeira.
   */
  perigo: {
    async limparEmpresa(companyId: string, grupos: string[]): Promise<Record<string, number>> {
      const contagem: Record<string, number> = {};

      async function apagar(table: Parameters<typeof excluirLinhaPorEmpresa>[0]) {
        const total = await excluirLinhaPorEmpresa(table, companyId);
        contagem[table] = total;
      }

      // Ordem fixa, sempre do mais dependente pro menos dependente —
      // independe de quais grupos foram marcados, só executa quem foi.
      if (grupos.includes("auditoria")) await apagar("activity_log");
      if (grupos.includes("tasy")) {
        await apagar("tasy_import_rows");
        await apagar("tasy_imports");
      }
      if (grupos.includes("financeiro")) await apagar("receivables");
      if (grupos.includes("atendimento")) {
        await apagar("clinical_evolutions");
        await apagar("daily_production");
      }
      if (grupos.includes("internacoes")) await apagar("admissions");
      if (grupos.includes("escalas")) await apagar("shifts");
      if (grupos.includes("contratos")) {
        await apagar("contract_units");
        await apagar("contracts");
      }
      if (grupos.includes("pacientes")) {
        await apagar("patient_insurance_history");
        await apagar("patients");
      }
      if (grupos.includes("equipe")) {
        await apagar("physiotherapists");
        await apagar("teams");
      }
      if (grupos.includes("procedimentos")) await apagar("procedures");
      if (grupos.includes("convenios")) await apagar("health_insurances");
      if (grupos.includes("estrutura")) {
        await apagar("beds");
        await apagar("rooms");
        await apagar("units");
        await apagar("cost_centers");
        await apagar("hospitals");
        await apagar("clinics");
      }

      await registrarAuditoria({
        company_id: companyId,
        action: "excluido",
        entity_type: "Limpeza de base",
        entity_label: grupos.join(", "),
      });

      return contagem;
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
    registrarGlosaManual: async (id: string, valor: number, motivo: string): Promise<void> => {
      if (valor < 0) throw new Error("O valor glosado não pode ser negativo.");
      await atualizarLinha("receivables", id, { valor_glosado: valor, motivo_glosa: motivo || null });
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
