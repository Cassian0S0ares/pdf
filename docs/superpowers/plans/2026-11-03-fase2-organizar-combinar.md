# LivrePDF Fase 2 — Organizar + Combinar — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sobre o visualizador da Fase 1, permitir reordenar, girar, excluir, extrair, inserir, substituir e dividir páginas; combinar vários PDFs e imagens JPG/PNG em um documento; desfazer/refazer; salvar e salvar como.

**Architecture:** `DocumentSession` deixa de ser imutável: passa a ter revisão, flag `dirty` e histórico de snapshots de bytes (undo/redo). Um módulo `pages` em `livrepdf-core` implementa as operações sobre `lopdf::Document`. Cada operação reserializa os bytes; a UI recarrega o PDF.js a partir de `get_document_bytes` quando a revisão muda (Rust continua sendo a fonte da verdade). A CLI expõe as mesmas operações para automação e testes.

**Tech Stack:** o mesmo da Fase 1, mais o crate `png` (decodificação de PNG; MIT/Apache-2.0) e `tauri-plugin-dialog` já existente para salvar. JPEG entra sem decodificar (`DCTDecode`).

**Spec:** `docs/superpowers/specs/2026-11-03-livrepdf-mvp-design.md` (seções 3, 4.3, 5, 6, 7, 8 e fase 2 da seção 9).

**Pré-requisito:** Fase 1 concluída (branch `feat/fase1-viewer`). Criar a branch `feat/fase2-organizar` a partir dela.

## Global Constraints

- Mesmas restrições da Fase 1: licença MIT, 100% offline, `livrepdf-core` sem dependência de Tauri/UI, textos de UI em português do Brasil, identificadores em inglês, erros como `AppError`.
- Rust é a fonte da verdade: PDF.js nunca escreve.
- Documentos `Encrypted` ou `Unparseable` são somente leitura: toda operação de escrita retorna `ErrorCode::ReadOnly` e a UI desativa as ações com o motivo visível.
- Salvar é atômico: grava em arquivo temporário no mesmo diretório e renomeia sobre o original. Mudanças estruturais sempre reescrevem o arquivo inteiro.
- Nenhuma operação pode deixar o documento sem páginas.
- Páginas são identificadas por índice base 0 na API (UI e IPC); o `lopdf` usa base 1 internamente, a conversão fica só no módulo `pages`.
- Histórico de undo limitado a 20 snapshots por documento.
- Commits seguem a convenção do repositório (Fase 1: sem linha `Co-Authored-By`; se o usuário pedir atribuição, seguir o pedido atual).
- Comandos assumem a raiz do repo (`/home/cranio/pdf`).

## Fora do escopo (não implementar)

Bates, numeração de páginas, transições (⏭ no spec); autosave de recuperação; salvamento incremental; PDFs com senha editáveis (Fase 6, qpdf); qualquer anotação (Fase 3).

## Estrutura de arquivos desta fase

