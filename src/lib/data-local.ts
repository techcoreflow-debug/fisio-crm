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
