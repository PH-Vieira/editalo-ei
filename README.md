# Editá-lo-ei

Editor de vídeo desktop para Windows — **Tauri + Vue 3 + TypeScript + Vite**.
Estética de ferramenta criativa premium, com a **timeline como núcleo** do produto.

> Estado atual: **production-ready**. O app abre com um projeto vazio (sem dados de
> exemplo); a edição real (importar, cortar, exportar mp4) roda via FFmpeg no desktop.

---

## Como rodar

```bash
npm install

# Frontend no navegador (desenvolvimento rápido, usa fallbacks mock do Tauri)
npm run dev          # http://localhost:1420

# App desktop completo (requer Rust + toolchain do Tauri)
npm run tauri:dev
npm run tauri:build  # gera instaladores .msi / .nsis para Windows
```

No navegador, os acessos nativos (importar, salvar, exportar) usam **fallbacks
simulados** — nada quebra. Dentro do Tauri, as mesmas chamadas vão ao backend Rust.

---

## Arquitetura

```
src/
├── components/ui/      Primitivos reutilizáveis (BaseIcon, IconButton, NumberField…)
├── layouts/            EditorLayout — orquestra as 6 regiões da interface
├── modules/            Funcionalidades isoladas por domínio
│   ├── topbar/         Logo, ações de projeto, exportar
│   ├── media-library/  Biblioteca de mídia, filtros, drag-and-drop
│   ├── preview/        Player/viewport + controles de reprodução
│   ├── inspector/      Propriedades do clipe (Transform/Timing/Audio/Effects)
│   ├── timeline/       NÚCLEO: régua, trilhas, clipes, playhead, zoom
│   └── statusbar/      Resolução, fps, zoom, status de render
├── stores/             Pinia — estado separado por responsabilidade
│   ├── ui.ts           UI state (ferramenta ativa, painéis, toasts, render)
│   ├── project.ts      Projeto + biblioteca de assets
│   └── timeline.ts     Tracks, clips, playhead, zoom, edição
├── composables/        usePlayback, useKeyboardShortcuts
├── data/               defaults — projeto/trilhas iniciais (vazio)
├── tauri/              commands.ts — ponte tipada Frontend ⇄ Rust (com fallbacks)
├── utils/              time (timecode), format, id
├── types/              Modelo de dados (Project → Track → Clip ↔ Asset)
└── styles/             tokens.css (design system), base.css, fonts.css

src-tauri/              Backend Rust + comandos placeholder (import/probe/save/export)
```

### Separação de estado
- **UI state** (`ui`): nada disso pertence ao arquivo do projeto.
- **Project state** (`project`): metadados + assets importados.
- **Timeline state** (`timeline`): tracks, clips, playhead, zoom.

---

## Atalhos de teclado

| Tecla              | Ação                                   |
| ------------------ | -------------------------------------- |
| `Espaço`           | Play / Pause                           |
| `←` / `→`          | Avançar 1 frame (`Shift` = 1 segundo)  |
| `Home` / `End`     | Início / fim do conteúdo               |
| `V` / `B` / `H`    | Ferramenta Selecionar / Lâmina / Mão   |
| `S`                | Dividir clipe no playhead              |
| `Ctrl/Cmd + S`     | Salvar projeto                         |
| `Delete`           | Remover clipe selecionado              |
| `+` / `-`          | Zoom da timeline                       |
| `Esc`              | Limpar seleção                         |

---

## Edição real (FFmpeg) — o que já funciona

No **app desktop** (`npm run tauri:dev`), a edição é real:

- **Importar** abre o diálogo nativo, e cada arquivo é inspecionado com `ffprobe`
  (duração, dimensões, fps).
- **Preview** carrega o arquivo de vídeo de verdade e mostra o frame na posição do playhead.
- **Cortar** (lâmina `S` / aparar bordas) define `inPoint`/`duração` de cada clipe.
- **Exportar** roda o `ffmpeg`: corta cada clipe de vídeo da timeline, normaliza
  resolução/fps, concatena tudo (com áudio, e silêncio onde não há) e grava um **`.mp4`**
  (H.264 + AAC), emitindo progresso real via evento `export://progress`.

> Escopo atual do MVP: **trim + concat de 1 trilha de vídeo**. Composição multi-trilha
> (overlay de logo/texto sobre vídeo) e mixagem de trilhas de áudio independentes ainda
> não entram na exportação — são os próximos passos.

No **navegador** (`npm run dev`), tudo isso cai em fallbacks mock para a UI continuar
viva; só o app desktop produz mp4.

### FFmpeg como *sidecar* (necessário para `tauri:dev` / `tauri:build`)

Os binários **não vão no git** (96 MB cada). Baixe um build do FFmpeg para Windows e
coloque `ffmpeg.exe` e `ffprobe.exe` em `src-tauri/binaries/` com o sufixo do *target triple*:

```
src-tauri/binaries/
├── ffmpeg-x86_64-pc-windows-msvc.exe
└── ffprobe-x86_64-pc-windows-msvc.exe
```

(Descubra o seu triple com `rustc -vV | findstr host`.) O empacotamento via
`externalBin` já está configurado em `tauri.conf.json`, então o `ffmpeg` é embutido
no instalador — o usuário final **não precisa instalar nada**.

### Fluxo para gerar um mp4
1. `npm run tauri:dev`
2. **Importar** → escolha um ou mais `.mp4`/`.mov`.
3. Arraste os vídeos para uma trilha (ou duplo-clique).
4. Apare/divida na timeline (`S`, ou arraste as bordas dos clipes).
5. **Exportar** → escolha o destino `.mp4`. O FFmpeg renderiza com barra de progresso.

---

## Design system

- **Tipografia**: Clash Display (identidade) · Satoshi (interface) · JetBrains Mono (timecodes)
- **Cor**: superfícies escuras em camadas + acento âmbar único (`--accent #F5A524`)
- **Tokens**: `src/styles/tokens.css` (cores, espaçamento, raios, movimento)
- **Movimento**: transições rápidas com easing sofisticada; respeita `prefers-reduced-motion`
