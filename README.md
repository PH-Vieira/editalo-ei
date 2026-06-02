# NaRégua

Editor de vídeo desktop para **Windows**, construído com Tauri + Vue 3 + TypeScript.  
Timeline interativa, corte real de clipes e exportação via FFmpeg embutido — sem instalação extra.

> **Beta** — funcional e em desenvolvimento ativo.

---

## Funcionalidades

- Timeline com drag, snap, divisão de clipes e undo/redo
- Importação de vídeo, áudio e imagens via diálogo nativo
- Preview frame-a-frame sincronizado ao playhead
- Exportação para **MP4** (H.264+AAC), **MP3** e **GIF** animado
- Trilhas criadas automaticamente conforme a mídia adicionada

---

## Instalação

### Download (recomendado)

Baixe o instalador `.exe` na página de [Releases](https://github.com/PH-Vieira/naregua/releases).  
Execute e siga o assistente — o FFmpeg já vem embutido.

### Compilar do código-fonte

**Requisitos**
- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) 1.70+
- `ffmpeg.exe` e `ffprobe.exe` copiados para `src-tauri/binaries/` com o sufixo do seu target triple

```bash
# Descubra o triple da sua máquina:
rustc -vV | grep host
# Ex.: host: x86_64-pc-windows-msvc
# Renomeie os binários:
# ffmpeg-x86_64-pc-windows-msvc.exe
# ffprobe-x86_64-pc-windows-msvc.exe

git clone https://github.com/PH-Vieira/naregua.git
cd naregua
npm install
npm run tauri:dev     # modo desenvolvimento
npm run tauri:build   # gera instalador em src-tauri/target/release/bundle/
```
