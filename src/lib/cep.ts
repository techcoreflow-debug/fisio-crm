export interface EnderecoPorCep {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Busca endereço a partir de um CEP usando a API pública ViaCEP.
 * Retorna null se o CEP for inválido, inexistente, ou se a busca falhar
 * (ex.: sem conexão) — o formulário deve permitir preenchimento manual
 * nesses casos, nunca bloquear o cadastro por causa da consulta.
 */
export async function buscarEnderecoPorCep(cepBruto: string): Promise<EnderecoPorCep | null> {
  const cep = cepBruto.replace(/\D/g, "");
  if (cep.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (dados.erro) return null;

    return {
      street: dados.logradouro ?? "",
      neighborhood: dados.bairro ?? "",
      city: dados.localidade ?? "",
      state: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}

export function formatarCep(valor: string) {
  const digits = valor.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