```
crates/livrepdf-core/
  Cargo.toml                 # + png
  src/error.rs               # + ReadOnly, InvalidArgument, UnsupportedImage
  src/session.rs             # revisão, dirty, histórico, save
  src/history.rs             # NOVO: pilha de snapshots (undo/redo)
  src/pages/mod.rs           # NOVO: Operation, apply, validação de índices
  src/pages/rotate.rs        # NOVO
  src/pages/delete.rs        # NOVO
  src/pages/reorder.rs       # NOVO
  src/pages/extract.rs       # NOVO (extract + split)
  src/pages/insert.rs        # NOVO (em branco, de arquivo, substituir)
  src/pages/copy.rs          # NOVO: cópia de objetos entre documentos
  src/pages/image.rs         # NOVO: JPG/PNG → página
  src/pages/merge.rs         # NOVO
  src/pages/outline.rs       # NOVO: preservar/descartar marcadores
  src/testing.rs             # + make_pdf_with_inherited_attrs, make_outline_pdf, imagens de teste
crates/livrepdf-cli/
  src/main.rs                # + merge, extract, rotate, delete, split
  tests/pages.rs             # NOVO
app/src-tauri/src/lib.rs     # + apply_ops, undo, redo, save, save_as, merge_files, split_document
app/src/
  lib/ipc.ts                 # + tipos Operation e chamadas
  store/documents.ts         # + revision, dirty, canUndo/canRedo, mode ("view" | "organize")
  app/reloadDocument.ts      # NOVO: recarrega PDF.js quando a revisão muda
  app/saveActions.ts         # NOVO: salvar, salvar como, confirmar fechamento
  app/CloseConfirm.tsx       # NOVO
  organize/OrganizeView.tsx  # NOVO: grade de miniaturas
  organize/PageCard.tsx      # NOVO
  organize/OrganizeToolbar.tsx # NOVO
  organize/selection.ts      # NOVO: lógica de seleção (Ctrl/Shift)
  organize/reorder.ts        # NOVO: cálculo da nova ordem após arrastar
  organize/InsertDialog.tsx  # NOVO
  organize/SplitDialog.tsx   # NOVO
  combine/CombineDialog.tsx  # NOVO
  app/Toolbar.tsx, shortcuts.ts, actions.ts  # ajustes
```

---

### Task 1: Erros novos e histórico de snapshots

**Files:** `error.rs`, `history.rs` (novo), `lib.rs`.

- [ ] **Step 1: Teste do histórico (falha primeiro)** — em `history.rs`: `push` guarda o estado anterior; `undo` devolve o snapshot anterior e empilha o atual no redo; `redo` o inverso; um novo `push` limpa o redo; passar de 20 itens descarta o mais antigo; `undo` sem histórico retorna `None`.
- [ ] **Step 2: Implementar** `History { undo: VecDeque<Vec<u8>>, redo: Vec<Vec<u8>> }` com `push(prev)`, `undo(current) -> Option<Vec<u8>>`, `redo(current) -> Option<Vec<u8>>`, `can_undo()`, `can_redo()`, `LIMIT = 20`.
- [ ] **Step 3: Novos `ErrorCode`**: `ReadOnly`, `InvalidArgument`, `UnsupportedImage` (serializados em `SCREAMING_SNAKE_CASE`, com teste de serialização como os existentes).
- [ ] **Step 4:** `cargo test -p livrepdf-core` verde; commit `feat(core): history of snapshots and new error codes`.

### Task 2: Sessão mutável e salvamento

**Files:** `session.rs`, `store.rs`.

- [ ] **Step 1: Testes (falham primeiro)**
  - `new_session_is_clean`: `revision() == 0`, `is_dirty() == false`.
  - `replace_bytes_bumps_revision_and_marks_dirty`.
  - `undo_restores_previous_bytes_and_revision_tracks`: undo/redo mantêm os bytes corretos; `is_dirty` volta a `false` ao desfazer até o ponto salvo.
  - `read_only_session_rejects_writes` → `ErrorCode::ReadOnly` (criptografado e corrompido).
  - `save_writes_atomically`: salva em diretório temporário, relê e confere o número de páginas; nenhum arquivo `.tmp` sobra; `save` sem caminho de origem retorna `InvalidArgument`.
  - `save_as_updates_path_and_clears_dirty`.
- [ ] **Step 2: Implementar** em `DocumentSession`: campos `revision: u64`, `saved_revision: u64`, `history: History`; métodos `revision()`, `is_dirty()`, `can_undo()`, `can_redo()`, `commit(new_doc: Document) -> Result<()>` (serializa com `save_to`, empilha snapshot, recarrega `bytes`/`doc`, incrementa revisão), `undo()`, `redo()`, `save()`, `save_as(path)`. `DocumentInfo` ganha `revision`, `dirty`, `can_undo`, `can_redo`.
- [ ] **Step 3: `SessionStore`** ganha `get_mut`.
- [ ] **Step 4:** testes verdes; commit `feat(core): mutable session with revisions, undo/redo and atomic save`.

### Task 3: Módulo `pages` — validação e `Operation`

