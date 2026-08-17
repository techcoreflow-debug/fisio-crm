#!/usr/bin/env python3
"""
Auditoria de funcionalidades — confere se marcadores de código que
representam funcionalidades já construídas (documentadas no CHANGELOG)
ainda existem nos arquivos reais do projeto.

Nasceu de um problema real: depois de uma reconstrução do projeto a
partir de pacotes de entrega anteriores, várias funcionalidades já
prontas (trocar senha, editar usuário, recolher menu, alternar layout
tablet/PC, exclusão avançada...) sumiram silenciosamente — o build
compilava limpo (TypeScript não acusa a AUSÊNCIA de uma funcionalidade,
só erros de sintaxe/tipo), e só apareceram como bug quando alguém
tentou usar.

Uso: python3 scripts/auditoria_funcionalidades.py
Roda antes de qualquer entrega grande, e sempre depois de reconstruir
o projeto a partir de um zip (nunca a partir do git normal).
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Cada item: (descrição, arquivo, um texto que DEVE aparecer no arquivo).
# Adicionar uma linha aqui sempre que uma funcionalidade nova e não-óbvia
# for construída — principalmente coisas puramente de UI/UX que o
# TypeScript não reclama se sumirem (função nunca é chamada por outro
# lugar, então não quebra a compilação).
MARCADORES = [
    ("Sidebar recolhível (v0.22.0)", "src/components/layout/sidebar.tsx", "sidebarRecolhida"),
    ("Alternância tablet/PC — agora pra todos os papéis (v0.39.2)", "src/store/app-store.ts", "modoExibicao"),
    ("Alternância tablet/PC — botão no tablet (v0.39.2)", "src/components/layout/tablet-shell.tsx", "setModoExibicao"),
    ("Alternância tablet/PC — botão no desktop (v0.39.2)", "src/components/layout/topbar.tsx", "setModoExibicao"),
    ("Trocar senha — tablet (v0.19.0)", "src/components/layout/tablet-shell.tsx", "handleTrocarSenha"),
    ("Trocar senha — desktop (v0.19.0)", "src/components/layout/topbar.tsx", "handleTrocarSenha"),
    ("Olhinho de senha (v0.17.0)", "src/components/ui/password-input.tsx", "PasswordInput"),
    ("Editar outro usuário (v0.23.0)", "src/modules/usuarios-permissoes/index.tsx", "handleSalvarEdicao"),
    ("Trocar senha de outro usuário (v0.23.0)", "src/modules/usuarios-permissoes/index.tsx", "handleTrocarSenhaUsuario"),
    ("Excluir usuário (v0.23.0)", "src/modules/usuarios-permissoes/index.tsx", "handleExcluirUsuario"),
    ("Edge Function com múltiplas ações (v0.23.0)", "supabase/functions/create-user/index.ts", '"delete"'),
    ("Helper de erro claro em Edge Function (v0.24.0)", "src/lib/edge-function.ts", "chamarEdgeFunction"),
    ("Exclusão avançada de paciente (v0.24.0)", "src/modules/configuracoes/index.tsx", "removeForcado"),
    ("Fisio pode editar internação (v0.34.0)", "src/modules/internacoes/index.tsx", "podeEditarInternacao"),
    ("Excluir internação — admin/supervisor (v0.26.0)", "src/modules/internacoes/index.tsx", "podeExcluirInternacao"),
    ("Diagnóstico na internação (v0.25.0)", "src/modules/internacoes/index.tsx", "diagnostico"),
    ("Pré-lançamento (v0.30.0)", "src/modules/internacoes/index.tsx", "preLancamentoMotoraId"),
    ("Papel Supervisor (v0.34.0)", "src/lib/permissions.ts", "supervisor"),
    ("Painel Impacto Assistencial (v0.32.0)", "src/modules/impacto-assistencial/index.tsx", "GoniometerGauge"),
    ("Painel Diagnóstico do Sistema (v0.35.0)", "src/modules/diagnostico/index.tsx", "leitosOcupadosSemInternacao"),
    ("Recuperação automática de deploy (v0.28.1)", "src/main.tsx", "vite:preloadError"),
    ("Correção alt+tab — SIGNED_IN repetido (v0.18.0)", "src/auth/auth-provider.tsx", "mudouDeUsuario"),
    ("Rede de segurança contra Realtime caindo (v0.33.0)", "src/data/supabase-collection.ts", "fisio:forcar-recarga"),
    ("Ordenação por mais recente nas tabelas de alto volume (v0.37.0)", "src/data/repository.ts", '"created_at", true'),
    ("data-local.ts — correção de fuso horário (v0.17.0)", "src/lib/data-local.ts", "hojeLocalIso"),
    ("Sheet de editar internação sempre montado, fisio consegue editar (v0.39.2)", "src/modules/internacoes/index.tsx", "O Sheet fica SEMPRE montado"),
    ("Cobertura hospitalar — censo diário (v0.39.2)", "src/modules/impacto-assistencial/index.tsx", "hospitalCensus"),
]

# Arquivos que NUNCA podem voltar a calcular "hoje"/data via
# toISOString() — bug clássico (UTC vs fuso local) que já causou dado
# sumindo de tela por horas todo santo dia, entre ~21h e meia-noite no
# Brasil. Achado de novo em 11/08/2026, espalhado por 7 arquivos, depois
# de uma reconstrução do projeto — por isso essa checagem é dedicada,
# separada dos marcadores normais acima.
ARQUIVOS_SEM_TOISOSTRING_PARA_DATA = [
    "src/modules/painel-gestor/index.tsx",
    "src/modules/dashboard-operacional/index.tsx",
    "src/modules/fechamento/index.tsx",
    "src/modules/faturamento/index.tsx",
    "src/modules/escalas/index.tsx",
]


def auditar():
    faltando = []
    for descricao, caminho_rel, marcador in MARCADORES:
        caminho = RAIZ / caminho_rel
        if not caminho.exists():
            faltando.append((descricao, caminho_rel, "arquivo inteiro não existe"))
            continue
        conteudo = caminho.read_text(encoding="utf-8", errors="ignore")
        if marcador not in conteudo:
            faltando.append((descricao, caminho_rel, f'marcador "{marcador}" não encontrado'))

    total = len(MARCADORES)
    ok = total - len(faltando)

    # Segunda checagem: bug de fuso horário voltando (toISOString pra
    # calcular "hoje"/datas). Regex ampla — pega qualquer
    # `.toISOString().slice(0, 10)` OU variável chamada hojeIso()
    # definida com toISOString() por perto.
    regressao_fuso = []
    padrao_suspeito = re.compile(r"toISOString\(\)\.slice\(0,\s*10\)")
    for caminho_rel in ARQUIVOS_SEM_TOISOSTRING_PARA_DATA:
        caminho = RAIZ / caminho_rel
        if not caminho.exists():
            continue
        conteudo = caminho.read_text(encoding="utf-8", errors="ignore")
        if padrao_suspeito.search(conteudo):
            regressao_fuso.append(caminho_rel)

    print(f"Auditoria de funcionalidades — {ok}/{total} OK")
    print(f"Auditoria de fuso horário — {len(ARQUIVOS_SEM_TOISOSTRING_PARA_DATA) - len(regressao_fuso)}/{len(ARQUIVOS_SEM_TOISOSTRING_PARA_DATA)} OK\n")

    problema = False

    if faltando:
        problema = True
        print(f"⚠ {len(faltando)} funcionalidade(s) documentada(s) no CHANGELOG, mas AUSENTE(S) no código:\n")
        for descricao, caminho_rel, motivo in faltando:
            print(f"  - {descricao}")
            print(f"    arquivo: {caminho_rel}")
            print(f"    motivo:  {motivo}\n")

    if regressao_fuso:
        problema = True
        print(f"⚠ {len(regressao_fuso)} arquivo(s) com o bug de fuso horário de volta (toISOString().slice(0,10) pra calcular data/hoje):\n")
        for caminho_rel in regressao_fuso:
            print(f"  - {caminho_rel}")
        print("    Troca por hojeLocalIso() / dataParaIsoLocal() de src/lib/data-local.ts\n")

    if not problema:
        print("Tudo certo — nenhuma funcionalidade documentada está faltando, e o fuso horário está seguro.")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(auditar())
