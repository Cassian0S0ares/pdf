# LivrePDF

Editor de PDF desktop, gratuito e open source (MIT). Funciona 100% offline.

## Estado

Fase 1 — visualizador: abas, zoom, rotação, rolagem contínua/página única,
miniaturas, marcadores, busca, seleção de texto, impressão e PDFs com senha
(somente leitura).

Roteiro completo: `docs/superpowers/specs/2026-11-03-livrepdf-mvp-design.md`.

## Desenvolvimento

Pré-requisitos: Rust stable, Node 24+, pnpm 12+, e no Windows o
Microsoft C++ Build Tools e WebView2 (já incluso no Windows 11).

```bash
cd app
pnpm install
pnpm tauri dev        # app em modo desenvolvimento
pnpm test             # testes da UI
pnpm build && cd .. && cargo test --workspace   # testes Rust
```

CLI: `cargo run -p livrepdf-cli -- info arquivo.pdf`

## Arquitetura

- `crates/livrepdf-core` — motor Rust (lopdf), fonte da verdade dos bytes.
- `crates/livrepdf-cli` — CLI para testes e automação.
- `app/src-tauri` — shell Tauri 2 e comandos IPC.
- `app/src` — UI React + TypeScript; PDF.js apenas renderiza.

## Licença

MIT. Nenhum código da Adobe é utilizado; `docs/acrobat-feature-map.md` serve
apenas como lista de referência de funcionalidades.