**Files:** `pages/mod.rs`.

- [ ] **Step 1: Definir** `Operation` (serde, `#[serde(tag = "kind", rename_all = "camelCase")]`): `Rotate { pages, degrees }`, `Delete { pages }`, `Reorder { order }`, `InsertBlank { at, width, height }`, `InsertFromFile { at, path, pages }`, `Replace { page, path, source_page }`. `extract`, `split` e `merge` não são `Operation` (geram documentos novos).
- [ ] **Step 2: Testes de validação**: índice fora do intervalo, lista vazia, duplicados e `degrees` que não é múltiplo de 90 → `InvalidArgument`.
- [ ] **Step 3: `apply(session, ops) -> Result<AppliedOps>`** aplica as operações em sequência sobre uma cópia do `Document` e faz um único `commit` ao final (atômico: se uma falhar, nada muda). `AppliedOps { revision, page_count }`.
- [ ] **Step 4:** commit `feat(core): page operations skeleton with validation`.

### Task 4: Girar, excluir, reordenar

**Files:** `pages/rotate.rs`, `delete.rs`, `reorder.rs`, `testing.rs`.

- [ ] **Step 1: Fixture** `make_pdf_with_inherited_attrs`: `/Rotate`, `/MediaBox` e `/Resources` definidos no nó `/Pages` pai e não na página.
- [ ] **Step 2: Testes**
  - `rotate_adds_to_existing_rotation_mod_360`, `rotate_counter_clockwise` (−90), `rotate_materializes_inherited_rotate`.
  - `delete_removes_pages_and_keeps_order`, `delete_all_pages_is_rejected`, `delete_updates_count_in_pages_node`.
  - `reorder_applies_permutation` conferindo o texto de cada página após reordenar; `reorder_rejects_non_permutation`.
- [ ] **Step 3: Implementar.** Ao reordenar, reescrever `/Kids` da raiz e achatar a árvore (todas as páginas filhas diretas da raiz, `/Parent` atualizado, atributos herdados materializados em cada página).
- [ ] **Step 4:** testes verdes; commit `feat(core): rotate, delete and reorder pages`.

### Task 5: Cópia de objetos entre documentos

**Files:** `pages/copy.rs`.

- [ ] **Step 1: Testes**
  - `copy_pages_between_documents_preserves_text`: texto de cada página copiada continua extraível.
  - `copy_renumbers_without_collisions`: ids de objetos do destino não são sobrescritos.
  - `copy_materializes_inherited_attributes`: `/MediaBox`, `/Resources` e `/Rotate` herdados chegam à página copiada.
  - `copy_does_not_pull_whole_source_document`: copiar 1 página de um PDF de 10 só traz os objetos alcançáveis dessa página (conferir o número de objetos).
  - `copy_drops_parent_link_to_source_tree`.
- [ ] **Step 2: Implementar** `copy_pages(dest: &mut Document, src: &Document, pages: &[u32]) -> Vec<ObjectId>`: calcular o fecho de referências a partir de cada página (ignorando `/Parent`), mapear ids antigos → novos, clonar com referências reescritas. Verificar na API do `lopdf` 0.46 os helpers disponíveis (`renumber_objects_with`, `traverse_objects`) antes de escrever do zero.
- [ ] **Step 3:** commit `feat(core): copy page object graphs between documents`.

### Task 6: Inserir, substituir, extrair, dividir

**Files:** `pages/insert.rs`, `pages/extract.rs`.

- [ ] **Step 1: Testes**
  - `insert_blank_at_start_middle_end` com `MediaBox` pedido; `insert_blank_rejects_non_positive_size`.
  - `insert_from_file_inserts_selected_pages_at_position`.
  - `replace_swaps_one_page_keeping_neighbors`.
  - `extract_creates_new_document_with_only_selected_pages` (ordem preservada; original intacto).
  - `split_by_ranges` (`"1-3,5"` → 2 documentos), `split_every_n` (7 páginas, N=3 → 3, 3 e 1), `split_rejects_invalid_ranges`.
  - Parser de intervalos (`parse_ranges("1-3,5,8-")`) testado à parte.
