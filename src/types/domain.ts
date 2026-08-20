/**
 * Tipos de domínio — cada interface espelha exatamente uma tabela definida em
 * /supabase/migrations. Nomes de campo em snake_case de propósito: quando o
 * projeto Supabase for conectado, as linhas retornadas pelo supabase-js batem
 * 1:1 com estes tipos, sem camada de tradução e sem risco de quebra na troca
 * do mock pelo Supabase real (ver src/data/repository.ts).
 */

export type UserRole = "admin" | "gestor" | "financeiro" | "fisioterapeuta" | "auditor" | "supervisor";

export interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_platform_admin: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  sem_evolucao_48h: boolean;
  tasy_inconsistencias: boolean;
  contratos_vencendo: boolean;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  notification_preferences: NotificationPreferences;
  glosa_por_procedimento: boolean;
  created_at: string;
}

export interface Hospital {
  id: string;
  company_id: string;
  name: string;
  cnpj: string | null;
  cep: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

export interface Clinic {
  id: string;
  company_id: string;
  name: string;
  cep: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  company_id: string;
  hospital_id: string | null;
  clinic_id: string | null;
  name: string;
  created_at: string;
}

export interface CostCenter {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface Team {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface HealthInsurance {
  id: string;
  company_id: string;
  name: string;
  ans_code: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  company_id: string;
  hospital_id: string | null;
  health_insurance_id: string | null;
  cost_center_id: string | null;
  start_date: string;
  end_date: string | null;
  monthly_value: number | null;
  status: string;
  aplica_todas_unidades: boolean;
  created_at: string;
}

export interface ContractUnit {
  id: string;
  company_id: string;
  contract_id: string;
  unit_id: string;
}

export interface Physiotherapist {
  id: string;
  company_id: string;
  user_id: string | null;
  team_id: string | null;
  full_name: string;
  professional_registry: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  company_id: string;
  full_name: string;
  birth_date: string | null;
  document: string | null;
  sexo: "M" | "F" | null;
  health_insurance_id: string | null;
  created_at: string;
}

export interface PatientInsuranceHistory {
  id: string;
  company_id: string;
  patient_id: string;
  health_insurance_id: string | null;
  changed_at: string;
}

export interface Room {
  id: string;
  company_id: string;
  unit_id: string;
  code: string;
  created_at: string;
}

export interface Bed {
  id: string;
  company_id: string;
  unit_id: string;
  room_id: string | null;
  code: string;
  status: string;
  higienizacao_desde: string | null;
  created_at: string;
}

export interface Admission {
  id: string;
  company_id: string;
  patient_id: string;
  hospital_id: string | null;
  unit_id: string | null;
  bed_id: string | null;
  health_insurance_id: string | null;
  admission_date: string;
  admission_time: string;
  discharge_date: string | null;
  discharge_at: string | null;
  admission_number: number;
  confirmou_sem_atendimento_alta: boolean;
  status: string;
  external_reference: string | null;
  diagnostico: string | null;
  pre_lancamento_motora_id: string | null;
  pre_lancamento_respiratoria_id: string | null;
  transferred_at: string | null;
  transfer_destino: string | null;
  created_at: string;
}

export interface Procedure {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  category: string | null;
  created_at: string;
}

export interface DailyProduction {
  id: string;
  company_id: string;
  admission_id: string | null;
  physiotherapist_id: string | null;
  procedure_id: string | null;
  production_date: string;
  production_time: string;
  source: "manual" | "tasy";
  tasy_reference: string | null;
  glosado: boolean;
  valor_glosado: number | null;
  motivo_glosa: string | null;
  data_glosa: string | null;
  confirmado_tasy: boolean;
  confirmado_em: string | null;
  created_at: string;
}

export interface ClinicalEvolution {
  id: string;
  company_id: string;
  admission_id: string;
  physiotherapist_id: string | null;
  content: string;
  created_at: string;
}

export type ShiftPeriod = "manha" | "tarde" | "noite";

export interface Shift {
  id: string;
  company_id: string;
  physiotherapist_id: string;
  unit_id: string | null;
  shift_date: string;
  period: ShiftPeriod;
  created_at: string;
}

export type ReceivableStatus = "pendente" | "pago" | "atrasado";

export interface Receivable {
  id: string;
  company_id: string;
  contract_id: string;
  competencia: string;
  amount: number;
  due_date: string;
  status: ReceivableStatus;
  paid_at: string | null;
  valor_glosado: number;
  motivo_glosa: string | null;
  created_at: string;
}

export type ActivityAction = "criado" | "editado" | "excluido" | "alta" | "importado" | "desfeito" | "transferencia" | "retorno_transferencia";

export interface ActivityLog {
  id: string;
  company_id: string;
  action: ActivityAction;
  entity_type: string;
  entity_label: string;
  created_at: string;
}

export interface TasyImport {
  id: string;
  company_id: string;
  file_name: string;
  imported_by: string | null;
  total_rows: number;
  inconsistencies: number;
  status: "processando" | "concluida" | "desfeita" | "erro";
  created_at: string;
  undone_at: string | null;
}

export interface TasyImportRow {
  id: string;
  import_id: string;
  company_id: string;
  raw_data: {
    hospital: string;
    convenio: string;
    fisioterapeuta: string;
    paciente: string;
    procedimentoCodigo: string;
    procedimentoNome: string;
    data: string;
    referenciaExterna: string;
  };
  matched_daily_production_id: string | null;
  status: "confirmado" | "pendente" | "ignorado";
  error_message: string | null;
  created_at: string;
}

export interface RolePermission {
  id: string;
  company_id: string;
  role: UserRole;
  module_slug: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface BillingEntry {
  id: string;
  company_id: string;
  admission_id: string;
  procedure_id: string | null;
  competencia: string;
  data_atendimento: string;
  quantidade: number;
  valor_repasse: number;
  valor_glosado: number;
  origem: "manual" | "importado";
  created_at: string;
}

export interface ProcedureCategory {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface HospitalCensus {
  id: string;
  company_id: string;
  hospital_id: string;
  census_date: string;
  total_internados: number;
  created_at: string;
  updated_at: string;
}

export interface PatientQueueItem {
  id: string;
  company_id: string;
  admission_id: string;
  physiotherapist_id: string;
  procedure_id: string | null;
  data: string;
  sequencia: number;
  status: "pendente" | "concluido";
  distribuido_por: string | null;
  created_at: string;
}
