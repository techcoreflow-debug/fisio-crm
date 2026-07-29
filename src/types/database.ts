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
  Physiotherapist,
  Patient,
  PatientInsuranceHistory,
  Bed,
  Room,
  Admission,
  Procedure,
  DailyProduction,
  ClinicalEvolution,
  TasyImport,
  Shift,
  ActivityLog,
  Receivable,
} from "@/types/domain";

/**
 * Tipos do banco de dados do Fisio — espelham as migrations 0001 a 0009,
 * já aplicadas no projeto Supabase real (oxmeoutaybantkxvtiim).
 *
 * `Row` reaproveita os tipos de `src/types/domain.ts` (mesmo nome de campo,
 * snake_case, 1:1 com as colunas). `Insert`/`Update` ficam como `Partial`
 * pragmático: a camada de repositório já tipa os campos obrigatórios de
 * cada operação via `Pick<...>` nas assinaturas de `create`/`update`, então
 * não há necessidade de duplicar essa validação aqui.
 *
 * Se um dia for gerar os tipos oficiais via CLI
 * (`supabase gen types typescript --project-id oxmeoutaybantkxvtiim`),
 * é só substituir este arquivo — nada mais no projeto depende do formato
 * exato aqui, só dos tipos de `domain.ts`.
 */

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
};

export interface Database {
  public: {
    Tables: {
      companies: TableDef<Company>;
      profiles: TableDef<Profile>;
      hospitals: TableDef<Hospital>;
      clinics: TableDef<Clinic>;
      units: TableDef<Unit>;
      cost_centers: TableDef<CostCenter>;
      teams: TableDef<Team>;
      health_insurances: TableDef<HealthInsurance>;
      contracts: TableDef<Contract>;
      contract_units: TableDef<ContractUnit>;
      physiotherapists: TableDef<Physiotherapist>;
      patients: TableDef<Patient>;
      patient_insurance_history: TableDef<PatientInsuranceHistory>;
      beds: TableDef<Bed>;
      rooms: TableDef<Room>;
      admissions: TableDef<Admission>;
      procedures: TableDef<Procedure>;
      daily_production: TableDef<DailyProduction>;
      clinical_evolutions: TableDef<ClinicalEvolution>;
      tasy_imports: TableDef<TasyImport>;
      shifts: TableDef<Shift>;
      activity_log: TableDef<ActivityLog>;
      receivables: TableDef<Receivable>;
    };
  };
}