- [ ] **Step 2: Implementar.** `extract(&Session, pages) -> Vec<u8>`; `split(&Session, SplitMode) -> Vec<Vec<u8>>`. Arquivos de origem externos são abertos com `DocumentSession::open`; se forem somente leitura (senha/corrompidos), erro `ReadOnly` com mensagem clara.
- [ ] **Step 3:** commit `feat(core): insert, replace, extract and split pages`.

### Task 7: Imagens como páginas

**Files:** `Cargo.toml` (png), `pages/image.rs`, `testing.rs`.

- [ ] **Step 1: Dependência**: adicionar `png` ao workspace; conferir a licença (MIT/Apache-2.0).
- [ ] **Step 2: Testes**
  - `jpeg_becomes_page_with_dctdecode_and_native_size`: não decodifica; lê largura/altura do marcador SOFn.
  - `png_rgb_rgba_gray_become_pages` (RGBA gera `/SMask`; 16 bits é reduzido para 8; paletada é expandida).
  - `page_size_matches_image_at_72dpi_and_is_capped` (limite de 14400 pt no maior lado).
  - `corrupt_or_unknown_image_is_unsupported_image_error`.
  - Imagens de teste geradas no próprio teste (bytes mínimos de JPEG e PNG em `testing.rs`).
- [ ] **Step 3: Implementar** `image_to_page(dest: &mut Document, bytes: &[u8]) -> Result<ObjectId>`, detectando o formato pelos magic bytes (não pela extensão).
- [ ] **Step 4:** commit `feat(core): turn JPG and PNG images into pages`.

### Task 8: Combinar arquivos e marcadores

**Files:** `pages/merge.rs`, `pages/outline.rs`.

- [ ] **Step 1: Testes**
  - `merge_two_pdfs_concatenates_pages_in_order`.
  - `merge_mixes_pdfs_and_images`.
  - `merge_preserves_outlines_of_each_source` (entradas apontam para as páginas corretas no resultado, com o título do arquivo como nó pai quando houver mais de um).
  - `outlines_pointing_to_deleted_pages_are_dropped` (usado também por `Delete` e `extract`).
  - `merge_rejects_empty_list` e `merge_fails_cleanly_if_one_file_is_read_only` (nenhum resultado parcial).
- [ ] **Step 2: Implementar** `merge(inputs: &[MergeInput]) -> Result<Vec<u8>>` com `MergeInput::Pdf(path) | Image(path)`; o IPC abre o resultado como sessão nova (`path = None`, nome "Combinado.pdf").
- [ ] **Step 3:** commit `feat(core): merge PDFs and images preserving outlines`.

### Task 9: Round-trip e regressão

**Files:** `crates/livrepdf-core/tests/roundtrip.rs` (novo).

- [ ] **Step 1: Testes de ida e volta** — para cada operação: aplicar → `save_as` → reabrir com `DocumentSession::open` → conferir contagem de páginas, rotação e texto por página; undo/redo reproduzem bytes idênticos aos snapshots.
- [ ] **Step 2: Estresse** — PDF com 200 páginas: reordenar, excluir metade e extrair em tempo razoável (sem limite rígido; só registrar).
- [ ] **Step 3 (opcional, se `qpdf` estiver instalado):** validar com `qpdf --check`, pulando o teste com mensagem quando o binário não existir. Não adicionar `qpdf` como dependência obrigatória (isso é a Fase 6).
- [ ] **Step 4:** commit `test(core): round-trip tests for page operations`.

### Task 10: CLI

**Files:** `crates/livrepdf-cli/src/main.rs`, `tests/pages.rs`.

