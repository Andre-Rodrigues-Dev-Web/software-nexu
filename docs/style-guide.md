# Velance UI Style Guide

## Objetivo

Padronizar decisões visuais para manter consistência entre todas as páginas, reduzir clutter e melhorar legibilidade/acessibilidade.

## Fundamentos

- Tipografia principal: Montserrat (`400`, `500`, `700`, `800`)
- Escala de títulos:
  - `h1`: 1.35rem–1.8rem
  - `h2`: 1.1rem–1.45rem
  - `h3`: 1rem–1.22rem
  - `h4`: 0.92rem–1rem
- Corpo: 0.95rem (0.9rem em telas muito pequenas)

## Tokens de Design

Definidos em `:root` dentro de `renderer/styles/main.scss`:

- Cores: `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--success`, `--warn`, `--danger`
- Superfícies: `--border-soft`, `--shadow-soft`
- Raios: `--radius-sm`, `--radius-md`, `--radius-lg`
- Espaçamentos: `--space-2` até `--space-6`

## Componentes Padrão

- `.panel`, `.card`: containers principais com borda suave e sombra discreta
- `.liquid-glass`: superfície translúcida com blur e profundidade
- `.row`: agrupamento horizontal responsivo com `gap` e wrap
- `.status-pill*`: estados semânticos (updated, outdated, pending, error)
- `.logs`: painel de logs com scroll e leitura contínua

## Navegação

- `.sidebar-nav`: grid de grupos semânticos
- `.sidebar-group`, `.sidebar-group__title`: separação hierárquica
- `.nav-btn`: alvo de toque mínimo de 44px com microinterações
- Níveis aninhados:
  - `.nav-btn--level-1`
  - `.nav-btn--level-2`
  - `.nav-btn--level-3`

Exemplo:

```html
<button class="nav-btn nav-btn--level-1">Top level</button>
<button class="nav-btn nav-btn--level-2">Nested level 2</button>
<button class="nav-btn nav-btn--level-3">Nested level 3</button>
```

## Microinterações

- Hover em botões com elevação e transição suave
- Active com compressão leve (`scale`)
- Focus visível com contorno de alto contraste
- Toast com transição de entrada/saída

## Responsividade

- Estrutura principal adaptável em `320px` até `1920px`
- Breakpoints aplicados:
  - `max-width: 1150px`
  - `max-width: 900px`
  - `max-width: 420px`
- Estratégia:
  - Conteúdo empilhado em telas menores
  - Botões em largura total para interação touch
  - Espaçamentos com `clamp` para proporções fluidas

## Acessibilidade

- Contraste de cores orientado para WCAG 2.1 AA em temas escuros
- Alvos touch mínimos de 44px
- Hierarquia tipográfica clara
- Estados visuais distintos por cor e forma
- Navegação semântica com `aria-label` nas áreas principais
