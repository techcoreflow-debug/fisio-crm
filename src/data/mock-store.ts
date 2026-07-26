import { create } from "zustand";
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
 * Fonte única de dados enquanto o Supabase não está conectado.
 *
 * Os campos e nomes das entidades são idênticos às tabelas em
 * /supabase/migrations. Quando o projeto Supabase real existir, o conteúdo
 * deste arquivo deixa de ser necessário — apenas a implementação em
 * src/data/repository.ts muda (troca de leitura do Zustand por chamadas ao
 * supabase-js). Nenhum componente que consome o repository precisa mudar.
 */

const now = new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

function updateInArray<T extends { id: string }>(arr: T[], id: string, patch: Partial<T>): T[] {
  return arr.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

interface MockState {
  companies: Company[];
  hospitals: Hospital[];
  clinics: Clinic[];
  units: Unit[];
  costCenters: CostCenter[];
  teams: Team[];
  healthInsurances: HealthInsurance[];
  contracts: Contract[];
  patients: Patient[];
  physiotherapists: Physiotherapist[];
  beds: Bed[];
  rooms: Room[];
  admissions: Admission[];
  procedures: Procedure[];
  dailyProduction: DailyProduction[];
  clinicalEvolutions: ClinicalEvolution[];
  shifts: Shift[];
  tasyImports: TasyImport[];
  activityLog: ActivityLog[];
  receivables: Receivable[];

  addCompany: (data: Pick<Company, "name" | "cnpj">) => Company;
  updateCompany: (id: string, patch: Partial<Pick<Company, "name" | "cnpj">>) => void;
  removeCompany: (id: string) => void;
  addHospital: (data: Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">) => Hospital;
  updateHospital: (id: string, patch: Partial<Pick<Hospital, "name" | "cnpj" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>) => void;
  removeHospital: (id: string) => void;
  addClinic: (data: Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">) => Clinic;
  updateClinic: (id: string, patch: Partial<Pick<Clinic, "name" | "cep" | "street" | "neighborhood" | "city" | "state" | "company_id">>) => void;
  removeClinic: (id: string) => void;
  addUnit: (data: Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">) => Unit;
  updateUnit: (id: string, patch: Partial<Pick<Unit, "name" | "hospital_id" | "clinic_id" | "company_id">>) => void;
  removeUnit: (id: string) => void;
  addCostCenter: (data: Pick<CostCenter, "name" | "company_id">) => CostCenter;
  updateCostCenter: (id: string, patch: Partial<Pick<CostCenter, "name" | "company_id">>) => void;
  removeCostCenter: (id: string) => void;
  addTeam: (data: Pick<Team, "name" | "company_id">) => Team;
  updateTeam: (id: string, patch: Partial<Pick<Team, "name" | "company_id">>) => void;
  removeTeam: (id: string) => void;
  addHealthInsurance: (data: Pick<HealthInsurance, "name" | "ans_code" | "company_id">) => HealthInsurance;
  updateHealthInsurance: (id: string, patch: Partial<Pick<HealthInsurance, "name" | "ans_code" | "company_id">>) => void;
  removeHealthInsurance: (id: string) => void;
  addContract: (
    data: Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "company_id">
  ) => Contract;
  updateContract: (
    id: string,
    patch: Partial<Pick<Contract, "hospital_id" | "health_insurance_id" | "cost_center_id" | "start_date" | "end_date" | "monthly_value" | "status" | "company_id">>
  ) => void;
  removeContract: (id: string) => void;
  addPatient: (data: Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">) => Patient;
  updatePatient: (id: string, patch: Partial<Pick<Patient, "full_name" | "birth_date" | "document" | "company_id">>) => void;
  removePatient: (id: string) => void;
  addPhysiotherapist: (
    data: Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">
  ) => Physiotherapist;
  updatePhysiotherapist: (
    id: string,
    patch: Partial<Pick<Physiotherapist, "full_name" | "professional_registry" | "team_id" | "company_id">>
  ) => void;
  removePhysiotherapist: (id: string) => void;
  addBed: (data: Pick<Bed, "unit_id" | "room_id" | "code" | "status" | "company_id">) => Bed;
  updateBed: (id: string, patch: Partial<Pick<Bed, "unit_id" | "room_id" | "code" | "company_id">>) => void;
  removeBed: (id: string) => void;
  updateBedStatus: (id: string, status: string) => void;
  addRoom: (data: Pick<Room, "unit_id" | "code" | "company_id">) => Room;
  updateRoom: (id: string, patch: Partial<Pick<Room, "unit_id" | "code" | "company_id">>) => void;
  removeRoom: (id: string) => void;
  addAdmission: (
    data: Pick<Admission, "patient_id" | "hospital_id" | "unit_id" | "bed_id" | "health_insurance_id" | "admission_date" | "company_id">
  ) => Admission;
  dischargeAdmission: (id: string, dischargeDate: string) => void;
  addProcedure: (data: Pick<Procedure, "name" | "code" | "category" | "company_id">) => Procedure;
  updateProcedure: (id: string, patch: Partial<Pick<Procedure, "name" | "code" | "category" | "company_id">>) => void;
  removeProcedure: (id: string) => void;
  addDailyProduction: (
    data: Pick<DailyProduction, "admission_id" | "physiotherapist_id" | "procedure_id" | "production_date" | "source" | "company_id">
  ) => DailyProduction;
  addClinicalEvolution: (
    data: Pick<ClinicalEvolution, "admission_id" | "physiotherapist_id" | "content" | "company_id">
  ) => ClinicalEvolution;
  addShift: (data: Pick<Shift, "physiotherapist_id" | "unit_id" | "shift_date" | "period" | "company_id">) => Shift;
  removeShift: (id: string) => void;
  addTasyImport: (
    data: Pick<TasyImport, "file_name" | "total_rows" | "inconsistencies" | "company_id">
  ) => TasyImport;
  undoTasyImport: (id: string) => void;
  logActivity: (data: Pick<ActivityLog, "company_id" | "action" | "entity_type" | "entity_label">) => void;
  addReceivable: (
    data: Pick<Receivable, "company_id" | "contract_id" | "competencia" | "amount" | "due_date" | "status">
  ) => Receivable;
  markReceivablePaid: (id: string) => void;
  removeReceivable: (id: string) => void;
}

const c1 = "c1";
const c2 = "c2";
const c3 = "c3";

export const useMockStore = create<MockState>((set, get) => ({
  companies: [
    { id: c1, name: "Reab Hospitalar Ltda.", cnpj: "12.345.678/0001-90", created_at: now },
    { id: c2, name: "FisioVida Assistencial", cnpj: "23.456.789/0001-01", created_at: now },
    { id: c3, name: "Corpore Fisioterapia", cnpj: "34.567.890/0001-12", created_at: now },
  ],

  hospitals: [
    { id: "hosp-1", company_id: c1, name: "Hospital São Rafael", cnpj: "45.123.456/0001-77", cep: "40015-970", street: "Av. Sete de Setembro", neighborhood: "Centro", city: "Salvador", state: "BA", created_at: now },
    { id: "hosp-2", company_id: c3, name: "Hospital Vida Nova", cnpj: "51.987.654/0001-22", cep: "80010-000", street: "Rua XV de Novembro", neighborhood: "Centro", city: "Curitiba", state: "PR", created_at: now },
    { id: "hosp-3", company_id: c3, name: "Hospital Santa Clara", cnpj: "62.741.852/0001-05", cep: "30130-000", street: "Av. Afonso Pena", neighborhood: "Centro", city: "Belo Horizonte", state: "MG", created_at: now },
    { id: "hosp-4", company_id: c1, name: "Hospital Regional do Vale", cnpj: "78.369.147/0001-33", cep: "89201-000", street: "Rua do Príncipe", neighborhood: "Centro", city: "Joinville", state: "SC", created_at: now },
  ],

  clinics: [
    { id: "cli-1", company_id: c2, name: "FisioVida Centro", cep: "40020-000", street: "Rua Chile", neighborhood: "Centro", city: "Salvador", state: "BA", created_at: now },
    { id: "cli-2", company_id: c3, name: "Clínica Reabilita+", cep: "80020-000", street: "Rua Marechal Deodoro", neighborhood: "Centro", city: "Curitiba", state: "PR", created_at: now },
  ],

  units: [
    { id: "uni-1", company_id: c1, hospital_id: "hosp-1", clinic_id: null, name: "UTI Adulto", created_at: now },
    { id: "uni-2", company_id: c1, hospital_id: "hosp-1", clinic_id: null, name: "Enfermaria Ala Norte", created_at: now },
    { id: "uni-3", company_id: c2, hospital_id: null, clinic_id: "cli-1", name: "Reabilitação Ambulatorial", created_at: now },
  ],

  costCenters: [
    { id: "cc-1", company_id: c1, name: "Assistencial — UTI", created_at: now },
    { id: "cc-2", company_id: c1, name: "Assistencial — Enfermaria", created_at: now },
    { id: "cc-3", company_id: c1, name: "Administrativo", created_at: now },
  ],

  teams: [
    { id: "team-1", company_id: c1, name: "Equipe UTI", created_at: now },
    { id: "team-2", company_id: c1, name: "Equipe Enfermaria", created_at: now },
    { id: "team-3", company_id: c2, name: "Equipe Ambulatório", created_at: now },
  ],

  healthInsurances: [
    { id: "hi-1", company_id: c1, name: "Unimed", ans_code: "326305", created_at: now },
    { id: "hi-2", company_id: c1, name: "Bradesco Saúde", ans_code: "005711", created_at: now },
    { id: "hi-3", company_id: c3, name: "SulAmérica", ans_code: "006246", created_at: now },
    { id: "hi-4", company_id: c3, name: "Amil", ans_code: "326305", created_at: now },
  ],

  contracts: [
    { id: "ctr-1", company_id: c1, hospital_id: "hosp-1", health_insurance_id: "hi-1", cost_center_id: "cc-1", start_date: "2025-01-01", end_date: "2026-12-31", monthly_value: 186000, status: "ativo", created_at: now },
    { id: "ctr-2", company_id: c1, hospital_id: "hosp-1", health_insurance_id: "hi-2", cost_center_id: "cc-2", start_date: "2025-03-01", end_date: "2026-02-28", monthly_value: 94000, status: "ativo", created_at: now },
  ],

  patients: [
    { id: "pac-1", company_id: c1, full_name: "Marina Salgado Costa", birth_date: "1958-04-12", document: "123.456.789-00", created_at: now },
    { id: "pac-2", company_id: c1, full_name: "José Everton Lima", birth_date: "1951-09-03", document: "234.567.890-11", created_at: now },
    { id: "pac-3", company_id: c1, full_name: "Cecília Andrade Ferraz", birth_date: "1973-01-22", document: "345.678.901-22", created_at: now },
  ],

  physiotherapists: [
    { id: "ft-1", company_id: c1, user_id: null, team_id: "team-1", full_name: "Ana Beatriz Correia", professional_registry: "CREFITO-3/98765-F", created_at: now },
    { id: "ft-2", company_id: c1, user_id: null, team_id: "team-2", full_name: "Diego Martins Ferreira", professional_registry: "CREFITO-3/87231-F", created_at: now },
  ],

  rooms: [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `quarto-uti-${i + 1}`,
      company_id: c1,
      unit_id: "uni-1",
      code: `Box ${i + 1}`,
      created_at: now,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `quarto-an-${i + 1}`,
      company_id: c1,
      unit_id: "uni-2",
      code: `Quarto ${201 + i}`,
      created_at: now,
    })),
  ],

  beds: [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `leito-uti-${i + 1}`,
      company_id: c1,
      unit_id: "uni-1",
      room_id: `quarto-uti-${i + 1}`,
      code: `UTI-${String(i + 1).padStart(2, "0")}`,
      status: [2, 5, 8].includes(i) ? "livre" : i === 3 ? "higienizacao" : "ocupado",
      created_at: now,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `leito-an-${i + 1}`,
      company_id: c1,
      unit_id: "uni-2",
      room_id: `quarto-an-${Math.floor(i / 2) + 1}`,
      code: `AN-${String(i + 1).padStart(2, "0")}`,
      status: [1, 2, 5].includes(i) ? "livre" : i === 4 ? "higienizacao" : "ocupado",
      created_at: now,
    })),
  ],

  admissions: [
    { id: "int-1", company_id: c1, patient_id: "pac-1", hospital_id: "hosp-1", unit_id: "uni-1", bed_id: "leito-uti-12", health_insurance_id: "hi-1", admission_date: "2026-07-18", discharge_date: null, status: "internado", created_at: now },
    { id: "int-2", company_id: c1, patient_id: "pac-3", hospital_id: "hosp-1", unit_id: "uni-2", bed_id: "leito-an-4", health_insurance_id: "hi-3", admission_date: "2026-07-20", discharge_date: null, status: "internado", created_at: now },
    { id: "int-3", company_id: c1, patient_id: "pac-2", hospital_id: "hosp-1", unit_id: "uni-2", bed_id: null, health_insurance_id: "hi-2", admission_date: "2026-07-10", discharge_date: "2026-07-15", status: "alta", created_at: now },
  ],

  procedures: [
    { id: "proc-1", company_id: c1, name: "Fisioterapia respiratória", code: "20101015", category: "Respiratória", created_at: now },
    { id: "proc-2", company_id: c1, name: "Cinesioterapia motora", code: "20101023", category: "Motora", created_at: now },
    { id: "proc-3", company_id: c1, name: "Mobilização precoce em UTI", code: "20101031", category: "Motora", created_at: now },
    { id: "proc-4", company_id: c1, name: "Drenagem postural", code: "20101040", category: "Respiratória", created_at: now },
    { id: "proc-5", company_id: c1, name: "Reeducação de marcha", code: "20101058", category: "Motora", created_at: now },
  ],

  dailyProduction: [
    { id: "prod-1", company_id: c1, admission_id: "int-1", physiotherapist_id: "ft-1", procedure_id: "proc-1", production_date: "2026-07-24", source: "tasy", created_at: now },
    { id: "prod-2", company_id: c1, admission_id: "int-2", physiotherapist_id: "ft-2", procedure_id: "proc-2", production_date: "2026-07-24", source: "manual", created_at: now },
    { id: "prod-3", company_id: c1, admission_id: "int-1", physiotherapist_id: "ft-1", procedure_id: "proc-3", production_date: "2026-07-23", source: "tasy", created_at: now },
  ],

  clinicalEvolutions: [
    {
      id: "evo-1",
      company_id: c1,
      admission_id: "int-1",
      physiotherapist_id: "ft-1",
      content:
        "Paciente apresentou melhora do padrão respiratório após sessão de fisioterapia respiratória. Mantida assistência ventilatória não invasiva, tolerando bem o decúbito elevado.",
      created_at: now,
    },
    {
      id: "evo-2",
      company_id: c1,
      admission_id: "int-2",
      physiotherapist_id: "ft-2",
      content:
        "Iniciada cinesioterapia motora ativo-assistida em membros inferiores. Paciente colaborativa, sem intercorrências durante o atendimento.",
      created_at: now,
    },
  ],

  shifts: [
    { id: "turno-1", company_id: c1, physiotherapist_id: "ft-1", unit_id: "uni-1", shift_date: "2026-07-24", period: "manha", created_at: now },
    { id: "turno-2", company_id: c1, physiotherapist_id: "ft-2", unit_id: "uni-2", shift_date: "2026-07-24", period: "tarde", created_at: now },
  ],

  tasyImports: [
    { id: "imp-1", company_id: c1, file_name: "tasy_producao_2026-07-23.csv", imported_by: null, total_rows: 486, inconsistencies: 3, status: "concluida", created_at: "2026-07-23T08:14:00.000Z", undone_at: null },
    { id: "imp-2", company_id: c1, file_name: "tasy_producao_2026-07-22.csv", imported_by: null, total_rows: 512, inconsistencies: 0, status: "concluida", created_at: "2026-07-22T08:02:00.000Z", undone_at: null },
  ],

  activityLog: [],

  receivables: [
    { id: "rec-1", company_id: c1, contract_id: "ctr-1", competencia: "2026-02-01", amount: 186000, due_date: "2026-02-10", status: "pago", paid_at: "2026-02-09T00:00:00.000Z", created_at: now },
    { id: "rec-2", company_id: c1, contract_id: "ctr-2", competencia: "2026-02-01", amount: 94000, due_date: "2026-02-10", status: "pago", paid_at: "2026-02-08T00:00:00.000Z", created_at: now },
    { id: "rec-3", company_id: c1, contract_id: "ctr-1", competencia: "2026-03-01", amount: 186000, due_date: "2026-03-10", status: "pago", paid_at: "2026-03-11T00:00:00.000Z", created_at: now },
    { id: "rec-4", company_id: c1, contract_id: "ctr-2", competencia: "2026-03-01", amount: 94000, due_date: "2026-03-10", status: "atrasado", paid_at: null, created_at: now },
    { id: "rec-5", company_id: c1, contract_id: "ctr-1", competencia: "2026-04-01", amount: 186000, due_date: "2026-04-10", status: "pago", paid_at: "2026-04-10T00:00:00.000Z", created_at: now },
    { id: "rec-6", company_id: c1, contract_id: "ctr-2", competencia: "2026-04-01", amount: 94000, due_date: "2026-04-10", status: "pago", paid_at: "2026-04-09T00:00:00.000Z", created_at: now },
    { id: "rec-7", company_id: c1, contract_id: "ctr-1", competencia: "2026-05-01", amount: 186000, due_date: "2026-05-10", status: "atrasado", paid_at: null, created_at: now },
    { id: "rec-8", company_id: c1, contract_id: "ctr-2", competencia: "2026-05-01", amount: 94000, due_date: "2026-05-10", status: "pago", paid_at: "2026-05-12T00:00:00.000Z", created_at: now },
    { id: "rec-9", company_id: c1, contract_id: "ctr-1", competencia: "2026-06-01", amount: 186000, due_date: "2026-06-10", status: "pago", paid_at: "2026-06-10T00:00:00.000Z", created_at: now },
    { id: "rec-10", company_id: c1, contract_id: "ctr-2", competencia: "2026-06-01", amount: 94000, due_date: "2026-06-10", status: "pago", paid_at: "2026-06-09T00:00:00.000Z", created_at: now },
    { id: "rec-11", company_id: c1, contract_id: "ctr-1", competencia: "2026-07-01", amount: 186000, due_date: "2026-07-10", status: "pendente", paid_at: null, created_at: now },
    { id: "rec-12", company_id: c1, contract_id: "ctr-2", competencia: "2026-07-01", amount: 94000, due_date: "2026-07-10", status: "pendente", paid_at: null, created_at: now },
  ],

  addCompany: (data) => {
    const row: Company = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ companies: [row, ...get().companies] });
    return row;
  },
  removeCompany: (id) => {
    const bloqueios: string[] = [];
    const hospitaisVinculados = get().hospitals.filter((h) => h.company_id === id).length;
    const clinicasVinculadas = get().clinics.filter((c) => c.company_id === id).length;
    const pacientesVinculados = get().patients.filter((p) => p.company_id === id).length;
    if (hospitaisVinculados > 0) bloqueios.push(`${hospitaisVinculados} hospital(is)`);
    if (clinicasVinculadas > 0) bloqueios.push(`${clinicasVinculadas} clínica(s)`);
    if (pacientesVinculados > 0) bloqueios.push(`${pacientesVinculados} paciente(s)`);
    if (bloqueios.length > 0) {
      throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a esta empresa.`);
    }
    set({ companies: get().companies.filter((c) => c.id !== id) });
  },
  updateCompany: (id, patch) => set({ companies: updateInArray<Company>(get().companies, id, patch) }),
  addHospital: (data) => {
    const row: Hospital = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ hospitals: [row, ...get().hospitals] });
    get().logActivity({ company_id: row.company_id, action: "criado", entity_type: "Hospital", entity_label: row.name });
    return row;
  },
  removeHospital: (id) => {
    const unidadesVinculadas = get().units.filter((u) => u.hospital_id === id).length;
    const contratosVinculados = get().contracts.filter((c) => c.hospital_id === id).length;
    const internacoesVinculadas = get().admissions.filter((a) => a.hospital_id === id).length;
    const bloqueios: string[] = [];
    if (unidadesVinculadas > 0) bloqueios.push(`${unidadesVinculadas} ala(s)/unidade(s)`);
    if (contratosVinculados > 0) bloqueios.push(`${contratosVinculados} contrato(s)`);
    if (internacoesVinculadas > 0) bloqueios.push(`${internacoesVinculadas} internação(ões)`);
    if (bloqueios.length > 0) {
      throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a este hospital.`);
    }
    const hospital = get().hospitals.find((h) => h.id === id);
    set({ hospitals: get().hospitals.filter((h) => h.id !== id) });
    if (hospital) get().logActivity({ company_id: hospital.company_id, action: "excluido", entity_type: "Hospital", entity_label: hospital.name });
  },
  updateHospital: (id, patch) => set({ hospitals: updateInArray<Hospital>(get().hospitals, id, patch) }),
  addClinic: (data) => {
    const row: Clinic = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ clinics: [row, ...get().clinics] });
    return row;
  },
  removeClinic: (id) => {
    const unidadesVinculadas = get().units.filter((u) => u.clinic_id === id).length;
    if (unidadesVinculadas > 0) {
      throw new Error(`Não é possível excluir: existem ${unidadesVinculadas} unidade(s) vinculadas a esta clínica.`);
    }
    const clinica = get().clinics.find((c) => c.id === id);
    set({ clinics: get().clinics.filter((c) => c.id !== id) });
    if (clinica) get().logActivity({ company_id: clinica.company_id, action: "excluido", entity_type: "Clínica", entity_label: clinica.name });
  },
  updateClinic: (id, patch) => set({ clinics: updateInArray<Clinic>(get().clinics, id, patch) }),
  addUnit: (data) => {
    const row: Unit = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ units: [row, ...get().units] });
    return row;
  },
  removeUnit: (id) => {
    const quartosVinculados = get().rooms.filter((r) => r.unit_id === id).length;
    const leitosVinculados = get().beds.filter((b) => b.unit_id === id).length;
    const internacoesVinculadas = get().admissions.filter((a) => a.unit_id === id).length;
    const turnosVinculados = get().shifts.filter((s) => s.unit_id === id).length;
    const bloqueios: string[] = [];
    if (quartosVinculados > 0) bloqueios.push(`${quartosVinculados} quarto(s)`);
    if (leitosVinculados > 0) bloqueios.push(`${leitosVinculados} leito(s)`);
    if (internacoesVinculadas > 0) bloqueios.push(`${internacoesVinculadas} internação(ões)`);
    if (turnosVinculados > 0) bloqueios.push(`${turnosVinculados} turno(s) de escala`);
    if (bloqueios.length > 0) {
      throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a esta ala/unidade.`);
    }
    const unidade = get().units.find((u) => u.id === id);
    set({ units: get().units.filter((u) => u.id !== id) });
    if (unidade) get().logActivity({ company_id: unidade.company_id, action: "excluido", entity_type: "Unidade", entity_label: unidade.name });
  },
  updateUnit: (id, patch) => set({ units: updateInArray<Unit>(get().units, id, patch) }),
  addCostCenter: (data) => {
    const row: CostCenter = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ costCenters: [row, ...get().costCenters] });
    return row;
  },
  removeCostCenter: (id) => {
    const contratosVinculados = get().contracts.filter((c) => c.cost_center_id === id).length;
    if (contratosVinculados > 0) {
      throw new Error(`Não é possível excluir: existem ${contratosVinculados} contrato(s) vinculados a este centro de custo.`);
    }
    const centro = get().costCenters.find((c) => c.id === id);
    set({ costCenters: get().costCenters.filter((c) => c.id !== id) });
    if (centro) get().logActivity({ company_id: centro.company_id, action: "excluido", entity_type: "Centro de custo", entity_label: centro.name });
  },
  updateCostCenter: (id, patch) => set({ costCenters: updateInArray<CostCenter>(get().costCenters, id, patch) }),
  addTeam: (data) => {
    const row: Team = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ teams: [row, ...get().teams] });
    return row;
  },
  removeTeam: (id) => {
    const fisiosVinculados = get().physiotherapists.filter((f) => f.team_id === id).length;
    if (fisiosVinculados > 0) {
      throw new Error(`Não é possível excluir: existem ${fisiosVinculados} fisioterapeuta(s) vinculados a esta equipe.`);
    }
    const equipe = get().teams.find((t) => t.id === id);
    set({ teams: get().teams.filter((t) => t.id !== id) });
    if (equipe) get().logActivity({ company_id: equipe.company_id, action: "excluido", entity_type: "Equipe", entity_label: equipe.name });
  },
  updateTeam: (id, patch) => set({ teams: updateInArray<Team>(get().teams, id, patch) }),
  addHealthInsurance: (data) => {
    const row: HealthInsurance = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ healthInsurances: [row, ...get().healthInsurances] });
    return row;
  },
  removeHealthInsurance: (id) => {
    const contratosVinculados = get().contracts.filter((c) => c.health_insurance_id === id).length;
    const internacoesVinculadas = get().admissions.filter((a) => a.health_insurance_id === id).length;
    const bloqueios: string[] = [];
    if (contratosVinculados > 0) bloqueios.push(`${contratosVinculados} contrato(s)`);
    if (internacoesVinculadas > 0) bloqueios.push(`${internacoesVinculadas} internação(ões)`);
    if (bloqueios.length > 0) {
      throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a este convênio.`);
    }
    const convenio = get().healthInsurances.find((h) => h.id === id);
    set({ healthInsurances: get().healthInsurances.filter((h) => h.id !== id) });
    if (convenio) get().logActivity({ company_id: convenio.company_id, action: "excluido", entity_type: "Convênio", entity_label: convenio.name });
  },
  updateHealthInsurance: (id, patch) => set({ healthInsurances: updateInArray<HealthInsurance>(get().healthInsurances, id, patch) }),
  addContract: (data) => {
    const row: Contract = { id: uid(), created_at: new Date().toISOString(), status: "ativo", ...data };
    set({ contracts: [row, ...get().contracts] });
    get().logActivity({ company_id: row.company_id, action: "criado", entity_type: "Contrato", entity_label: `Contrato ${row.id.slice(0, 8)}` });
    return row;
  },
  removeContract: (id) => {
    const contrato = get().contracts.find((c) => c.id === id);
    set({ contracts: get().contracts.filter((c) => c.id !== id) });
    if (contrato) get().logActivity({ company_id: contrato.company_id, action: "excluido", entity_type: "Contrato", entity_label: `Contrato ${contrato.id.slice(0, 8)}` });
  },
  updateContract: (id, patch) => {
    const atual = get().contracts.find((c) => c.id === id);
    set({ contracts: updateInArray<Contract>(get().contracts, id, patch) });
    if (atual) get().logActivity({ company_id: atual.company_id, action: "editado", entity_type: "Contrato", entity_label: `Contrato ${atual.id.slice(0, 8)}` });
  },
  addPatient: (data) => {
    const row: Patient = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ patients: [row, ...get().patients] });
    get().logActivity({ company_id: row.company_id, action: "criado", entity_type: "Paciente", entity_label: row.full_name });
    return row;
  },
  removePatient: (id) => {
    const internacoesVinculadas = get().admissions.filter((a) => a.patient_id === id).length;
    if (internacoesVinculadas > 0) {
      throw new Error(`Não é possível excluir: este paciente tem ${internacoesVinculadas} internação(ões) registrada(s).`);
    }
    const patient = get().patients.find((p) => p.id === id);
    set({ patients: get().patients.filter((p) => p.id !== id) });
    if (patient) get().logActivity({ company_id: patient.company_id, action: "excluido", entity_type: "Paciente", entity_label: patient.full_name });
  },
  updatePatient: (id, patch) => set({ patients: updateInArray<Patient>(get().patients, id, patch) }),
  addPhysiotherapist: (data) => {
    const row: Physiotherapist = { id: uid(), created_at: new Date().toISOString(), user_id: null, ...data };
    set({ physiotherapists: [row, ...get().physiotherapists] });
    get().logActivity({ company_id: row.company_id, action: "criado", entity_type: "Fisioterapeuta", entity_label: row.full_name });
    return row;
  },
  removePhysiotherapist: (id) => {
    const producaoVinculada = get().dailyProduction.filter((p) => p.physiotherapist_id === id).length;
    const evolucoesVinculadas = get().clinicalEvolutions.filter((e) => e.physiotherapist_id === id).length;
    const turnosVinculados = get().shifts.filter((s) => s.physiotherapist_id === id).length;
    const bloqueios: string[] = [];
    if (producaoVinculada > 0) bloqueios.push(`${producaoVinculada} lançamento(s) de produção`);
    if (evolucoesVinculadas > 0) bloqueios.push(`${evolucoesVinculadas} evolução(ões) clínica(s)`);
    if (turnosVinculados > 0) bloqueios.push(`${turnosVinculados} turno(s) de escala`);
    if (bloqueios.length > 0) {
      throw new Error(`Não é possível excluir: existem ${bloqueios.join(", ")} vinculados a este fisioterapeuta.`);
    }
    const fisio = get().physiotherapists.find((f) => f.id === id);
    set({ physiotherapists: get().physiotherapists.filter((f) => f.id !== id) });
    if (fisio) get().logActivity({ company_id: fisio.company_id, action: "excluido", entity_type: "Fisioterapeuta", entity_label: fisio.full_name });
  },
  updatePhysiotherapist: (id, patch) => {
    const atual = get().physiotherapists.find((f) => f.id === id);
    set({ physiotherapists: updateInArray<Physiotherapist>(get().physiotherapists, id, patch) });
    if (atual) get().logActivity({ company_id: atual.company_id, action: "editado", entity_type: "Fisioterapeuta", entity_label: atual.full_name });
  },
  addBed: (data) => {
    const row: Bed = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ beds: [row, ...get().beds] });
    return row;
  },
  updateBed: (id, patch) => set({ beds: updateInArray<Bed>(get().beds, id, patch) }),
  removeBed: (id) => {
    const internacaoAtiva = get().admissions.some((a) => a.bed_id === id && a.status === "internado");
    if (internacaoAtiva) {
      throw new Error("Não é possível excluir: este leito está ocupado por uma internação ativa. Dê alta antes de excluir.");
    }
    const leito = get().beds.find((b) => b.id === id);
    set({ beds: get().beds.filter((b) => b.id !== id) });
    if (leito) get().logActivity({ company_id: leito.company_id, action: "excluido", entity_type: "Leito", entity_label: leito.code });
  },
  updateBedStatus: (id, status) => {
    set({ beds: get().beds.map((b) => (b.id === id ? { ...b, status } : b)) });
  },
  addRoom: (data) => {
    const row: Room = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ rooms: [row, ...get().rooms] });
    return row;
  },
  updateRoom: (id, patch) => set({ rooms: updateInArray<Room>(get().rooms, id, patch) }),
  removeRoom: (id) => {
    const leitosVinculados = get().beds.filter((b) => b.room_id === id).length;
    if (leitosVinculados > 0) {
      throw new Error(`Não é possível excluir: existem ${leitosVinculados} leito(s) vinculados a este quarto.`);
    }
    const quarto = get().rooms.find((r) => r.id === id);
    set({ rooms: get().rooms.filter((r) => r.id !== id) });
    if (quarto) get().logActivity({ company_id: quarto.company_id, action: "excluido", entity_type: "Quarto", entity_label: quarto.code });
  },
  addAdmission: (data) => {
    const row: Admission = { id: uid(), created_at: new Date().toISOString(), discharge_date: null, status: "internado", ...data };
    set({ admissions: [row, ...get().admissions] });
    if (row.bed_id) get().updateBedStatus(row.bed_id, "ocupado");
    return row;
  },
  dischargeAdmission: (id, dischargeDate) => {
    const admission = get().admissions.find((a) => a.id === id);
    if (!admission) {
      throw new Error("Internação não encontrada.");
    }
    if (admission.status === "alta") {
      throw new Error("Esta internação já teve alta registrada.");
    }
    set({
      admissions: get().admissions.map((a) => (a.id === id ? { ...a, status: "alta", discharge_date: dischargeDate } : a)),
    });
    if (admission.bed_id) get().updateBedStatus(admission.bed_id, "higienizacao");
    const paciente = get().patients.find((p) => p.id === admission.patient_id);
    get().logActivity({
      company_id: admission.company_id,
      action: "alta",
      entity_type: "Internação",
      entity_label: paciente?.full_name ?? `Internação ${admission.id.slice(0, 8)}`,
    });
  },
  addProcedure: (data) => {
    const row: Procedure = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ procedures: [row, ...get().procedures] });
    return row;
  },
  removeProcedure: (id) => {
    const producaoVinculada = get().dailyProduction.filter((p) => p.procedure_id === id).length;
    if (producaoVinculada > 0) {
      throw new Error(`Não é possível excluir: existem ${producaoVinculada} lançamento(s) de produção usando este procedimento.`);
    }
    const procedimento = get().procedures.find((p) => p.id === id);
    set({ procedures: get().procedures.filter((p) => p.id !== id) });
    if (procedimento) get().logActivity({ company_id: procedimento.company_id, action: "excluido", entity_type: "Procedimento", entity_label: procedimento.name });
  },
  updateProcedure: (id, patch) => set({ procedures: updateInArray<Procedure>(get().procedures, id, patch) }),
  addDailyProduction: (data) => {
    const row: DailyProduction = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ dailyProduction: [row, ...get().dailyProduction] });
    return row;
  },
  addClinicalEvolution: (data) => {
    if (data.content.trim().length < 10) {
      throw new Error("A evolução precisa ter pelo menos 10 caracteres.");
    }
    const row: ClinicalEvolution = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ clinicalEvolutions: [row, ...get().clinicalEvolutions] });
    return row;
  },
  addShift: (data) => {
    const duplicado = get().shifts.some(
      (s) => s.physiotherapist_id === data.physiotherapist_id && s.shift_date === data.shift_date && s.period === data.period
    );
    if (duplicado) {
      throw new Error("Este fisioterapeuta já tem um turno cadastrado nesta data e período.");
    }
    const row: Shift = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ shifts: [row, ...get().shifts] });
    return row;
  },
  removeShift: (id) => set({ shifts: get().shifts.filter((s) => s.id !== id) }),
  addTasyImport: (data) => {
    const row: TasyImport = { id: uid(), created_at: new Date().toISOString(), imported_by: null, status: "concluida", undone_at: null, ...data };
    set({ tasyImports: [row, ...get().tasyImports] });
    get().logActivity({ company_id: row.company_id, action: "importado", entity_type: "Importação Tasy", entity_label: row.file_name });
    return row;
  },
  undoTasyImport: (id) => {
    const importacao = get().tasyImports.find((t) => t.id === id);
    if (!importacao) {
      throw new Error("Importação não encontrada.");
    }
    if (importacao.status === "desfeita") {
      throw new Error("Esta importação já foi desfeita.");
    }
    set({
      tasyImports: get().tasyImports.map((t) =>
        t.id === id ? { ...t, status: "desfeita", undone_at: new Date().toISOString() } : t
      ),
    });
    get().logActivity({ company_id: importacao.company_id, action: "desfeito", entity_type: "Importação Tasy", entity_label: importacao.file_name });
  },
  logActivity: (data) => {
    const row: ActivityLog = { id: uid(), created_at: new Date().toISOString(), ...data };
    set({ activityLog: [row, ...get().activityLog] });
  },
  addReceivable: (data) => {
    const duplicado = get().receivables.some((r) => r.contract_id === data.contract_id && r.competencia === data.competencia);
    if (duplicado) {
      throw new Error("Já existe um lançamento para este contrato nesta competência.");
    }
    const row: Receivable = { id: uid(), created_at: new Date().toISOString(), paid_at: null, ...data };
    set({ receivables: [row, ...get().receivables] });
    return row;
  },
  markReceivablePaid: (id) => {
    const recebivel = get().receivables.find((r) => r.id === id);
    if (!recebivel) {
      throw new Error("Lançamento não encontrado.");
    }
    if (recebivel.status === "pago") {
      throw new Error("Este lançamento já está marcado como pago.");
    }
    set({
      receivables: get().receivables.map((r) =>
        r.id === id ? { ...r, status: "pago", paid_at: new Date().toISOString() } : r
      ),
    });
  },
  removeReceivable: (id) => set({ receivables: get().receivables.filter((r) => r.id !== id) }),
}));
