# NaRégua — Contexto para o Claude Code

Editor de vídeo desktop premium para Windows. Tauri + Vue 3 + TypeScript + Rust + FFmpeg.

Parte do ecossistema ph.dev — ver `../CLAUDE.md` para padrões gerais de qualidade.

---

## O produto

Editor focado em creators e freelancers que querem uma ferramenta ágil, sem assinatura e com controle real. Não é um wrapper de browser: é um app nativo com FFmpeg embutido como sidecar Rust.

**Status atual:** em desenvolvimento ativo. Funcionalidades core implementadas; multi-trilha e audio mixing são os próximos milestones.

---

## Arquitetura

```
src/
├── modules/          # áreas funcionais da UI (cada uma é um domínio isolado)
│   ├── timeline/     # ClipBlock, Playhead, TimeRuler, TrackRow, TrackHeader, TimelinePanel, TimelineToolbar
│   ├── preview/      # PreviewPanel, PreviewLayer, PlayerControls
│   ├── inspector/    # InspectorPanel, PropertyGroup
│   ├── media-library/# MediaLibrary, MediaItem
│   ├── topbar/       # TopBar + menus (File, Edit, View, Toolbar)
│   ├── titlebar/     # WindowControls (controles nativos da janela)
│   └── statusbar/    # StatusBar
├── components/ui/    # primitivos reutilizáveis (BaseIcon, IconButton, NumberField, modais, toasts)
├── stores/           # Pinia — uma store por domínio
│   ├── project.ts    # metadados e estado do projeto aberto
│   ├── timeline.ts   # clipes, trilhas, snap, undo/redo
│   └── ui.ts         # painéis, seleção, modo de ferramenta
├── composables/      # lógica reutilizável (filmstrip, waveform, keyboard, unsaved guard)
├── tauri/            # comandos Tauri tipados (bridge Rust ↔ TS)
├── styles/           # tokens.css, base.css, fonts.css
├── types/            # tipos globais (index.ts)
└── utils/            # helpers puros (format, time, id, caches de mídia)
```

---

## Decisões técnicas

### Timeline
- **Snap por candidatos** — em vez de loop em todos os clipes, coleta pontos de snap (bordas de clipes, playhead, marcadores) e resolve o mais próximo. Evita O(n²) e conflito de sobreposição.
- **Undo/redo por snapshot** — `timeline.ts` mantém pilha de estados serializados. Push no snapshot antes de qualquer mutação destrutiva.
- **Drag com threshold** — movimento < 4px não inicia drag (evita clique acidental virar move).

### Reprodução
- O player **não** comanda o `<video>` frame a frame. Lê `currentTime` nativo em `requestAnimationFrame` para mover o playhead. Re-seek só acontece quando o usuário reposiciona o playhead.

### FFmpeg sidecar
- `src/tauri/commands.ts` expõe comandos tipados: `probeMedia`, `generateFilmstrip`, `exportTimeline`.
- Filmstrip e waveform são gerados uma vez e cacheados em `clipMediaCache` / `mediaSrcCache` por clip ID.
- Progresso de exportação emitido via evento Tauri `export:progress` — o frontend escuta sem polling.

### Design system
- Tokens em `src/styles/tokens.css`. Acento âmbar (`--accent: #f5a524`) sobre fundo escuro em camadas (`--bg-0` a `--bg-4`).
- Fonte display: Switzer/Satoshi. Fonte UI: Satoshi. Mono: JetBrains Mono.
- Grid de 4px (`--sp-1` a `--sp-8`). Raios de `--r-xs` (4px) a `--r-full`.

---

## Convenções

- Composition API com `<script setup>` em todos os componentes. Sem Options API.
- Props com interface explícita em `types/index.ts` ou inline quando simples.
- Emits declarados — sem comunicação implícita entre módulos. Módulos distintos se comunicam via store.
- CSS scoped por componente. Tokens globais do `tokens.css` disponíveis em todos os escopos.
- Nomes de comandos Tauri em `snake_case` (convenção Rust). Wrappers TS em `camelCase`.

---

## O que NÃO fazer

- Não usar `any` em TypeScript. Se o tipo não existe, crie-o em `types/index.ts`.
- Não acessar `document` diretamente dentro de componentes Vue para manipular DOM — use template refs.
- Não criar um novo store para cada componente. Stores são por domínio de negócio, não por componente.
- Não chamar FFmpeg diretamente do frontend — sempre via comando Tauri em `src/tauri/commands.ts`.
- Não fazer polling para progresso de operações pesadas — use eventos Tauri.
