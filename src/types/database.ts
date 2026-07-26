/**
 * Tipos do banco de dados do Fisio.
 *
 * Este arquivo é um placeholder manual até o projeto Supabase real do Fisio
 * ser criado. Depois de aplicar as migrations em /supabase/migrations, gere
 * os tipos definitivos com:
 *
 *   npx supabase gen types typescript --project-id <ID_DO_PROJETO> > src/types/database.ts
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
  };
};