- [ ] **Step 1: Testes de integração** (`assert_cmd` ou `std::process::Command`, como em `tests/info.rs`): `merge a.pdf b.png -o out.pdf`, `extract in.pdf --pages 1-2 -o out.pdf`, `rotate in.pdf --pages 1 --degrees 90 -o out.pdf`, `delete in.pdf --pages 2 -o out.pdf`, `split in.pdf --every 2 -o dir/`. Verificar o código de saída e `info` no resultado.
- [ ] **Step 2: Implementar** os subcomandos reutilizando `parse_ranges` (números de página base 1 na CLI).
- [ ] **Step 3:** commit `feat(cli): merge, extract, rotate, delete and split`.

### Task 11: Comandos IPC

**Files:** `app/src-tauri/src/lib.rs`, `app/src/lib/ipc.ts`, `ipc.test.ts`.

- [ ] **Step 1: Comandos** (todos `async`, trabalho pesado em `spawn_blocking`, lock do store só no mínimo): `apply_ops(doc_id, ops) -> AppliedOps`, `undo(doc_id)`, `redo(doc_id)`, `save(doc_id)`, `save_as(doc_id, path)`, `extract_pages(doc_id, pages, path)`, `split_document(doc_id, mode, dir) -> Vec<String>`, `merge_files(inputs) -> DocumentInfo`, `get_document_info(doc_id)`. Registrar em `generate_handler!`.
- [ ] **Step 2: `ipc.ts`**: tipos `Operation`, `AppliedOps`, `SplitMode`, `MergeInput` e as funções correspondentes; `DocumentInfo` com os campos novos. Estender `ipc.test.ts` verificando nomes de comando e argumentos em camelCase.
- [ ] **Step 3:** `cargo test --workspace` e `pnpm test` verdes; commit `feat(app): IPC commands for page operations and saving`.

### Task 12: Store, recarga e salvar

**Files:** `store/documents.ts`, `app/reloadDocument.ts`, `app/saveActions.ts`, `app/CloseConfirm.tsx`, `Toolbar.tsx`, `shortcuts.ts`, `actions.ts` e os testes.

- [ ] **Step 1: Testes do store**: `Tab` ganha `revision`, `dirty`, `canUndo`, `canRedo`, `mode`; `applyInfo(docId, info)` atualiza esses campos; mudar a revisão zera `search` da aba.
- [ ] **Step 2: `reloadDocument(docId)`**: chama `getDocumentBytes`, carrega o novo `PDFDocumentProxy`, troca na aba, destrói o antigo, limpa o cache de tamanhos de página (`pageSizes`) daquele documento e mantém `currentPage` limitado ao novo total. Testar com PDF de `makePdf`, incluindo a corrida de duas recargas seguidas (a mais antiga é descartada).
- [ ] **Step 3: Salvar**: `save` (se não houver caminho, cai em `save_as` com diálogo), `saveAs`, undo/redo. Atalhos Ctrl+S, Ctrl+Shift+S, Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, testados em `shortcuts.test.ts`.
- [ ] **Step 4: Fechamento**: aba com `dirty` abre `CloseConfirm` (Salvar / Descartar / Cancelar); a janela inteira também confirma ao fechar com alterações. A liberação da sessão do core continua garantida em todos os caminhos (regressão dos commits `fix(ui): always release the core session...`).
- [ ] **Step 5:** commit `feat(ui): revisions, reload, save and unsaved-changes confirmation`.

### Task 13: Visão Organizar páginas

**Files:** `organize/*`, `Toolbar.tsx`, `App.tsx`.

- [ ] **Step 1: Testes da lógica pura**
  - `selection.ts`: clique simples, Ctrl+clique alterna, Shift+clique seleciona intervalo, Ctrl+A.
  - `reorder.ts`: mover 1 ou várias páginas selecionadas para uma posição, produzindo a permutação correta (incluindo mover para o fim e para a mesma posição).
