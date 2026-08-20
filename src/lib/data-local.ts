/**
 * "Hoje" sempre no fuso LOCAL do navegador — nunca `toISOString()` pra
 * isso. `toISOString()` converte pra UTC antes de formatar; no Brasil
 * (UTC-3), entre 21h e meia-noite no horário local, isso calcula o dia
 * SEGUINTE por engano (ex.: 22h de 02/08 vira "2026-08-03" em UTC).
 * Bug real que já causou fila de distribuição não aparecendo pro
 * fisioterapeuta no dia certo — daqui pra frente, usar só isto.
 */
export function hojeLocalIso(): string {
  return dataParaIsoLocal(new Date());
}

export function dataParaIsoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function horaLocalHHMM(data: Date = new Date()): string {
  return data.toTimeString().slice(0, 5);
}

/** Idade em anos completos, a partir da data de nascimento (YYYY-MM-DD). */
export function calcularIdade(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const hoje = new Date();
  const nasc = new Date(nascimento);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

/**
 * Dias de internação — da data de entrada até hoje (se ainda internado)
 * ou até a alta (se já teve alta). Sempre conta pelo menos 1 dia.
 */
export function calcularDiasInternacao(admissionDate: string, dischargeDate: string | null): number {
  const inicio = new Date(`${admissionDate}T00:00:00`);
  const fim = dischargeDate ? new Date(`${dischargeDate}T00:00:00`) : new Date(`${hojeLocalIso()}T00:00:00`);
  const diffMs = fim.getTime() - inicio.getTime();
  return Math.max(1, Math.round(diffMs / 86400000) + 1);
}