- [ ] **Step 2: Testes de componente** (Testing Library): a grade renderiza N cartões; selecionar e clicar em "Excluir" chama `applyOps` com `Delete`; "Girar" gera `Rotate` ±90; os botões ficam `disabled` com `title` explicando quando `readOnlyReason` existe ou quando não há seleção; excluir todas as páginas é bloqueado com aviso.
- [ ] **Step 3: Implementar** `OrganizeView` (miniaturas via PDF.js reaproveitando o render de `Thumbnails`, arrastar com HTML5 drag-and-drop e indicador de posição), `OrganizeToolbar` (Girar ↺ ↻, Excluir, Extrair, Inserir, Substituir, Dividir, Desfazer, Refazer) e botão/atalho para alternar `mode` entre visualizar e organizar.
- [ ] **Step 4: `InsertDialog`** (página em branco com tamanho A4/Carta/igual à atual; ou de arquivo com seleção de páginas) e **`SplitDialog`** (por intervalo ou a cada N, escolha da pasta de saída). Extrair usa o diálogo de salvar.
- [ ] **Step 5:** cada ação chama `applyOps`, depois `reloadDocument` e atualiza a aba; erros vão para `Notices`.
- [ ] **Step 6:** commit `feat(ui): organize pages view`.

### Task 14: Diálogo Combinar arquivos

**Files:** `combine/CombineDialog.tsx`, testes.

- [ ] **Step 1: Testes**: adicionar arquivos (PDF e imagens) pelo diálogo nativo e por arrastar-e-soltar; reordenar a lista; remover item; botão "Combinar" desativado com menos de 2 itens; ao concluir, abre uma aba nova com o resultado e mostra aviso de erro sem fechar o diálogo se falhar.
- [ ] **Step 2: Implementar** o diálogo (menu da toolbar e atalho Ctrl+Shift+M); filtros do seletor: `pdf`, `jpg`, `jpeg`, `png`.
- [ ] **Step 3:** commit `feat(ui): combine files dialog`.

### Task 15: CI, README e verificação final

- [ ] **Step 1:** README: estado "Fase 2 — organizar e combinar"; documentar os comandos novos da CLI.
- [ ] **Step 2:** confirmar no CI que `cargo test --workspace` e `pnpm test` passam nos 3 sistemas (Windows, macOS, Linux) e que o crate `png` compila em todos.
- [ ] **Step 3: Verificação manual** com `pnpm tauri dev`, nesta ordem, anotando o resultado de cada item:
  1. Abrir PDF de 10+ páginas, entrar em Organizar, arrastar uma página, girar duas, excluir uma, desfazer tudo, refazer.
  2. Salvar, fechar e reabrir: o arquivo reflete as alterações.
  3. Extrair um intervalo e dividir a cada 3 páginas; abrir os resultados.
  4. Combinar 2 PDFs + 1 JPG + 1 PNG; conferir a ordem e os marcadores.
  5. Abrir PDF com senha e PDF corrompido: ações de edição desativadas com o motivo.
  6. Fechar aba com alterações: confirmação aparece nas três escolhas.
  7. Abrir o resultado salvo em outro leitor (por exemplo o do navegador) para validar a compatibilidade.
- [ ] **Step 4:** `cargo test --workspace`, `pnpm test`, `pnpm build` e `cargo clippy --workspace -- -D warnings` limpos; commit `docs: mark phase 2 as complete`.

---

## Riscos específicos da fase

| Risco | Mitigação |
|---|---|
| `lopdf` perde atributos herdados ao copiar/reordenar páginas | Materializar `/MediaBox`, `/Resources`, `/CropBox` e `/Rotate` em cada página (Task 4 e 5, com fixture dedicada) |
| Cópia puxa o documento de origem inteiro e incha o arquivo | Fecho de referências a partir da página, ignorando `/Parent` (teste de contagem de objetos) |
| Snapshots de PDFs grandes consomem memória | Limite de 20 passos; reavaliar operações inversas se aparecer em uso real |
| PNG com canal alfa, 16 bits ou paleta | Casos cobertos nos testes da Task 7; formatos não suportados dão `UNSUPPORTED_IMAGE` em vez de gerar página corrompida |
| Recarga do PDF.js perde a posição de rolagem | `reloadDocument` preserva `currentPage`; teste dedicado |
| Corrida entre operações rápidas (clicar várias vezes) | Serializar `applyOps` por documento na UI (fila) e descartar recargas obsoletas |
