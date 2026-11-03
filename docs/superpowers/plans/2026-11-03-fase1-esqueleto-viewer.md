# LivrePDF Fase 1 — Esqueleto + Viewer — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App desktop LivrePDF que abre PDFs (diálogo, arrastar-e-soltar, associação de arquivo), com abas, zoom/ajuste/rotação, rolagem contínua ou página única, miniaturas, bookmarks, busca, seleção de texto, impressão e PDFs com senha.

**Architecture:** Workspace Cargo com `livrepdf-core` (sessões de documento sobre `lopdf`, fonte da verdade dos bytes), `livrepdf-cli` (CLI de teste) e o shell Tauri 2 em `app/src-tauri`. A UI React + TypeScript em `app/src` pede os bytes ao core via IPC e usa PDF.js só para renderizar, gerar a camada de texto, ler outline e buscar.

**Tech Stack:** Rust stable, `lopdf` 0.3x, `thiserror` 2, `serde`, `clap` 4; Tauri 2 (+ `tauri-plugin-dialog`, `tauri-plugin-single-instance`); React 19, TypeScript, Vite, Zustand 5, `pdfjs-dist` 5; Vitest + Testing Library; pnpm.

**Spec:** `docs/superpowers/specs/2026-11-03-livrepdf-mvp-design.md` (seções 3, 4.1, 5, 7, 8 e fase 1 da seção 9).

## Global Constraints

- Licença MIT; toda dependência deve ser MIT/Apache-2.0/BSD compatível.
- App desktop instalável e 100% offline: nenhuma chamada de rede em runtime.
- Rust é a fonte da verdade: PDF.js nunca escreve; os bytes sempre vêm de `get_document_bytes`.
- `livrepdf-core` não depende de Tauri nem de UI.
- Erros do core: `AppError { code, message, details }` serializado em camelCase; `code` em `SCREAMING_SNAKE_CASE`.
- Textos de interface em português do Brasil; identificadores de código em inglês.
- Identifier do app: `org.livrepdf.app`; productName: `LivrePDF`.
- Commits sem linha `Co-Authored-By`.
- Comandos assumem diretório raiz do repo `C:\Users\cassiano.soares\pdf` (bash: `/c/Users/cassiano.soares/pdf`).

## Estrutura de arquivos desta fase

```
Cargo.toml                          # workspace
.gitignore  .gitattributes  LICENSE  README.md
.github/workflows/ci.yml
crates/livrepdf-core/
  Cargo.toml
  src/lib.rs          # reexports
  src/error.rs        # AppError, ErrorCode, Result
  src/text.rs         # decode_pdf_text
  src/session.rs      # DocumentSession, DocumentInfo, ReadOnlyReason
  src/store.rs        # SessionStore (docId → sessão)
  src/testing.rs      # make_pdf* para testes (pub, doc(hidden))
crates/livrepdf-cli/
  Cargo.toml
  src/main.rs         # `livrepdf-cli info <arquivo>`
  tests/info.rs
app/                                # projeto pnpm + Tauri
  package.json  vite.config.ts  tsconfig.json  index.html
  src-tauri/Cargo.toml  tauri.conf.json  capabilities/default.json
  src-tauri/src/main.rs  src-tauri/src/lib.rs
  src/main.tsx  src/App.tsx  src/styles.css
  src/lib/ipc.ts            # wrappers tipados dos comandos
  src/lib/pdfEngine.ts      # loadPdf, PasswordRequiredError
  src/lib/errors.ts         # errorMessage
  src/test/makePdf.ts       # gerador de PDF de teste
  src/test/setup.ts
  src/store/documents.ts    # abas, zoom, página, busca
  src/store/notices.ts      # avisos/erros
  src/store/passwordPrompt.ts
  src/app/openFile.ts       # abrir/fechar orquestrado
  src/app/actions.ts        # ações de toolbar/atalhos
  src/app/shortcuts.ts      # mapeamento de teclas
  src/app/useOpenFileSources.ts
  src/app/Tabs.tsx  Toolbar.tsx  PasswordDialog.tsx  Notices.tsx  EmptyState.tsx
  src/viewer/zoom.ts  pageSizes.ts  useInView.ts  useElementSize.ts
  src/viewer/PageView.tsx  DocumentView.tsx
  src/sidebar/outline.ts  Outline.tsx  Thumbnails.tsx  Sidebar.tsx
  src/search/search.ts  SearchBar.tsx
  src/print/printPdf.ts
```

---

### Task 0: Pré-requisitos de ambiente

**Files:** nenhum.

Rust não está instalado nesta máquina. Instalar software exige aprovação do usuário: **peça confirmação antes do Step 1**.

- [ ] **Step 1: Instalar rustup (após aprovação)**

```powershell
winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
```

Abrir novo shell e rodar:

```bash
rustup default stable
rustc --version && cargo --version
```

Expected: versões impressas (rustc ≥ 1.85).

- [ ] **Step 2: Conferir demais ferramentas**

```bash
node --version; pnpm --version
```

Expected: Node ≥ 20, pnpm ≥ 9. MSVC Build Tools e WebView2 já presentes (verificado).

---

### Task 1: Workspace + `livrepdf-core`: erros, texto, sessão

**Files:**
- Create: `Cargo.toml`, `.gitignore`, `.gitattributes`, `LICENSE`
- Create: `crates/livrepdf-core/Cargo.toml`, `src/lib.rs`, `src/error.rs`, `src/text.rs`, `src/session.rs`, `src/testing.rs`

**Interfaces:**
- Produces:
  - `livrepdf_core::AppError { code: ErrorCode, message: String, details: Option<String> }`, `AppError::new(code, msg)`, `ErrorCode::{Io, NotAPdf, DocumentNotFound}`, `livrepdf_core::Result<T>`
  - `livrepdf_core::decode_pdf_text(&[u8]) -> String`
  - `DocumentSession::from_bytes(Vec<u8>, Option<PathBuf>) -> Result<DocumentSession>`, `DocumentSession::open(impl AsRef<Path>) -> Result<DocumentSession>`, `.info(&str) -> DocumentInfo`, `.bytes() -> &[u8]`, `.read_only_reason() -> Option<ReadOnlyReason>`
  - `DocumentInfo { doc_id, path: Option<String>, file_name, page_count: Option<u32>, title: Option<String>, read_only_reason: Option<ReadOnlyReason>, size_bytes: u64 }` (serde camelCase)
  - `ReadOnlyReason::{Encrypted, Unparseable}` (serde `"encrypted"`, `"unparseable"`)
  - `livrepdf_core::testing::{make_pdf(&[&str]) -> Vec<u8>, make_pdf_with_title(&[&str], &str) -> Vec<u8>, make_encrypted_stub_pdf() -> Vec<u8>}`

- [ ] **Step 1: Criar workspace e arquivos de repo**

`Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = ["crates/livrepdf-core", "crates/livrepdf-cli"]

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT"

[workspace.dependencies]
lopdf = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
```

`.gitignore`:

```gitignore
/target
node_modules/
/app/dist
/app/src-tauri/target
/app/src-tauri/gen/schemas
*.log
```

`.gitattributes`:

```gitattributes
* text=auto eol=lf
*.pdf binary
*.png binary
*.ico binary
*.icns binary
```

`LICENSE`: texto padrão MIT com `Copyright (c) 2026 LivrePDF contributors`.

`crates/livrepdf-core/Cargo.toml`:

```toml
[package]
name = "livrepdf-core"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
lopdf.workspace = true
serde.workspace = true
thiserror.workspace = true

[dev-dependencies]
serde_json.workspace = true
```

- [ ] **Step 2: Escrever `error.rs` e `text.rs` com testes que falham**

`crates/livrepdf-core/src/error.rs`:

```rust
use serde::Serialize;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Io,
    NotAPdf,
    DocumentNotFound,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{message}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), details: None }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::new(ErrorCode::Io, "Não foi possível acessar o arquivo").with_details(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_camel_case_with_screaming_code() {
        let err = AppError::new(ErrorCode::NotAPdf, "x").with_details("d");
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json, serde_json::json!({"code": "NOT_A_PDF", "message": "x", "details": "d"}));
    }

    #[test]
    fn io_error_maps_to_io_code() {
        let err: AppError = std::io::Error::new(std::io::ErrorKind::NotFound, "nope").into();
        assert_eq!(err.code, ErrorCode::Io);
        assert_eq!(err.details.as_deref(), Some("nope"));
    }
}
```

`crates/livrepdf-core/src/text.rs` (teste primeiro, função com corpo `todo!()` para ver falhar):

```rust
/// Decodifica uma "text string" PDF: UTF-16BE com BOM, UTF-8 com BOM,
/// ou PDFDocEncoding (aproximada por Latin-1).
pub fn decode_pdf_text(bytes: &[u8]) -> String {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::decode_pdf_text;

    #[test]
    fn decodes_utf16be_with_bom() {
        let bytes = [0xFE, 0xFF, 0x00, b'O', 0x00, b'l', 0x00, 0xE1];
        assert_eq!(decode_pdf_text(&bytes), "Olá");
    }

    #[test]
    fn decodes_utf8_with_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("ação".as_bytes());
        assert_eq!(decode_pdf_text(&bytes), "ação");
    }

    #[test]
    fn decodes_latin1_fallback() {
        assert_eq!(decode_pdf_text(&[b'C', 0xE9, b'u']), "Céu");
    }
}
```

`crates/livrepdf-core/src/lib.rs`:

```rust
mod error;
mod session;
mod store;
mod text;

#[doc(hidden)]
pub mod testing;

pub use error::{AppError, ErrorCode, Result};
pub use session::{DocumentInfo, DocumentSession, ReadOnlyReason};
pub use store::SessionStore;
pub use text::decode_pdf_text;
```

Criar `src/store.rs` vazio por enquanto (preenchido na Task 2) e `src/session.rs`/`src/testing.rs` conforme Step 4; para este step, deixe `lib.rs` só com `mod error; mod text; pub use ...` dos dois e adicione os demais no Step 4.

- [ ] **Step 3: Rodar e ver falhar, depois implementar `decode_pdf_text`**

Run: `cargo test -p livrepdf-core`
Expected: testes de `error` PASS; testes de `text` FAIL com `not yet implemented`.

Implementação:

```rust
pub fn decode_pdf_text(bytes: &[u8]) -> String {
    if let [0xFE, 0xFF, rest @ ..] = bytes {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&units);
    }
    if let [0xEF, 0xBB, 0xBF, rest @ ..] = bytes {
        return String::from_utf8_lossy(rest).into_owned();
    }
    bytes.iter().map(|&b| b as char).collect()
}
```

Run: `cargo test -p livrepdf-core`
Expected: PASS (5 testes).

- [ ] **Step 4: Escrever `testing.rs` e testes de `session.rs` que falham**

`crates/livrepdf-core/src/testing.rs`:

```rust
//! Geradores de PDF para testes (usados também por livrepdf-cli).
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

pub fn make_pdf(pages: &[&str]) -> Vec<u8> {
    save(build(pages, None))
}

pub fn make_pdf_with_title(pages: &[&str], title: &str) -> Vec<u8> {
    save(build(pages, Some(title)))
}

/// PDF com entrada /Encrypt no trailer (sem criptografia real) —
/// suficiente para a detecção de documento protegido.
pub fn make_encrypted_stub_pdf() -> Vec<u8> {
    let mut doc = build(&["secreto"], None);
    let encrypt_id = doc.add_object(dictionary! {
        "Filter" => "Standard",
        "V" => 4,
        "R" => 4,
        "Length" => 128,
        "P" => -4,
    });
    doc.trailer.set("Encrypt", encrypt_id);
    save(doc)
}

fn build(pages: &[&str], title: Option<&str>) -> Document {
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    });
    let kids: Vec<Object> = pages
        .iter()
        .map(|text| {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 24.into()]),
                    Operation::new("Td", vec![72.into(), 720.into()]),
                    Operation::new("Tj", vec![Object::string_literal(*text)]),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
            });
            page_id.into()
        })
        .collect();
    let count = kids.len() as i64;
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => count,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        }),
    );
    let catalog_id = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", catalog_id);
    if let Some(title) = title {
        let info_id = doc.add_object(dictionary! { "Title" => Object::string_literal(title) });
        doc.trailer.set("Info", info_id);
    }
    doc
}

fn save(mut doc: Document) -> Vec<u8> {
    let mut buf = Vec::new();
    doc.save_to(&mut buf).expect("save test pdf");
    buf
}
```

`crates/livrepdf-core/src/session.rs` (tipos + `todo!()` + testes):

```rust
use std::path::{Path, PathBuf};

use lopdf::{Document, Object};
use serde::Serialize;

use crate::error::{AppError, ErrorCode, Result};
use crate::text::decode_pdf_text;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReadOnlyReason {
    Encrypted,
    Unparseable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInfo {
    pub doc_id: String,
    pub path: Option<String>,
    pub file_name: String,
    pub page_count: Option<u32>,
    pub title: Option<String>,
    pub read_only_reason: Option<ReadOnlyReason>,
    pub size_bytes: u64,
}

pub struct DocumentSession {
    path: Option<PathBuf>,
    bytes: Vec<u8>,
    doc: Option<Document>,
    read_only_reason: Option<ReadOnlyReason>,
}

impl DocumentSession {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        todo!()
    }

    pub fn from_bytes(bytes: Vec<u8>, path: Option<PathBuf>) -> Result<Self> {
        todo!()
    }

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn read_only_reason(&self) -> Option<ReadOnlyReason> {
        self.read_only_reason
    }

    pub fn info(&self, doc_id: &str) -> DocumentInfo {
        todo!()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::{make_encrypted_stub_pdf, make_pdf, make_pdf_with_title};

    #[test]
    fn reads_page_count_and_title() {
        let bytes = make_pdf_with_title(&["um", "dois", "três"], "Relatório");
        let session = DocumentSession::from_bytes(bytes, Some(PathBuf::from("C:/x/rel.pdf"))).unwrap();
        let info = session.info("doc-1");
        assert_eq!(info.doc_id, "doc-1");
        assert_eq!(info.page_count, Some(3));
        assert_eq!(info.title.as_deref(), Some("Relatório"));
        assert_eq!(info.file_name, "rel.pdf");
        assert_eq!(info.read_only_reason, None);
        assert_eq!(info.size_bytes, session.bytes().len() as u64);
    }

    #[test]
    fn untitled_when_no_path_and_no_title() {
        let session = DocumentSession::from_bytes(make_pdf(&["a"]), None).unwrap();
        let info = session.info("doc-2");
        assert_eq!(info.file_name, "Sem título.pdf");
        assert_eq!(info.title, None);
        assert_eq!(info.path, None);
    }

    #[test]
    fn encrypted_is_read_only() {
        let session = DocumentSession::from_bytes(make_encrypted_stub_pdf(), None).unwrap();
        assert_eq!(session.read_only_reason(), Some(ReadOnlyReason::Encrypted));
        assert_eq!(session.info("d").page_count, None);
    }

    #[test]
    fn broken_pdf_is_read_only_unparseable() {
        let session = DocumentSession::from_bytes(b"%PDF-1.7\nlixo sem xref".to_vec(), None).unwrap();
        assert_eq!(session.read_only_reason(), Some(ReadOnlyReason::Unparseable));
    }

    #[test]
    fn rejects_non_pdf() {
        let err = DocumentSession::from_bytes(b"hello world".to_vec(), None).err().unwrap();
        assert_eq!(err.code, ErrorCode::NotAPdf);
    }

    #[test]
    fn open_reads_file_from_disk() {
        let dir = std::env::temp_dir().join(format!("livrepdf-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("a.pdf");
        std::fs::write(&path, make_pdf(&["x", "y"])).unwrap();
        let session = DocumentSession::open(&path).unwrap();
        assert_eq!(session.info("d").page_count, Some(2));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn open_missing_file_is_io_error() {
        let err = DocumentSession::open("C:/nao/existe.pdf").err().unwrap();
        assert_eq!(err.code, ErrorCode::Io);
    }
}
```

Atualizar `lib.rs` para a versão completa do Step 2 (com `mod session; mod store; pub mod testing;`). `store.rs` temporário:

```rust
#[derive(Default)]
pub struct SessionStore;
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `cargo test -p livrepdf-core session`
Expected: FAIL com `not yet implemented`.

- [ ] **Step 6: Implementar `DocumentSession`**

Substituir os três `todo!()` e adicionar helpers no fim do arquivo (antes de `mod tests`):

```rust
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let bytes = std::fs::read(path)?;
        Self::from_bytes(bytes, Some(path.to_path_buf()))
    }

    pub fn from_bytes(bytes: Vec<u8>, path: Option<PathBuf>) -> Result<Self> {
        if !has_pdf_header(&bytes) {
            return Err(AppError::new(ErrorCode::NotAPdf, "O arquivo não é um PDF válido"));
        }
        // Fase 1: documentos protegidos ficam só leitura (PDF.js decripta para exibir).
        // A Fase 6 substitui esta detecção pelo qpdf.
        if contains(&bytes, b"/Encrypt") {
            return Ok(Self { path, bytes, doc: None, read_only_reason: Some(ReadOnlyReason::Encrypted) });
        }
        match Document::load_mem(&bytes) {
            Ok(doc) => Ok(Self { path, bytes, doc: Some(doc), read_only_reason: None }),
            Err(_) => Ok(Self { path, bytes, doc: None, read_only_reason: Some(ReadOnlyReason::Unparseable) }),
        }
    }

    pub fn info(&self, doc_id: &str) -> DocumentInfo {
        DocumentInfo {
            doc_id: doc_id.to_string(),
            path: self.path.as_ref().map(|p| p.to_string_lossy().into_owned()),
            file_name: self
                .path
                .as_ref()
                .and_then(|p| p.file_name())
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "Sem título.pdf".to_string()),
            page_count: self.doc.as_ref().map(|d| d.get_pages().len() as u32),
            title: self.doc.as_ref().and_then(read_title),
            read_only_reason: self.read_only_reason,
            size_bytes: self.bytes.len() as u64,
        }
    }
```

```rust
fn has_pdf_header(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(1024)];
    contains(head, b"%PDF-")
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

fn read_title(doc: &Document) -> Option<String> {
    let info = doc.trailer.get(b"Info").ok()?;
    let dict = match info {
        Object::Reference(id) => doc.get_object(*id).ok()?.as_dict().ok()?,
        Object::Dictionary(d) => d,
        _ => return None,
    };
    let raw = dict.get(b"Title").ok()?.as_str().ok()?;
    let title = decode_pdf_text(raw);
    if title.trim().is_empty() { None } else { Some(title) }
}
```

Nota: se a versão resolvida do `lopdf` tiver assinatura diferente para `as_str`/`get_object`, ajuste conforme `cargo doc -p lopdf --open` — o comportamento esperado é o dos testes.

- [ ] **Step 7: Rodar testes**

Run: `cargo test -p livrepdf-core`
Expected: PASS (12 testes).

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml Cargo.lock .gitignore .gitattributes LICENSE crates/livrepdf-core
git commit -m "feat(core): document session with metadata and read-only detection"
```

---

### Task 2: `SessionStore`

**Files:**
- Modify: `crates/livrepdf-core/src/store.rs`

**Interfaces:**
- Consumes: `DocumentSession`, `AppError`, `ErrorCode::DocumentNotFound`
- Produces: `SessionStore::default()`, `.insert(DocumentSession) -> String` (ids `"doc-1"`, `"doc-2"`…), `.get(&str) -> Result<&DocumentSession>`, `.remove(&str) -> Result<()>`, `.len() -> usize`

- [ ] **Step 1: Testes que falham**

```rust
use std::collections::HashMap;

use crate::error::{AppError, ErrorCode, Result};
use crate::session::DocumentSession;

#[derive(Default)]
pub struct SessionStore {
    next_id: u64,
    sessions: HashMap<String, DocumentSession>,
}

impl SessionStore {
    pub fn insert(&mut self, session: DocumentSession) -> String {
        todo!()
    }

    pub fn get(&self, doc_id: &str) -> Result<&DocumentSession> {
        todo!()
    }

    pub fn remove(&mut self, doc_id: &str) -> Result<()> {
        todo!()
    }

    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::make_pdf;

    fn session() -> DocumentSession {
        DocumentSession::from_bytes(make_pdf(&["a"]), None).unwrap()
    }

    #[test]
    fn insert_assigns_sequential_ids() {
        let mut store = SessionStore::default();
        assert_eq!(store.insert(session()), "doc-1");
        assert_eq!(store.insert(session()), "doc-2");
        assert_eq!(store.len(), 2);
    }

    #[test]
    fn get_and_remove() {
        let mut store = SessionStore::default();
        let id = store.insert(session());
        assert!(store.get(&id).is_ok());
        store.remove(&id).unwrap();
        assert_eq!(store.get(&id).err().unwrap().code, ErrorCode::DocumentNotFound);
        assert_eq!(store.remove(&id).err().unwrap().code, ErrorCode::DocumentNotFound);
    }

    #[test]
    fn ids_are_not_reused_after_remove() {
        let mut store = SessionStore::default();
        let first = store.insert(session());
        store.remove(&first).unwrap();
        assert_eq!(store.insert(session()), "doc-2");
    }
}
```

- [ ] **Step 2: Ver falhar**

Run: `cargo test -p livrepdf-core store`
Expected: FAIL `not yet implemented`.

- [ ] **Step 3: Implementar**

```rust
    pub fn insert(&mut self, session: DocumentSession) -> String {
        self.next_id += 1;
        let id = format!("doc-{}", self.next_id);
        self.sessions.insert(id.clone(), session);
        id
    }

    pub fn get(&self, doc_id: &str) -> Result<&DocumentSession> {
        self.sessions.get(doc_id).ok_or_else(|| not_found(doc_id))
    }

    pub fn remove(&mut self, doc_id: &str) -> Result<()> {
        self.sessions.remove(doc_id).map(|_| ()).ok_or_else(|| not_found(doc_id))
    }
```

```rust
fn not_found(doc_id: &str) -> AppError {
    AppError::new(ErrorCode::DocumentNotFound, "Documento não está aberto").with_details(doc_id)
}
```

- [ ] **Step 4: Rodar**

Run: `cargo test -p livrepdf-core`
Expected: PASS (15 testes).

- [ ] **Step 5: Commit**

```bash
git add crates/livrepdf-core/src/store.rs
git commit -m "feat(core): session store keyed by document id"
```

---

### Task 3: `livrepdf-cli info`

**Files:**
- Create: `crates/livrepdf-cli/Cargo.toml`, `crates/livrepdf-cli/src/main.rs`, `crates/livrepdf-cli/tests/info.rs`

**Interfaces:**
- Consumes: `DocumentSession::open`, `.info`, `livrepdf_core::testing::make_pdf_with_title`
- Produces: binário `livrepdf-cli` com `info <arquivo>` → JSON de `DocumentInfo` (docId `"cli"`) em stdout; erro → JSON de `AppError` em stderr e exit code 1.

- [ ] **Step 1: Cargo.toml**

```toml
[package]
name = "livrepdf-cli"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
livrepdf-core = { path = "../livrepdf-core" }
clap = { version = "4", features = ["derive"] }
serde_json.workspace = true

[dev-dependencies]
assert_cmd = "2"
tempfile = "3"
```

- [ ] **Step 2: Teste de integração que falha**

`crates/livrepdf-cli/tests/info.rs`:

```rust
use assert_cmd::Command;
use livrepdf_core::testing::make_pdf_with_title;

#[test]
fn info_prints_document_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("doc.pdf");
    std::fs::write(&path, make_pdf_with_title(&["a", "b"], "Teste")).unwrap();

    let out = Command::cargo_bin("livrepdf-cli").unwrap().arg("info").arg(&path).assert().success();
    let json: serde_json::Value = serde_json::from_slice(&out.get_output().stdout).unwrap();
    assert_eq!(json["pageCount"], 2);
    assert_eq!(json["title"], "Teste");
    assert_eq!(json["fileName"], "doc.pdf");
}

#[test]
fn info_reports_error_json_and_exit_1() {
    let out = Command::cargo_bin("livrepdf-cli").unwrap().args(["info", "nao-existe.pdf"]).assert().code(1);
    let json: serde_json::Value = serde_json::from_slice(&out.get_output().stderr).unwrap();
    assert_eq!(json["code"], "IO");
}
```

Criar `src/main.rs` mínimo: `fn main() {}`.

Run: `cargo test -p livrepdf-cli`
Expected: FAIL (saída vazia / exit code errado).

- [ ] **Step 3: Implementar**

```rust
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use livrepdf_core::DocumentSession;

#[derive(Parser)]
#[command(name = "livrepdf-cli", version, about = "Ferramentas de linha de comando do LivrePDF")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Mostra metadados do PDF em JSON
    Info { file: PathBuf },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Info { file } => match DocumentSession::open(&file) {
            Ok(session) => {
                println!("{}", serde_json::to_string_pretty(&session.info("cli")).unwrap());
                ExitCode::SUCCESS
            }
            Err(err) => {
                eprintln!("{}", serde_json::to_string(&err).unwrap());
                ExitCode::FAILURE
            }
        },
    }
}
```

- [ ] **Step 4: Rodar**

Run: `cargo test --workspace`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/livrepdf-cli Cargo.lock
git commit -m "feat(cli): info command printing document metadata"
```

---

### Task 4: Shell Tauri com comandos IPC

**Files:**
- Create (via scaffold, depois sobrescritos): `app/**`
- Overwrite: `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/capabilities/default.json`, `app/src-tauri/src/main.rs`, `app/src-tauri/src/lib.rs`
- Modify: `Cargo.toml` (workspace members)

**Interfaces:**
- Consumes: `SessionStore`, `DocumentSession`, `DocumentInfo`, `AppError`
- Produces (comandos Tauri, args em camelCase no JS):
  - `open_document({ path: string }) -> DocumentInfo`
  - `get_document_bytes({ docId: string }) -> ArrayBuffer`
  - `close_document({ docId: string }) -> null`
  - `initial_files() -> string[]` (PDFs passados na linha de comando)
  - `print_page() -> null` (abre diálogo de impressão do webview)
  - evento `"open-files"` com payload `string[]` (segunda instância)
  - `livrepdf_app_lib::pdf_args(impl IntoIterator<Item = String>) -> Vec<String>`

- [ ] **Step 1: Scaffold**

```bash
cd /c/Users/cassiano.soares/pdf
pnpm create tauri-app@latest app --template react-ts --manager pnpm --identifier org.livrepdf.app --yes
cd app && pnpm install
pnpm add @tauri-apps/plugin-dialog
```

Se o scaffold perguntar algo apesar de `--yes`, escolha: TypeScript / pnpm / React / TypeScript.

Apagar `app/src-tauri/.gitignore` se duplicar regras do `.gitignore` raiz (manter caso contrário). Remover `app/src/App.css` e `app/src/assets` gerados.

- [ ] **Step 2: Adicionar ao workspace**

`Cargo.toml` raiz:

```toml
members = ["crates/livrepdf-core", "crates/livrepdf-cli", "app/src-tauri"]
```

- [ ] **Step 3: Sobrescrever `app/src-tauri/Cargo.toml`**

```toml
[package]
name = "livrepdf-app"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "LivrePDF — editor de PDF livre"

[lib]
name = "livrepdf_app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
livrepdf-core = { path = "../../crates/livrepdf-core" }
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-single-instance = "2"
serde.workspace = true
serde_json.workspace = true
```

- [ ] **Step 4: `tauri.conf.json` e capabilities**

`app/src-tauri/tauri.conf.json` (mantenha a lista `icon` gerada pelo scaffold se os nomes diferirem):

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "LivrePDF",
  "version": "0.1.0",
  "identifier": "org.livrepdf.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "LivrePDF",
        "width": 1280,
        "height": 860,
        "minWidth": 720,
        "minHeight": 480,
        "dragDropEnabled": true
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "fileAssociations": [
      {
        "ext": ["pdf"],
        "mimeType": "application/pdf",
        "description": "Documento PDF",
        "role": "Editor"
      }
    ]
  }
}
```

`app/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Permissões da janela principal",
  "windows": ["main"],
  "permissions": ["core:default", "dialog:default"]
}
```

- [ ] **Step 5: `main.rs` e `lib.rs` com teste de `pdf_args`**

`app/src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    livrepdf_app_lib::run()
}
```

`app/src-tauri/src/lib.rs`:

```rust
use std::sync::Mutex;

use livrepdf_core::{AppError, DocumentInfo, DocumentSession, SessionStore};
use tauri::{Emitter, Manager, State};

#[derive(Default)]
struct AppState(Mutex<SessionStore>);

/// Filtra argumentos de linha de comando que são caminhos de PDF.
pub fn pdf_args(args: impl IntoIterator<Item = String>) -> Vec<String> {
    args.into_iter()
        .filter(|a| a.to_lowercase().ends_with(".pdf"))
        .collect()
}

#[tauri::command]
fn open_document(path: String, state: State<AppState>) -> Result<DocumentInfo, AppError> {
    let session = DocumentSession::open(&path)?;
    let mut store = state.0.lock().expect("session store poisoned");
    let id = store.insert(session);
    Ok(store.get(&id)?.info(&id))
}

#[tauri::command]
fn get_document_bytes(doc_id: String, state: State<AppState>) -> Result<tauri::ipc::Response, AppError> {
    let store = state.0.lock().expect("session store poisoned");
    Ok(tauri::ipc::Response::new(store.get(&doc_id)?.bytes().to_vec()))
}

#[tauri::command]
fn close_document(doc_id: String, state: State<AppState>) -> Result<(), AppError> {
    state.0.lock().expect("session store poisoned").remove(&doc_id)
}

#[tauri::command]
fn initial_files() -> Vec<String> {
    pdf_args(std::env::args().skip(1))
}

#[tauri::command]
fn print_page(webview: tauri::Webview) -> Result<(), String> {
    webview.print().map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files = pdf_args(argv.into_iter().skip(1));
            let _ = app.emit("open-files", files);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_document,
            get_document_bytes,
            close_document,
            initial_files,
            print_page
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LivrePDF");
}

#[cfg(test)]
mod tests {
    use super::pdf_args;

    #[test]
    fn keeps_only_pdf_paths_case_insensitive() {
        let args = vec!["--flag".to_string(), "C:/a/Doc.PDF".to_string(), "x.txt".to_string(), "b.pdf".to_string()];
        assert_eq!(pdf_args(args), vec!["C:/a/Doc.PDF".to_string(), "b.pdf".to_string()]);
    }
}
```

- [ ] **Step 6: Build e testes**

`generate_context!` exige `app/dist` existente:

```bash
cd /c/Users/cassiano.soares/pdf/app && pnpm build && cd .. && cargo test --workspace
```

Expected: PASS (inclui `keeps_only_pdf_paths_case_insensitive`). Se `webview.print()` não existir na versão do Tauri resolvida, consulte a doc (context7 `tauri`) pelo método de impressão do `Webview`/`WebviewWindow` e ajuste só esse comando.

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml Cargo.lock app
git commit -m "feat(app): tauri shell with document IPC commands"
```

---

### Task 5: Base da UI: dependências, Vitest, fixture, `ipc.ts`, `pdfEngine.ts`

**Files:**
- Overwrite: `app/package.json` (scripts/deps), `app/vite.config.ts`, `app/index.html`
- Create: `app/src/test/setup.ts`, `app/src/test/makePdf.ts`, `app/src/lib/ipc.ts`, `app/src/lib/ipc.test.ts`, `app/src/lib/pdfEngine.ts`, `app/src/lib/pdfEngine.test.ts`, `app/src/lib/errors.ts`, `app/src/lib/errors.test.ts`

**Interfaces:**
- Consumes: comandos da Task 4.
- Produces:
  - `ipc.ts`: `type ReadOnlyReason = "encrypted" | "unparseable"`, `interface DocumentInfo { docId; path: string | null; fileName; pageCount: number | null; title: string | null; readOnlyReason: ReadOnlyReason | null; sizeBytes: number }`, `interface AppError { code: string; message: string; details: string | null }`, `isAppError(e): e is AppError`, `openDocument(path): Promise<DocumentInfo>`, `getDocumentBytes(docId): Promise<Uint8Array>`, `closeDocument(docId): Promise<void>`, `initialFiles(): Promise<string[]>`, `printPage(): Promise<void>`
  - `pdfEngine.ts`: `loadPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy>`, `class PasswordRequiredError extends Error { incorrect: boolean }`
  - `errors.ts`: `errorMessage(e: unknown): string`
  - `test/makePdf.ts`: `makePdf({ pages: string[]; outline?: { title: string; page: number }[]; title?: string }): Uint8Array`

- [ ] **Step 1: Dependências**

```bash
cd /c/Users/cassiano.soares/pdf/app
pnpm add pdfjs-dist zustand
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @napi-rs/canvas
```

Em `app/package.json`, scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "tauri": "tauri"
}
```

- [ ] **Step 2: `vite.config.ts` com Vitest**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // No Node, usar o build legacy do PDF.js (sem worker de browser).
    alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }],
  },
});
```

`app/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`app/index.html` (substituir corpo):

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LivrePDF</title>
  </head>
  <body>
    <div id="root"></div>
    <div id="print-root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Fixture `makePdf`**

`app/src/test/makePdf.ts`:

```ts
export interface FixtureOptions {
  pages: string[];
  outline?: { title: string; page: number }[];
  title?: string;
}

const esc = (s: string) => s.replace(/[\\()]/g, (m) => "\\" + m);

/** Gera um PDF mínimo e válido (somente ASCII) para testes. */
export function makePdf({ pages, outline = [], title }: FixtureOptions): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body);
  const reserve = () => objs.push("");

  const catalog = reserve();
  const pagesId = reserve();
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = pages.map((text) => {
    const content = `BT /F1 24 Tf 72 720 Td (${esc(text)}) Tj ET`;
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    return add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`,
    );
  });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let outlinesRef = "";
  if (outline.length > 0) {
    const root = reserve();
    const items = outline.map(() => reserve());
    items.forEach((id, i) => {
      const parts = [
        `/Title (${esc(outline[i].title)})`,
        `/Parent ${root} 0 R`,
        `/Dest [${pageIds[outline[i].page]} 0 R /Fit]`,
      ];
      if (i > 0) parts.push(`/Prev ${items[i - 1]} 0 R`);
      if (i < items.length - 1) parts.push(`/Next ${items[i + 1]} 0 R`);
      objs[id - 1] = `<< ${parts.join(" ")} >>`;
    });
    objs[root - 1] = `<< /Type /Outlines /First ${items[0]} 0 R /Last ${items[items.length - 1]} 0 R /Count ${items.length} >>`;
    outlinesRef = ` /Outlines ${root} 0 R`;
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesRef} >>`;
  const info = title ? add(`<< /Title (${esc(title)}) >>`) : null;

  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ""} >>\n`;
  out += `startxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
```

- [ ] **Step 4: Testes de `ipc.ts`, `errors.ts`, `pdfEngine.ts` (falham)**

`app/src/lib/ipc.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { closeDocument, getDocumentBytes, isAppError, openDocument } from "./ipc";

describe("ipc", () => {
  beforeEach(() => invoke.mockReset());

  it("openDocument passes path", async () => {
    invoke.mockResolvedValue({ docId: "doc-1" });
    await openDocument("C:/a.pdf");
    expect(invoke).toHaveBeenCalledWith("open_document", { path: "C:/a.pdf" });
  });

  it("getDocumentBytes wraps ArrayBuffer in Uint8Array", async () => {
    invoke.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const bytes = await getDocumentBytes("doc-1");
    expect(invoke).toHaveBeenCalledWith("get_document_bytes", { docId: "doc-1" });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("closeDocument passes docId", async () => {
    invoke.mockResolvedValue(null);
    await closeDocument("doc-9");
    expect(invoke).toHaveBeenCalledWith("close_document", { docId: "doc-9" });
  });

  it("isAppError recognizes core errors", () => {
    expect(isAppError({ code: "IO", message: "x", details: null })).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
  });
});
```

`app/src/lib/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("uses AppError message", () => {
    expect(errorMessage({ code: "IO", message: "Falhou", details: null })).toBe("Falhou");
  });
  it("uses Error message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("stringifies anything else", () => {
    expect(errorMessage("texto")).toBe("texto");
  });
});
```

`app/src/lib/pdfEngine.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "./pdfEngine";

describe("loadPdf", () => {
  it("loads page count from bytes", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a", "b", "c"] }));
    expect(pdf.numPages).toBe(3);
    await pdf.destroy();
  });

  it("does not detach the caller's buffer", async () => {
    const bytes = makePdf({ pages: ["a"] });
    const pdf = await loadPdf(bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await pdf.destroy();
  });
});
```

Run: `cd app && pnpm test`
Expected: FAIL (módulos `./ipc`, `./errors`, `./pdfEngine` inexistentes).

- [ ] **Step 5: Implementar**

`app/src/lib/ipc.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

export type ReadOnlyReason = "encrypted" | "unparseable";

export interface DocumentInfo {
  docId: string;
  path: string | null;
  fileName: string;
  pageCount: number | null;
  title: string | null;
  readOnlyReason: ReadOnlyReason | null;
  sizeBytes: number;
}

export interface AppError {
  code: string;
  message: string;
  details: string | null;
}

export function isAppError(e: unknown): e is AppError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e && !(e instanceof Error);
}

export const openDocument = (path: string) => invoke<DocumentInfo>("open_document", { path });

export async function getDocumentBytes(docId: string): Promise<Uint8Array> {
  const buf = await invoke<ArrayBuffer>("get_document_bytes", { docId });
  return new Uint8Array(buf);
}

export const closeDocument = (docId: string) => invoke<void>("close_document", { docId });

export const initialFiles = () => invoke<string[]>("initial_files");

export const printPage = () => invoke<void>("print_page");
```

`app/src/lib/errors.ts`:

```ts
import { isAppError } from "./ipc";

export function errorMessage(e: unknown): string {
  if (isAppError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
```

`app/src/lib/pdfEngine.ts`:

```ts
import { getDocument, PasswordResponses, type PDFDocumentProxy } from "pdfjs-dist";

export class PasswordRequiredError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? "Senha incorreta" : "Este documento exige senha");
    this.name = "PasswordRequiredError";
  }
}

export async function loadPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  try {
    // PDF.js transfere o buffer para o worker; passamos uma cópia.
    return await getDocument({ data: bytes.slice(), password }).promise;
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { name?: string }).name === "PasswordException") {
      const code = (e as { code?: number }).code;
      throw new PasswordRequiredError(code === PasswordResponses.INCORRECT_PASSWORD);
    }
    throw e;
  }
}
```

- [ ] **Step 6: Rodar**

Run: `cd app && pnpm test`
Expected: PASS (9 testes). Aviso do PDF.js sobre fontes padrão em Node é aceitável.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat(ui): typed IPC wrappers, PDF.js loader and test fixture"
```

---

### Task 6: Estado: `documents`, `notices`, `passwordPrompt` + lógica de zoom

**Files:**
- Create: `app/src/viewer/zoom.ts`, `app/src/viewer/zoom.test.ts`, `app/src/store/documents.ts`, `app/src/store/documents.test.ts`, `app/src/store/notices.ts`, `app/src/store/passwordPrompt.ts`, `app/src/store/passwordPrompt.test.ts`

**Interfaces:**
- Consumes: `DocumentInfo`, `PDFDocumentProxy`
- Produces:
  - `zoom.ts`: `PDF_TO_CSS = 96 / 72`, `type FitMode = "custom" | "width" | "page"`, `type Rotation = 0 | 90 | 180 | 270`, `computeScale(p: { fitMode; zoom; pageWidth; pageHeight; rotation; containerWidth; containerHeight }): number`, `ZOOM_STEPS: number[]`, `nextZoom(current: number, dir: 1 | -1): number`, `rotate(r: Rotation, dir: 1 | -1): Rotation`
  - `documents.ts`: `type ViewMode = "continuous" | "single"`, `interface PageMatch { pageIndex: number; itemIndices: number[] }`, `interface SearchState { query: string; matches: PageMatch[]; active: number }`, `interface Tab { info; pdf; zoom; fitMode; rotation; viewMode; currentPage; gotoPage: number | null; search: SearchState }`, `type TabPatch = Partial<Omit<Tab, "info" | "pdf">>`, `useDocuments` (Zustand) com `tabs, activeId, sidebarOpen, searchOpen, addTab(info, pdf), closeTab(docId), setActive(docId), updateTab(docId, patch), toggleSidebar(), setSearchOpen(open)`, `selectActiveTab(state): Tab | null`
  - `notices.ts`: `useNotices` com `notices: { id: number; kind: "error" | "info"; text: string }[]`, `push(kind, text)`, `dismiss(id)`
  - `passwordPrompt.ts`: `usePasswordPrompt` com `open, incorrect, fileName, ask(fileName, incorrect): Promise<string | null>, answer(value: string | null)`

- [ ] **Step 1: Testes de zoom (falham)**

`app/src/viewer/zoom.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PDF_TO_CSS, computeScale, nextZoom, rotate } from "./zoom";

const base = { zoom: 1.5, pageWidth: 612, pageHeight: 792, rotation: 0 as const, containerWidth: 1000, containerHeight: 800 };

describe("computeScale", () => {
  it("custom returns zoom", () => {
    expect(computeScale({ ...base, fitMode: "custom" })).toBe(1.5);
  });
  it("width fits container width minus padding", () => {
    expect(computeScale({ ...base, fitMode: "width" })).toBeCloseTo((1000 - 32) / (612 * PDF_TO_CSS));
  });
  it("page fits the smaller dimension", () => {
    expect(computeScale({ ...base, fitMode: "page" })).toBeCloseTo((800 - 32) / (792 * PDF_TO_CSS));
  });
  it("rotation 90 swaps page dimensions", () => {
    expect(computeScale({ ...base, fitMode: "width", rotation: 90 })).toBeCloseTo((1000 - 32) / (792 * PDF_TO_CSS));
  });
  it("never returns non-positive scale", () => {
    expect(computeScale({ ...base, fitMode: "width", containerWidth: 0 })).toBeGreaterThan(0);
  });
});

describe("nextZoom", () => {
  it("steps up and down through ZOOM_STEPS", () => {
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1, -1)).toBe(0.75);
  });
  it("snaps from in-between values", () => {
    expect(nextZoom(1.1, 1)).toBe(1.25);
    expect(nextZoom(1.1, -1)).toBe(1);
  });
  it("clamps at the ends", () => {
    expect(nextZoom(4, 1)).toBe(4);
    expect(nextZoom(0.25, -1)).toBe(0.25);
  });
});

describe("rotate", () => {
  it("wraps around", () => {
    expect(rotate(270, 1)).toBe(0);
    expect(rotate(0, -1)).toBe(270);
  });
});
```

- [ ] **Step 2: Testes de store (falham)**

`app/src/store/documents.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentInfo } from "../lib/ipc";
import { selectActiveTab, useDocuments } from "./documents";

const info = (docId: string): DocumentInfo => ({
  docId, path: `C:/${docId}.pdf`, fileName: `${docId}.pdf`, pageCount: 2, title: null, readOnlyReason: null, sizeBytes: 10,
});
const pdf = {} as PDFDocumentProxy;

describe("documents store", () => {
  beforeEach(() => useDocuments.setState({ tabs: [], activeId: null, sidebarOpen: true, searchOpen: false }));

  it("addTab activates new tab with defaults", () => {
    useDocuments.getState().addTab(info("doc-1"), pdf);
    const tab = selectActiveTab(useDocuments.getState())!;
    expect(tab.info.docId).toBe("doc-1");
    expect(tab.fitMode).toBe("width");
    expect(tab.currentPage).toBe(0);
    expect(tab.search).toEqual({ query: "", matches: [], active: 0 });
  });

  it("closeTab activates the neighbour", () => {
    const s = useDocuments.getState();
    s.addTab(info("doc-1"), pdf);
    s.addTab(info("doc-2"), pdf);
    s.addTab(info("doc-3"), pdf);
    s.setActive("doc-2");
    useDocuments.getState().closeTab("doc-2");
    expect(useDocuments.getState().activeId).toBe("doc-3");
    useDocuments.getState().closeTab("doc-3");
    expect(useDocuments.getState().activeId).toBe("doc-1");
    useDocuments.getState().closeTab("doc-1");
    expect(useDocuments.getState().activeId).toBeNull();
  });

  it("updateTab patches only the target tab", () => {
    const s = useDocuments.getState();
    s.addTab(info("doc-1"), pdf);
    s.addTab(info("doc-2"), pdf);
    useDocuments.getState().updateTab("doc-1", { zoom: 2, fitMode: "custom" });
    const [a, b] = useDocuments.getState().tabs;
    expect(a.zoom).toBe(2);
    expect(a.fitMode).toBe("custom");
    expect(b.zoom).toBe(1);
  });
});
```

`app/src/store/passwordPrompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { usePasswordPrompt } from "./passwordPrompt";

describe("password prompt", () => {
  it("ask resolves with the answer and closes", async () => {
    const p = usePasswordPrompt.getState().ask("a.pdf", false);
    expect(usePasswordPrompt.getState().open).toBe(true);
    expect(usePasswordPrompt.getState().fileName).toBe("a.pdf");
    usePasswordPrompt.getState().answer("segredo");
    await expect(p).resolves.toBe("segredo");
    expect(usePasswordPrompt.getState().open).toBe(false);
  });

  it("cancel resolves null", async () => {
    const p = usePasswordPrompt.getState().ask("a.pdf", true);
    expect(usePasswordPrompt.getState().incorrect).toBe(true);
    usePasswordPrompt.getState().answer(null);
    await expect(p).resolves.toBeNull();
  });
});
```

Run: `cd app && pnpm test`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `zoom.ts`**

```ts
/** PDF.js usa 1 unidade = 1px CSS; 100% deve corresponder ao tamanho impresso (96dpi / 72pt). */
export const PDF_TO_CSS = 96 / 72;

export type FitMode = "custom" | "width" | "page";
export type Rotation = 0 | 90 | 180 | 270;

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PADDING = 32;
const MIN_SCALE = 0.1;

export interface ScaleParams {
  fitMode: FitMode;
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  rotation: Rotation;
  containerWidth: number;
  containerHeight: number;
}

export function computeScale(p: ScaleParams): number {
  const sideways = p.rotation % 180 !== 0;
  const w = (sideways ? p.pageHeight : p.pageWidth) * PDF_TO_CSS;
  const h = (sideways ? p.pageWidth : p.pageHeight) * PDF_TO_CSS;
  const byWidth = (p.containerWidth - PADDING) / w;
  const byHeight = (p.containerHeight - PADDING) / h;
  const scale = p.fitMode === "width" ? byWidth : p.fitMode === "page" ? Math.min(byWidth, byHeight) : p.zoom;
  return Math.max(MIN_SCALE, scale);
}

export function nextZoom(current: number, dir: 1 | -1): number {
  if (dir === 1) return ZOOM_STEPS.find((s) => s > current + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-6) ?? ZOOM_STEPS[0];
}

export function rotate(r: Rotation, dir: 1 | -1): Rotation {
  return ((((r + dir * 90) % 360) + 360) % 360) as Rotation;
}
```

- [ ] **Step 4: Implementar stores**

`app/src/store/documents.ts`:

```ts
import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentInfo } from "../lib/ipc";
import type { FitMode, Rotation } from "../viewer/zoom";

export type ViewMode = "continuous" | "single";

export interface PageMatch {
  pageIndex: number;
  itemIndices: number[];
}

export interface SearchState {
  query: string;
  matches: PageMatch[];
  active: number;
}

export interface Tab {
  info: DocumentInfo;
  pdf: PDFDocumentProxy;
  zoom: number;
  fitMode: FitMode;
  rotation: Rotation;
  viewMode: ViewMode;
  currentPage: number;
  gotoPage: number | null;
  search: SearchState;
}

export type TabPatch = Partial<Omit<Tab, "info" | "pdf">>;

interface DocumentsState {
  tabs: Tab[];
  activeId: string | null;
  sidebarOpen: boolean;
  searchOpen: boolean;
  addTab(info: DocumentInfo, pdf: PDFDocumentProxy): void;
  closeTab(docId: string): void;
  setActive(docId: string): void;
  updateTab(docId: string, patch: TabPatch): void;
  toggleSidebar(): void;
  setSearchOpen(open: boolean): void;
}

export const useDocuments = create<DocumentsState>()((set) => ({
  tabs: [],
  activeId: null,
  sidebarOpen: true,
  searchOpen: false,
  addTab: (info, pdf) =>
    set((s) => ({
      tabs: [
        ...s.tabs,
        {
          info, pdf, zoom: 1, fitMode: "width", rotation: 0, viewMode: "continuous",
          currentPage: 0, gotoPage: null, search: { query: "", matches: [], active: 0 },
        },
      ],
      activeId: info.docId,
    })),
  closeTab: (docId) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.info.docId === docId);
      if (index < 0) return s;
      const tabs = s.tabs.filter((t) => t.info.docId !== docId);
      let activeId = s.activeId;
      if (activeId === docId) activeId = (tabs[index] ?? tabs[index - 1])?.info.docId ?? null;
      return { tabs, activeId };
    }),
  setActive: (docId) => set({ activeId: docId }),
  updateTab: (docId, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.info.docId === docId ? { ...t, ...patch } : t)) })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
}));

export const selectActiveTab = (s: Pick<DocumentsState, "tabs" | "activeId">): Tab | null =>
  s.tabs.find((t) => t.info.docId === s.activeId) ?? null;
```

`app/src/store/notices.ts`:

```ts
import { create } from "zustand";

export interface Notice {
  id: number;
  kind: "error" | "info";
  text: string;
}

interface NoticesState {
  notices: Notice[];
  push(kind: Notice["kind"], text: string): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useNotices = create<NoticesState>()((set) => ({
  notices: [],
  push: (kind, text) => set((s) => ({ notices: [...s.notices, { id: nextId++, kind, text }] })),
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
```

`app/src/store/passwordPrompt.ts`:

```ts
import { create } from "zustand";

interface PasswordPromptState {
  open: boolean;
  incorrect: boolean;
  fileName: string;
  resolve: ((value: string | null) => void) | null;
  ask(fileName: string, incorrect: boolean): Promise<string | null>;
  answer(value: string | null): void;
}

export const usePasswordPrompt = create<PasswordPromptState>()((set, get) => ({
  open: false,
  incorrect: false,
  fileName: "",
  resolve: null,
  ask: (fileName, incorrect) =>
    new Promise((resolve) => set({ open: true, incorrect, fileName, resolve })),
  answer: (value) => {
    get().resolve?.(value);
    set({ open: false, resolve: null });
  },
}));
```

- [ ] **Step 5: Rodar**

Run: `cd app && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src
git commit -m "feat(ui): document, notice and password stores with zoom logic"
```

---

### Task 7: Abrir/fechar orquestrado (`openFile.ts`)

**Files:**
- Create: `app/src/app/openFile.ts`, `app/src/app/openFile.test.ts`

**Interfaces:**
- Consumes: `openDocument`, `getDocumentBytes`, `closeDocument` (ipc), `loadPdf`, `PasswordRequiredError`, `useDocuments`
- Produces:
  - `openFile(path: string, askPassword: (fileName: string, incorrect: boolean) => Promise<string | null>): Promise<"opened" | "already-open" | "cancelled">`
  - `closeFile(docId: string): Promise<void>` (destroi o PDF.js, fecha sessão no core, remove aba)

- [ ] **Step 1: Testes (falham)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentInfo } from "../lib/ipc";

const ipc = vi.hoisted(() => ({
  openDocument: vi.fn(),
  getDocumentBytes: vi.fn(),
  closeDocument: vi.fn(),
}));
const engine = vi.hoisted(() => ({ loadPdf: vi.fn() }));
vi.mock("../lib/ipc", () => ipc);
vi.mock("../lib/pdfEngine", async () => {
  class PasswordRequiredError extends Error {
    constructor(public readonly incorrect: boolean) { super("pw"); }
  }
  return { loadPdf: engine.loadPdf, PasswordRequiredError };
});

import { PasswordRequiredError } from "../lib/pdfEngine";
import { useDocuments } from "../store/documents";
import { closeFile, openFile } from "./openFile";

const info: DocumentInfo = {
  docId: "doc-1", path: "C:/a.pdf", fileName: "a.pdf", pageCount: 1, title: null, readOnlyReason: null, sizeBytes: 1,
};
const fakePdf = { destroy: vi.fn().mockResolvedValue(undefined) };

describe("openFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null });
    ipc.openDocument.mockResolvedValue(info);
    ipc.getDocumentBytes.mockResolvedValue(new Uint8Array([1]));
    ipc.closeDocument.mockResolvedValue(undefined);
  });

  it("opens and adds a tab", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await expect(openFile("C:/a.pdf", vi.fn())).resolves.toBe("opened");
    expect(useDocuments.getState().tabs).toHaveLength(1);
  });

  it("activates existing tab for same path without reopening", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await openFile("C:/a.pdf", vi.fn());
    await expect(openFile("C:/a.pdf", vi.fn())).resolves.toBe("already-open");
    expect(ipc.openDocument).toHaveBeenCalledTimes(1);
  });

  it("asks for password and retries", async () => {
    engine.loadPdf
      .mockRejectedValueOnce(new PasswordRequiredError(false))
      .mockRejectedValueOnce(new PasswordRequiredError(true))
      .mockResolvedValueOnce(fakePdf);
    const ask = vi.fn().mockResolvedValueOnce("errada").mockResolvedValueOnce("certa");
    await expect(openFile("C:/a.pdf", ask)).resolves.toBe("opened");
    expect(ask).toHaveBeenNthCalledWith(1, "a.pdf", false);
    expect(ask).toHaveBeenNthCalledWith(2, "a.pdf", true);
    expect(engine.loadPdf).toHaveBeenLastCalledWith(expect.any(Uint8Array), "certa");
  });

  it("cancelled password closes the core session", async () => {
    engine.loadPdf.mockRejectedValue(new PasswordRequiredError(false));
    await expect(openFile("C:/a.pdf", vi.fn().mockResolvedValue(null))).resolves.toBe("cancelled");
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
    expect(useDocuments.getState().tabs).toHaveLength(0);
  });

  it("render failure closes the core session and rethrows", async () => {
    engine.loadPdf.mockRejectedValue(new Error("corrompido"));
    await expect(openFile("C:/a.pdf", vi.fn())).rejects.toThrow("corrompido");
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
  });
});

describe("closeFile", () => {
  it("destroys pdf, closes session and removes tab", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await openFile("C:/a.pdf", vi.fn());
    await closeFile("doc-1");
    expect(fakePdf.destroy).toHaveBeenCalled();
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
    expect(useDocuments.getState().tabs).toHaveLength(0);
  });
});
```

Run: `cd app && pnpm test openFile`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar**

`app/src/app/openFile.ts`:

```ts
import { closeDocument, getDocumentBytes, openDocument } from "../lib/ipc";
import { loadPdf, PasswordRequiredError } from "../lib/pdfEngine";
import { useDocuments } from "../store/documents";

export type AskPassword = (fileName: string, incorrect: boolean) => Promise<string | null>;

export async function openFile(path: string, askPassword: AskPassword): Promise<"opened" | "already-open" | "cancelled"> {
  const existing = useDocuments.getState().tabs.find((t) => t.info.path === path);
  if (existing) {
    useDocuments.getState().setActive(existing.info.docId);
    return "already-open";
  }

  const info = await openDocument(path);
  try {
    const bytes = await getDocumentBytes(info.docId);
    let password: string | undefined;
    for (;;) {
      try {
        const pdf = await loadPdf(bytes, password);
        useDocuments.getState().addTab(info, pdf);
        return "opened";
      } catch (e) {
        if (!(e instanceof PasswordRequiredError)) throw e;
        const answer = await askPassword(info.fileName, e.incorrect);
        if (answer === null) {
          await closeDocument(info.docId);
          return "cancelled";
        }
        password = answer;
      }
    }
  } catch (e) {
    await closeDocument(info.docId).catch(() => undefined);
    throw e;
  }
}

export async function closeFile(docId: string): Promise<void> {
  const tab = useDocuments.getState().tabs.find((t) => t.info.docId === docId);
  if (!tab) return;
  useDocuments.getState().closeTab(docId);
  await tab.pdf.destroy();
  await closeDocument(docId);
}
```

- [ ] **Step 3: Rodar**

Run: `cd app && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/app
git commit -m "feat(ui): orchestrated open/close with password retry"
```

---

### Task 8: Viewer (páginas virtualizadas, camada de texto, rolagem contínua/página única)

**Files:**
- Create: `app/src/viewer/pageSizes.ts`, `app/src/viewer/pageSizes.test.ts`, `app/src/viewer/useInView.ts`, `app/src/viewer/useElementSize.ts`, `app/src/viewer/PageView.tsx`, `app/src/viewer/DocumentView.tsx`

**Interfaces:**
- Consumes: `Tab`, `useDocuments`, `computeScale`, `PDF_TO_CSS`, `Rotation`
- Produces:
  - `interface PageSize { width: number; height: number }` (pontos PDF, já com `/Rotate` da página), `loadPageSizes(pdf): Promise<PageSize[]>`, `usePageSizes(pdf): PageSize[]`
  - `useInView(ref, rootMargin?: string): boolean`
  - `useElementSize(ref): { width: number; height: number }`
  - `<PageView pdf pageIndex size scale rotation visible textLayer? highlights? activeHighlights? />`
  - `<DocumentView tab />`

- [ ] **Step 1: Teste de `loadPageSizes` (falha)**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { loadPageSizes } from "./pageSizes";

describe("loadPageSizes", () => {
  it("returns size in points for every page", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a", "b"] }));
    expect(await loadPageSizes(pdf)).toEqual([
      { width: 612, height: 792 },
      { width: 612, height: 792 },
    ]);
    await pdf.destroy();
  });
});
```

Run: `cd app && pnpm test pageSizes`
Expected: FAIL.

- [ ] **Step 2: Implementar `pageSizes.ts`, `useInView.ts`, `useElementSize.ts`**

`app/src/viewer/pageSizes.ts`:

```ts
import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PageSize {
  width: number;
  height: number;
}

export async function loadPageSizes(pdf: PDFDocumentProxy): Promise<PageSize[]> {
  const sizes: PageSize[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const viewport = (await pdf.getPage(i)).getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}

export function usePageSizes(pdf: PDFDocumentProxy): PageSize[] {
  const [sizes, setSizes] = useState<PageSize[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadPageSizes(pdf).then((s) => !cancelled && setSizes(s));
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  return sizes;
}
```

`app/src/viewer/useInView.ts`:

```ts
import { useEffect, useState, type RefObject } from "react";

export function useInView(ref: RefObject<Element | null>, rootMargin = "200px"): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
```

`app/src/viewer/useElementSize.ts`:

```ts
import { useEffect, useState, type RefObject } from "react";

export function useElementSize(ref: RefObject<Element | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
```

Run: `cd app && pnpm test`
Expected: PASS.

- [ ] **Step 3: `PageView.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import type { PageSize } from "./pageSizes";
import { PDF_TO_CSS, type Rotation } from "./zoom";

interface Props {
  pdf: PDFDocumentProxy;
  pageIndex: number;
  size: PageSize;
  scale: number;
  rotation: Rotation;
  visible: boolean;
  textLayer?: boolean;
  highlights?: number[];
  activeHighlights?: number[];
}

export function PageView({
  pdf, pageIndex, size, scale, rotation, visible, textLayer = true, highlights = [], activeHighlights = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [textDivs, setTextDivs] = useState<HTMLElement[]>([]);

  const sideways = rotation % 180 !== 0;
  const cssWidth = (sideways ? size.height : size.width) * scale * PDF_TO_CSS;
  const cssHeight = (sideways ? size.width : size.height) * scale * PDF_TO_CSS;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let layer: TextLayer | null = null;

    (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: scale * PDF_TO_CSS, rotation: (page.rotate + rotation) % 360 });
      const canvas = canvasRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      try {
        await renderTask.promise;
      } catch {
        return; // cancelado
      }
      if (cancelled || !textLayer || !textRef.current) return;
      const container = textRef.current;
      container.replaceChildren();
      layer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
      await layer.render();
      if (!cancelled) setTextDivs(layer.textDivs);
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      layer?.cancel();
    };
  }, [pdf, pageIndex, scale, rotation, visible, textLayer]);

  useEffect(() => {
    textDivs.forEach((div, i) => {
      div.classList.toggle("search-hit", highlights.includes(i));
      div.classList.toggle("search-hit-active", activeHighlights.includes(i));
    });
    if (activeHighlights.length > 0) textDivs[activeHighlights[0]]?.scrollIntoView({ block: "center" });
  }, [textDivs, highlights, activeHighlights]);

  return (
    <div
      className="page"
      data-page-index={pageIndex}
      style={{ width: cssWidth, height: cssHeight, ["--scale-factor" as string]: scale * PDF_TO_CSS }}
    >
      {visible && <canvas ref={canvasRef} />}
      {visible && textLayer && <div ref={textRef} className="textLayer" />}
    </div>
  );
}
```

Nota: se a versão do `pdfjs-dist` não aceitar `canvas` em `render()`, remova essa propriedade (mantendo `canvasContext`).

- [ ] **Step 4: `DocumentView.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useDocuments, type Tab } from "../store/documents";
import { PageView } from "./PageView";
import { usePageSizes } from "./pageSizes";
import { useElementSize } from "./useElementSize";
import { computeScale } from "./zoom";

const FALLBACK_SIZE = { width: 612, height: 792 };

export function DocumentView({ tab }: { tab: Tab }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sizes = usePageSizes(tab.pdf);
  const container = useElementSize(containerRef);
  const updateTab = useDocuments((s) => s.updateTab);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const docId = tab.info.docId;

  const reference = sizes[tab.currentPage] ?? sizes[0] ?? FALLBACK_SIZE;
  const scale = computeScale({
    fitMode: tab.fitMode,
    zoom: tab.zoom,
    pageWidth: reference.width,
    pageHeight: reference.height,
    rotation: tab.rotation,
    containerWidth: container.width,
    containerHeight: container.height,
  });

  const pageIndices = useMemo(
    () => (tab.viewMode === "single" ? [tab.currentPage] : sizes.map((_, i) => i)),
    [tab.viewMode, tab.currentPage, sizes],
  );

  // Visibilidade e página atual na rolagem contínua.
  useEffect(() => {
    if (tab.viewMode !== "continuous" || !containerRef.current) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const index = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) ratios.set(index, e.intersectionRatio);
          else ratios.delete(index);
        }
        setVisible(new Set(ratios.keys()));
        let best = -1;
        let bestRatio = -1;
        ratios.forEach((r, i) => {
          if (r > bestRatio) {
            best = i;
            bestRatio = r;
          }
        });
        if (best >= 0 && best !== useDocuments.getState().tabs.find((t) => t.info.docId === docId)?.currentPage) {
          updateTab(docId, { currentPage: best });
        }
      },
      { root: containerRef.current, rootMargin: "100% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [tab.viewMode, sizes, docId, updateTab]);

  // Navegação solicitada (miniatura, bookmark, busca, toolbar).
  useEffect(() => {
    if (tab.gotoPage === null) return;
    const target = tab.gotoPage;
    if (tab.viewMode === "continuous") pageRefs.current[target]?.scrollIntoView({ block: "start" });
    updateTab(docId, { gotoPage: null, currentPage: target });
  }, [tab.gotoPage, tab.viewMode, docId, updateTab]);

  const active = tab.search.matches[tab.search.active];

  return (
    <div className="document-view" ref={containerRef}>
      {pageIndices.map((i) => (
        <div
          key={i}
          data-index={i}
          className="page-slot"
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
        >
          <PageView
            pdf={tab.pdf}
            pageIndex={i}
            size={sizes[i] ?? FALLBACK_SIZE}
            scale={scale}
            rotation={tab.rotation}
            visible={tab.viewMode === "single" || visible.has(i)}
            highlights={tab.search.matches.filter((m) => m.pageIndex === i).flatMap((m) => m.itemIndices)}
            activeHighlights={active?.pageIndex === i ? active.itemIndices : []}
          />
        </div>
      ))}
    </div>
  );
}
```

`highlights` é recalculado a cada render; se causar re-render excessivo, memorize com `useMemo` por página.

- [ ] **Step 5: Type-check**

Run: `cd app && pnpm exec tsc --noEmit && pnpm test`
Expected: sem erros de tipo; testes PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/viewer
git commit -m "feat(ui): virtualized page viewer with text layer"
```

---

### Task 9: Shell da UI: abas, toolbar, atalhos, diálogo de senha, avisos

**Files:**
- Create: `app/src/app/shortcuts.ts`, `app/src/app/shortcuts.test.ts`, `app/src/app/actions.ts`, `app/src/app/Tabs.tsx`, `app/src/app/Toolbar.tsx`, `app/src/app/PasswordDialog.tsx`, `app/src/app/Notices.tsx`, `app/src/app/EmptyState.tsx`, `app/src/app/useOpenFileSources.ts`, `app/src/App.test.tsx`
- Overwrite: `app/src/App.tsx`, `app/src/main.tsx`, `app/src/styles.css`

**Interfaces:**
- Consumes: stores, `openFile`, `closeFile`, `initialFiles`, `nextZoom`, `rotate`, `DocumentView`
- Produces:
  - `type ShortcutAction = "open" | "close" | "find" | "print" | "zoomIn" | "zoomOut" | "zoomReset" | "nextPage" | "prevPage"`
  - `shortcutFor(e: { key: string; ctrlKey: boolean; metaKey: boolean }): ShortcutAction | null`
  - `actions.ts`: `openFiles(paths: string[]): Promise<void>`, `pickAndOpen(): Promise<void>`, `closeActive(): Promise<void>`, `zoomBy(dir: 1 | -1): void`, `zoomReset(): void`, `setFit(mode: FitMode): void`, `rotateView(dir: 1 | -1): void`, `goToPage(index: number): void`, `goRelative(delta: number): void`, `toggleViewMode(): void`, `printActive(): Promise<void>` (implementado na Task 12; aqui chama `useNotices` com "Impressão disponível em breve" — substituído depois), `runShortcut(a: ShortcutAction): void`

- [ ] **Step 1: Testes de `shortcutFor` e App vazio (falham)**

`app/src/app/shortcuts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shortcutFor } from "./shortcuts";

const k = (key: string, mod = true) => ({ key, ctrlKey: mod, metaKey: false });

describe("shortcutFor", () => {
  it.each([
    ["o", "open"], ["O", "open"], ["w", "close"], ["f", "find"], ["p", "print"],
    ["=", "zoomIn"], ["+", "zoomIn"], ["-", "zoomOut"], ["0", "zoomReset"],
  ])("Ctrl+%s → %s", (key, action) => {
    expect(shortcutFor(k(key))).toBe(action);
  });

  it("meta works like ctrl (macOS)", () => {
    expect(shortcutFor({ key: "o", ctrlKey: false, metaKey: true })).toBe("open");
  });

  it("page keys without modifier", () => {
    expect(shortcutFor(k("PageDown", false))).toBe("nextPage");
    expect(shortcutFor(k("PageUp", false))).toBe("prevPage");
  });

  it("ignores plain letters", () => {
    expect(shortcutFor(k("o", false))).toBeNull();
  });
});
```

`app/src/App.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./app/useOpenFileSources", () => ({ useOpenFileSources: () => undefined }));

import App from "./App";

describe("App", () => {
  it("shows empty state when no document is open", () => {
    render(<App />);
    expect(screen.getByText("Abra um PDF para começar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir arquivo" })).toBeInTheDocument();
  });
});
```

Run: `cd app && pnpm test`
Expected: FAIL.

- [ ] **Step 2: Implementar `shortcuts.ts`**

```ts
export type ShortcutAction =
  | "open" | "close" | "find" | "print" | "zoomIn" | "zoomOut" | "zoomReset" | "nextPage" | "prevPage";

export function shortcutFor(e: { key: string; ctrlKey: boolean; metaKey: boolean }): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "o": return "open";
      case "w": return "close";
      case "f": return "find";
      case "p": return "print";
      case "=":
      case "+": return "zoomIn";
      case "-": return "zoomOut";
      case "0": return "zoomReset";
      default: return null;
    }
  }
  if (e.key === "PageDown") return "nextPage";
  if (e.key === "PageUp") return "prevPage";
  return null;
}
```

- [ ] **Step 3: Implementar `actions.ts`**

```ts
import { open } from "@tauri-apps/plugin-dialog";
import { errorMessage } from "../lib/errors";
import { selectActiveTab, useDocuments, type TabPatch } from "../store/documents";
import { useNotices } from "../store/notices";
import { usePasswordPrompt } from "../store/passwordPrompt";
import { nextZoom, rotate, type FitMode } from "../viewer/zoom";
import { closeFile, openFile } from "./openFile";
import type { ShortcutAction } from "./shortcuts";

const active = () => selectActiveTab(useDocuments.getState());

function patchActive(patch: TabPatch) {
  const tab = active();
  if (tab) useDocuments.getState().updateTab(tab.info.docId, patch);
}

export async function openFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await openFile(path, usePasswordPrompt.getState().ask);
    } catch (e) {
      const name = path.split(/[\\/]/).pop() ?? path;
      useNotices.getState().push("error", `${name}: ${errorMessage(e)}`);
    }
  }
}

export async function pickAndOpen(): Promise<void> {
  const selected = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (selected === null) return;
  await openFiles(Array.isArray(selected) ? selected : [selected]);
}

export async function closeActive(): Promise<void> {
  const tab = active();
  if (tab) await closeFile(tab.info.docId);
}

export function zoomBy(dir: 1 | -1): void {
  const tab = active();
  if (tab) patchActive({ zoom: nextZoom(tab.zoom, dir), fitMode: "custom" });
}

export const zoomReset = () => patchActive({ zoom: 1, fitMode: "custom" });
export const setFit = (mode: FitMode) => patchActive({ fitMode: mode });

export function rotateView(dir: 1 | -1): void {
  const tab = active();
  if (tab) patchActive({ rotation: rotate(tab.rotation, dir) });
}

export function goToPage(index: number): void {
  const tab = active();
  if (!tab) return;
  patchActive({ gotoPage: Math.min(Math.max(index, 0), tab.pdf.numPages - 1) });
}

export function goRelative(delta: number): void {
  const tab = active();
  if (tab) goToPage(tab.currentPage + delta);
}

export function toggleViewMode(): void {
  const tab = active();
  if (tab) patchActive({ viewMode: tab.viewMode === "continuous" ? "single" : "continuous", gotoPage: tab.currentPage });
}

export async function printActive(): Promise<void> {
  useNotices.getState().push("info", "Impressão disponível em breve");
}

export function runShortcut(action: ShortcutAction): void {
  switch (action) {
    case "open": void pickAndOpen(); break;
    case "close": void closeActive(); break;
    case "find": useDocuments.getState().setSearchOpen(true); break;
    case "print": void printActive(); break;
    case "zoomIn": zoomBy(1); break;
    case "zoomOut": zoomBy(-1); break;
    case "zoomReset": zoomReset(); break;
    case "nextPage": goRelative(1); break;
    case "prevPage": goRelative(-1); break;
  }
}
```

- [ ] **Step 4: Componentes**

`app/src/app/EmptyState.tsx`:

```tsx
import { pickAndOpen } from "./actions";

export function EmptyState() {
  return (
    <div className="empty-state">
      <p>Abra um PDF para começar</p>
      <button onClick={() => void pickAndOpen()}>Abrir arquivo</button>
      <small>ou arraste um arquivo para esta janela</small>
    </div>
  );
}
```

`app/src/app/Tabs.tsx`:

```tsx
import { useDocuments } from "../store/documents";
import { closeFile } from "./openFile";

export function Tabs() {
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const setActive = useDocuments((s) => s.setActive);
  if (tabs.length === 0) return null;
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.info.docId}
          role="tab"
          aria-selected={t.info.docId === activeId}
          className={t.info.docId === activeId ? "tab active" : "tab"}
          onClick={() => setActive(t.info.docId)}
          title={t.info.path ?? t.info.fileName}
        >
          <span>{t.info.title ?? t.info.fileName}</span>
          <button
            aria-label={`Fechar ${t.info.fileName}`}
            onClick={(e) => {
              e.stopPropagation();
              void closeFile(t.info.docId);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

`app/src/app/Toolbar.tsx`:

```tsx
import { useState, useEffect } from "react";
import { selectActiveTab, useDocuments } from "../store/documents";
import {
  goRelative, goToPage, pickAndOpen, printActive, rotateView, setFit, toggleViewMode, zoomBy,
} from "./actions";

export function Toolbar() {
  const tab = useDocuments(selectActiveTab);
  const toggleSidebar = useDocuments((s) => s.toggleSidebar);
  const setSearchOpen = useDocuments((s) => s.setSearchOpen);
  const [pageInput, setPageInput] = useState("");

  useEffect(() => setPageInput(tab ? String(tab.currentPage + 1) : ""), [tab?.currentPage, tab?.info.docId]);

  return (
    <div className="toolbar">
      <button onClick={() => void pickAndOpen()} title="Abrir (Ctrl+O)">Abrir</button>
      {tab && (
        <>
          <button onClick={toggleSidebar} title="Painel lateral">☰</button>
          <span className="sep" />
          <button onClick={() => goRelative(-1)} title="Página anterior">‹</button>
          <input
            className="page-input"
            aria-label="Página"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToPage(Number(pageInput) - 1);
            }}
          />
          <span>/ {tab.pdf.numPages}</span>
          <button onClick={() => goRelative(1)} title="Próxima página">›</button>
          <span className="sep" />
          <button onClick={() => zoomBy(-1)} title="Diminuir zoom (Ctrl+-)">−</button>
          <span className="zoom-label">{tab.fitMode === "custom" ? `${Math.round(tab.zoom * 100)}%` : tab.fitMode === "width" ? "Largura" : "Página"}</span>
          <button onClick={() => zoomBy(1)} title="Aumentar zoom (Ctrl++)">+</button>
          <button onClick={() => setFit("width")} aria-pressed={tab.fitMode === "width"}>Ajustar largura</button>
          <button onClick={() => setFit("page")} aria-pressed={tab.fitMode === "page"}>Página inteira</button>
          <span className="sep" />
          <button onClick={() => rotateView(-1)} title="Girar à esquerda">⟲</button>
          <button onClick={() => rotateView(1)} title="Girar à direita">⟳</button>
          <button onClick={toggleViewMode}>{tab.viewMode === "continuous" ? "Página única" : "Contínuo"}</button>
          <span className="sep" />
          <button onClick={() => setSearchOpen(true)} title="Buscar (Ctrl+F)">Buscar</button>
          <button onClick={() => void printActive()} title="Imprimir (Ctrl+P)">Imprimir</button>
          {tab.info.readOnlyReason && (
            <span className="badge" title="Edição desabilitada">
              {tab.info.readOnlyReason === "encrypted" ? "Protegido — somente leitura" : "Arquivo danificado — somente leitura"}
            </span>
          )}
        </>
      )}
    </div>
  );
}
```

`app/src/app/PasswordDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { usePasswordPrompt } from "../store/passwordPrompt";

export function PasswordDialog() {
  const { open, incorrect, fileName, answer } = usePasswordPrompt();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-label="Senha do documento"
        onSubmit={(e) => {
          e.preventDefault();
          answer(value);
        }}
      >
        <h2>Documento protegido</h2>
        <p>{fileName} exige senha para abrir.</p>
        {incorrect && <p className="error">Senha incorreta. Tente novamente.</p>}
        <input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Senha" />
        <div className="modal-actions">
          <button type="button" onClick={() => answer(null)}>Cancelar</button>
          <button type="submit">Abrir</button>
        </div>
      </form>
    </div>
  );
}
```

`app/src/app/Notices.tsx`:

```tsx
import { useEffect } from "react";
import { useNotices } from "../store/notices";

export function Notices() {
  const { notices, dismiss } = useNotices();
  useEffect(() => {
    const timers = notices.filter((n) => n.kind === "info").map((n) => setTimeout(() => dismiss(n.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [notices, dismiss]);
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice ${n.kind}`}>
          <span>{n.text}</span>
          <button aria-label="Dispensar" onClick={() => dismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

`app/src/app/useOpenFileSources.ts`:

```ts
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { initialFiles } from "../lib/ipc";
import { openFiles, runShortcut } from "./actions";
import { shortcutFor } from "./shortcuts";

let initialHandled = false;
const isPdf = (p: string) => p.toLowerCase().endsWith(".pdf");

/** Liga as fontes de arquivos: argv inicial, segunda instância, arrastar-e-soltar e atalhos. */
export function useOpenFileSources(): void {
  useEffect(() => {
    if (!initialHandled) {
      initialHandled = true;
      void initialFiles().then(openFiles);
    }
    const unlistenOpen = listen<string[]>("open-files", (e) => void openFiles(e.payload));
    const unlistenDrop = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop") void openFiles(e.payload.paths.filter(isPdf));
    });
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutFor(e);
      if (!action) return;
      e.preventDefault();
      runShortcut(action);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      void unlistenOpen.then((f) => f());
      void unlistenDrop.then((f) => f());
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
```

`app/src/App.tsx` (Sidebar e SearchBar entram nas Tasks 10–11; por ora sem eles):

```tsx
import { EmptyState } from "./app/EmptyState";
import { Notices } from "./app/Notices";
import { PasswordDialog } from "./app/PasswordDialog";
import { Tabs } from "./app/Tabs";
import { Toolbar } from "./app/Toolbar";
import { useOpenFileSources } from "./app/useOpenFileSources";
import { selectActiveTab, useDocuments } from "./store/documents";
import { DocumentView } from "./viewer/DocumentView";

export default function App() {
  useOpenFileSources();
  const tab = useDocuments(selectActiveTab);
  return (
    <div className="app">
      <Tabs />
      <Toolbar />
      <div className="main">
        {tab ? <DocumentView key={tab.info.docId} tab={tab} /> : <EmptyState />}
      </div>
      <PasswordDialog />
      <Notices />
    </div>
  );
}
```

`app/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "./styles.css";
import App from "./App";

GlobalWorkerOptions.workerSrc = workerUrl;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`app/src/styles.css`:

```css
:root {
  --bg: #f3f3f3;
  --panel: #ffffff;
  --border: #d9d9d9;
  --text: #1f1f1f;
  --accent: #c0392b;
  --page-bg: #525659;
  font-family: system-ui, "Segoe UI", sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }

.app { display: flex; flex-direction: column; height: 100%; }
.tabs { display: flex; background: var(--bg); border-bottom: 1px solid var(--border); overflow-x: auto; }
.tab { display: flex; align-items: center; gap: 6px; padding: 6px 10px; cursor: pointer; border-right: 1px solid var(--border); white-space: nowrap; }
.tab.active { background: var(--panel); }
.tab button { border: none; background: none; cursor: pointer; font-size: 16px; }

.toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; background: var(--panel); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.toolbar button { padding: 4px 8px; border: 1px solid transparent; border-radius: 4px; background: none; cursor: pointer; }
.toolbar button:hover { border-color: var(--border); }
.toolbar button[aria-pressed="true"] { background: #e8e8e8; }
.toolbar .sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
.page-input { width: 48px; text-align: center; }
.zoom-label { min-width: 64px; text-align: center; }
.badge { margin-left: auto; padding: 2px 8px; border-radius: 10px; background: #fdecea; color: var(--accent); font-size: 12px; }

.main { flex: 1; display: flex; min-height: 0; }
.document-view { flex: 1; overflow: auto; background: var(--page-bg); padding: 16px 0; }
.page-slot { display: flex; justify-content: center; margin-bottom: 12px; }
.page { position: relative; background: white; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); }
.page canvas { display: block; }

.textLayer .search-hit { background: rgba(255, 213, 0, 0.45); border-radius: 2px; }
.textLayer .search-hit-active { background: rgba(255, 120, 0, 0.6); }

.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #555; }
.empty-state button { padding: 8px 16px; font-size: 15px; cursor: pointer; }

.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); display: flex; align-items: center; justify-content: center; }
.modal { background: var(--panel); padding: 20px; border-radius: 8px; min-width: 320px; display: flex; flex-direction: column; gap: 10px; }
.modal h2 { margin: 0; font-size: 16px; }
.modal .error { color: var(--accent); margin: 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

.notices { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
.notice { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 6px; background: #333; color: white; max-width: 420px; }
.notice.error { background: var(--accent); }
.notice button { border: none; background: none; color: inherit; cursor: pointer; }

#print-root { display: none; }
```

- [ ] **Step 5: Rodar testes e type-check**

Run: `cd app && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 6: Verificação manual**

Run: `cd app && pnpm tauri dev`
Checar: janela "LivrePDF" abre com estado vazio; "Abrir arquivo" abre diálogo filtrado em PDF; PDF abre em aba; rolagem renderiza páginas sob demanda; texto selecionável e copiável (Ctrl+C); zoom +/−, ajustar largura/página, girar, página única/contínuo funcionam; Ctrl+W fecha aba; arrastar PDF para a janela abre; PDF com senha pede senha e "Senha incorreta" aparece no erro; arquivo `.txt` renomeado para `.pdf` mostra aviso de erro.

- [ ] **Step 7: Commit**

```bash
git add app/src
git commit -m "feat(ui): app shell with tabs, toolbar, shortcuts and password dialog"
```

---

### Task 10: Painel lateral: miniaturas e bookmarks

**Files:**
- Create: `app/src/sidebar/outline.ts`, `app/src/sidebar/outline.test.ts`, `app/src/sidebar/Outline.tsx`, `app/src/sidebar/Thumbnails.tsx`, `app/src/sidebar/Sidebar.tsx`
- Modify: `app/src/App.tsx` (renderizar `<Sidebar>`), `app/src/styles.css` (estilos do painel)

**Interfaces:**
- Consumes: `Tab`, `PageView`, `usePageSizes`, `useInView`, `goToPage`
- Produces: `interface OutlineNode { title: string; pageIndex: number | null; children: OutlineNode[] }`, `loadOutline(pdf): Promise<OutlineNode[]>`, `<Sidebar tab />`

- [ ] **Step 1: Teste de `loadOutline` (falha)**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { loadOutline } from "./outline";

describe("loadOutline", () => {
  it("resolves bookmark destinations to page indices", async () => {
    const pdf = await loadPdf(
      makePdf({ pages: ["a", "b", "c"], outline: [{ title: "Intro", page: 0 }, { title: "Fim", page: 2 }] }),
    );
    expect(await loadOutline(pdf)).toEqual([
      { title: "Intro", pageIndex: 0, children: [] },
      { title: "Fim", pageIndex: 2, children: [] },
    ]);
    await pdf.destroy();
  });

  it("returns empty list without outline", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a"] }));
    expect(await loadOutline(pdf)).toEqual([]);
    await pdf.destroy();
  });
});
```

Run: `cd app && pnpm test outline`
Expected: FAIL.

- [ ] **Step 2: Implementar `outline.ts`**

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface OutlineNode {
  title: string;
  pageIndex: number | null;
  children: OutlineNode[];
}

type RawItem = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

export async function loadOutline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  const raw = await pdf.getOutline();
  if (!raw) return [];
  return Promise.all(raw.map((item) => convert(pdf, item)));
}

async function convert(pdf: PDFDocumentProxy, item: RawItem): Promise<OutlineNode> {
  return {
    title: item.title,
    pageIndex: await resolvePageIndex(pdf, item.dest),
    children: await Promise.all((item.items ?? []).map((child) => convert(pdf, child))),
  };
}

async function resolvePageIndex(pdf: PDFDocumentProxy, dest: RawItem["dest"]): Promise<number | null> {
  if (!dest) return null;
  const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
  if (!explicit || explicit.length === 0) return null;
  const ref = explicit[0];
  if (typeof ref === "number") return ref;
  try {
    return await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
  } catch {
    return null;
  }
}
```

Run: `cd app && pnpm test`
Expected: PASS.

- [ ] **Step 3: Componentes**

`app/src/sidebar/Outline.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { goToPage } from "../app/actions";
import { loadOutline, type OutlineNode } from "./outline";

export function Outline({ pdf }: { pdf: PDFDocumentProxy }) {
  const [nodes, setNodes] = useState<OutlineNode[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOutline(pdf).then((n) => !cancelled && setNodes(n)).catch(() => !cancelled && setNodes([]));
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  if (nodes === null) return <p className="muted">Carregando…</p>;
  if (nodes.length === 0) return <p className="muted">Sem marcadores</p>;
  return <OutlineList nodes={nodes} />;
}

function OutlineList({ nodes }: { nodes: OutlineNode[] }) {
  return (
    <ul className="outline">
      {nodes.map((n, i) => (
        <li key={i}>
          <button disabled={n.pageIndex === null} onClick={() => n.pageIndex !== null && goToPage(n.pageIndex)}>
            {n.title}
          </button>
          {n.children.length > 0 && <OutlineList nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}
```

`app/src/sidebar/Thumbnails.tsx`:

```tsx
import { useRef } from "react";
import { goToPage } from "../app/actions";
import type { Tab } from "../store/documents";
import { PageView } from "../viewer/PageView";
import { usePageSizes, type PageSize } from "../viewer/pageSizes";
import { useInView } from "../viewer/useInView";
import { PDF_TO_CSS } from "../viewer/zoom";

const THUMB_WIDTH = 120;

export function Thumbnails({ tab }: { tab: Tab }) {
  const sizes = usePageSizes(tab.pdf);
  return (
    <div className="thumbnails">
      {sizes.map((size, i) => (
        <Thumbnail key={i} tab={tab} index={i} size={size} />
      ))}
    </div>
  );
}

function Thumbnail({ tab, index, size }: { tab: Tab; index: number; size: PageSize }) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref);
  const isCurrent = tab.currentPage === index;
  return (
    <button ref={ref} className={isCurrent ? "thumb current" : "thumb"} onClick={() => goToPage(index)} aria-label={`Página ${index + 1}`}>
      <PageView
        pdf={tab.pdf}
        pageIndex={index}
        size={size}
        scale={THUMB_WIDTH / (size.width * PDF_TO_CSS)}
        rotation={0}
        visible={inView}
        textLayer={false}
      />
      <span>{index + 1}</span>
    </button>
  );
}
```

`app/src/sidebar/Sidebar.tsx`:

```tsx
import { useState } from "react";
import type { Tab } from "../store/documents";
import { Outline } from "./Outline";
import { Thumbnails } from "./Thumbnails";

export function Sidebar({ tab }: { tab: Tab }) {
  const [panel, setPanel] = useState<"thumbs" | "outline">("thumbs");
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button aria-pressed={panel === "thumbs"} onClick={() => setPanel("thumbs")}>Páginas</button>
        <button aria-pressed={panel === "outline"} onClick={() => setPanel("outline")}>Marcadores</button>
      </div>
      <div className="sidebar-body">
        {panel === "thumbs" ? <Thumbnails tab={tab} /> : <Outline pdf={tab.pdf} />}
      </div>
    </aside>
  );
}
```

Em `App.tsx`, dentro de `.main`, antes do `DocumentView`:

```tsx
{tab && sidebarOpen && <Sidebar key={tab.info.docId} tab={tab} />}
```

com `const sidebarOpen = useDocuments((s) => s.sidebarOpen);` e `import { Sidebar } from "./sidebar/Sidebar";`.

Estilos a acrescentar em `styles.css`:

```css
.sidebar { width: 180px; display: flex; flex-direction: column; background: var(--panel); border-right: 1px solid var(--border); }
.sidebar-tabs { display: flex; border-bottom: 1px solid var(--border); }
.sidebar-tabs button { flex: 1; padding: 6px; border: none; background: none; cursor: pointer; }
.sidebar-tabs button[aria-pressed="true"] { border-bottom: 2px solid var(--accent); }
.sidebar-body { flex: 1; overflow: auto; padding: 8px; }
.thumbnails { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.thumb { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 2px solid transparent; background: none; padding: 2px; cursor: pointer; }
.thumb.current { border-color: var(--accent); }
.outline { list-style: none; padding-left: 10px; margin: 0; }
.outline button { border: none; background: none; text-align: left; padding: 3px 0; cursor: pointer; }
.muted { color: #888; }
```

- [ ] **Step 4: Rodar e verificar**

Run: `cd app && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

Manual (`pnpm tauri dev`): miniaturas aparecem e destacam a página atual; clique navega; aba Marcadores lista bookmarks de um PDF com outline e navega; botão ☰ esconde/mostra painel.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(ui): sidebar with thumbnails and bookmarks"
```

---

### Task 11: Busca de texto

**Files:**
- Create: `app/src/search/search.ts`, `app/src/search/search.test.ts`, `app/src/search/searchDocument.test.ts`, `app/src/search/SearchBar.tsx`
- Modify: `app/src/App.tsx` (renderizar `<SearchBar>` quando `searchOpen`), `app/src/styles.css`

**Interfaces:**
- Consumes: `PageMatch`, `useDocuments`, `goToPage`
- Produces: `interface TextItemLike { str: string; hasEOL?: boolean }`, `findInPage(items: TextItemLike[], query: string, pageIndex: number): PageMatch[]`, `searchDocument(pdf, query): Promise<PageMatch[]>`, `<SearchBar tab />`

Os índices de `itemIndices` contam apenas itens de texto (com `str`), na mesma ordem dos `textDivs` do `TextLayer` do PDF.js.

- [ ] **Step 1: Testes (falham)**

`app/src/search/search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findInPage } from "./search";

describe("findInPage", () => {
  it("finds case-insensitive matches within one item", () => {
    expect(findInPage([{ str: "Olá Mundo" }, { str: "mundo novo" }], "MUNDO", 3)).toEqual([
      { pageIndex: 3, itemIndices: [0] },
      { pageIndex: 3, itemIndices: [1] },
    ]);
  });

  it("finds matches spanning items", () => {
    expect(findInPage([{ str: "Rela" }, { str: "tório" }], "relatório", 0)).toEqual([
      { pageIndex: 0, itemIndices: [0, 1] },
    ]);
  });

  it("treats end-of-line as a space", () => {
    expect(findInPage([{ str: "fim", hasEOL: true }, { str: "linha" }], "fim linha", 0)).toEqual([
      { pageIndex: 0, itemIndices: [0, 1] },
    ]);
  });

  it("empty or blank query returns nothing", () => {
    expect(findInPage([{ str: "abc" }], "  ", 0)).toEqual([]);
  });

  it("finds repeated non-overlapping matches", () => {
    expect(findInPage([{ str: "aaaa" }], "aa", 0)).toHaveLength(2);
  });
});
```

`app/src/search/searchDocument.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { searchDocument } from "./search";

describe("searchDocument", () => {
  it("returns matches across pages", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["contrato social", "sem nada", "Contrato final"] }));
    const matches = await searchDocument(pdf, "contrato");
    expect(matches.map((m) => m.pageIndex)).toEqual([0, 2]);
    await pdf.destroy();
  });
});
```

Run: `cd app && pnpm test search`
Expected: FAIL.

- [ ] **Step 2: Implementar `search.ts`**

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageMatch } from "../store/documents";

export interface TextItemLike {
  str: string;
  hasEOL?: boolean;
}

export function findInPage(items: TextItemLike[], query: string, pageIndex: number): PageMatch[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  let text = "";
  const starts: number[] = [];
  for (const item of items) {
    starts.push(text.length);
    text += item.str;
    if (item.hasEOL) text += " ";
  }
  const haystack = text.toLocaleLowerCase();
  const matches: PageMatch[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    const end = at + needle.length;
    const itemIndices: number[] = [];
    items.forEach((item, i) => {
      const s = starts[i];
      if (s + item.str.length > at && s < end) itemIndices.push(i);
    });
    matches.push({ pageIndex, itemIndices });
    from = end;
  }
  return matches;
}

export async function searchDocument(pdf: PDFDocumentProxy, query: string): Promise<PageMatch[]> {
  const all: PageMatch[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    // Itens de marked-content não têm `str` e não geram textDivs no TextLayer.
    const items = content.items.filter((it) => "str" in it) as TextItemLike[];
    all.push(...findInPage(items, query, i - 1));
  }
  return all;
}
```

Run: `cd app && pnpm test`
Expected: PASS.

- [ ] **Step 3: `SearchBar.tsx` e integração**

```tsx
import { useEffect, useRef, useState } from "react";
import { goToPage } from "../app/actions";
import { useDocuments, type Tab } from "../store/documents";
import { searchDocument } from "./search";

export function SearchBar({ tab }: { tab: Tab }) {
  const updateTab = useDocuments((s) => s.updateTab);
  const setSearchOpen = useDocuments((s) => s.setSearchOpen);
  const [query, setQuery] = useState(tab.search.query);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { matches, active } = tab.search;
  const docId = tab.info.docId;

  useEffect(() => inputRef.current?.focus(), []);

  const select = (index: number) => {
    if (matches.length === 0) return;
    const next = (index + matches.length) % matches.length;
    updateTab(docId, { search: { ...tab.search, active: next } });
    goToPage(matches[next].pageIndex);
  };

  const run = async () => {
    if (query === tab.search.query && matches.length > 0) return select(active + 1);
    setBusy(true);
    try {
      const found = await searchDocument(tab.pdf, query);
      updateTab(docId, { search: { query, matches: found, active: 0 } });
      if (found.length > 0) goToPage(found[0].pageIndex);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    updateTab(docId, { search: { query: "", matches: [], active: 0 } });
    setSearchOpen(false);
  };

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        aria-label="Buscar no documento"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void (e.shiftKey ? select(active - 1) : run());
          if (e.key === "Escape") close();
        }}
      />
      <span className="search-count">
        {busy ? "Buscando…" : tab.search.query ? (matches.length ? `${active + 1} de ${matches.length}` : "Nenhum resultado") : ""}
      </span>
      <button onClick={() => select(active - 1)} disabled={!matches.length} aria-label="Anterior">↑</button>
      <button onClick={() => select(active + 1)} disabled={!matches.length} aria-label="Próximo">↓</button>
      <button onClick={close} aria-label="Fechar busca">×</button>
    </div>
  );
}
```

Em `App.tsx`, após `<Toolbar />`:

```tsx
{tab && searchOpen && <SearchBar key={tab.info.docId} tab={tab} />}
```

com `const searchOpen = useDocuments((s) => s.searchOpen);` e `import { SearchBar } from "./search/SearchBar";`.

Estilos:

```css
.search-bar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--panel); border-bottom: 1px solid var(--border); }
.search-bar input { width: 260px; padding: 4px 6px; }
.search-count { min-width: 110px; color: #666; font-size: 12px; }
```

- [ ] **Step 4: Rodar e verificar**

Run: `cd app && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

Manual: Ctrl+F abre a barra; Enter busca e destaca resultados; Enter de novo vai ao próximo; Shift+Enter volta; contador "1 de N"; Esc fecha e limpa destaques.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(ui): document text search with highlights"
```

---

### Task 12: Impressão

**Files:**
- Create: `app/src/print/printPdf.ts`
- Modify: `app/src/app/actions.ts` (`printActive`), `app/src/styles.css`

**Interfaces:**
- Consumes: `printPage()` (ipc), `selectActiveTab`
- Produces: `printPdf(pdf: PDFDocumentProxy, root: HTMLElement, dpi?: number): Promise<void>`

- [ ] **Step 1: Implementar `printPdf.ts`**

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";
import { printPage } from "../lib/ipc";

/** Renderiza todas as páginas em imagens no #print-root e abre o diálogo de impressão do sistema. */
export async function printPdf(pdf: PDFDocumentProxy, root: HTMLElement, dpi = 150): Promise<void> {
  root.replaceChildren();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao preparar impressão"))), "image/png"),
    );
    const img = document.createElement("img");
    img.className = "print-page";
    img.src = URL.createObjectURL(blob);
    root.appendChild(img);
  }
  await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  await printPage();
}
```

`root.replaceChildren()` no início libera a impressão anterior; para liberar memória dos blobs, antes de `replaceChildren` revogue as URLs:

```ts
  root.querySelectorAll("img").forEach((img) => URL.revokeObjectURL(img.src));
```

(inserir como primeira linha da função).

- [ ] **Step 2: Ligar à ação**

Em `actions.ts`, substituir `printActive`:

```ts
import { printPdf } from "../print/printPdf";

export async function printActive(): Promise<void> {
  const tab = active();
  const root = document.getElementById("print-root");
  if (!tab || !root) return;
  try {
    useNotices.getState().push("info", "Preparando impressão…");
    await printPdf(tab.pdf, root);
  } catch (e) {
    useNotices.getState().push("error", `Impressão: ${errorMessage(e)}`);
  }
}
```

Estilos:

```css
@media print {
  #root { display: none !important; }
  #print-root { display: block !important; }
  .print-page { display: block; width: 100%; page-break-after: always; break-after: page; }
  @page { margin: 0; }
}
```

- [ ] **Step 3: Verificar**

Run: `cd app && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

Manual: Ctrl+P com PDF de 3 páginas abre o diálogo do Windows; prévia mostra 3 páginas, sem toolbar/abas; "Microsoft Print to PDF" gera arquivo com as 3 páginas.

- [ ] **Step 4: Commit**

```bash
git add app/src
git commit -m "feat(ui): print via system dialog"
```

---

### Task 13: CI e README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: Workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-22.04]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - name: Linux deps
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2

      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: app/pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile
        working-directory: app
      - run: pnpm exec tsc --noEmit
        working-directory: app
      - run: pnpm test
        working-directory: app
      - run: pnpm build
        working-directory: app
      - run: cargo test --workspace
```

- [ ] **Step 2: README**

```markdown
# LivrePDF

Editor de PDF desktop, gratuito e open source (MIT). Funciona 100% offline.

## Estado

Fase 1 — visualizador: abas, zoom, rotação, rolagem contínua/página única,
miniaturas, marcadores, busca, seleção de texto, impressão e PDFs com senha
(somente leitura).

Roteiro completo: `docs/superpowers/specs/2026-11-03-livrepdf-mvp-design.md`.

## Desenvolvimento

Pré-requisitos: Rust stable, Node 20+, pnpm 9+, e no Windows o
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
```

- [ ] **Step 3: Commit**

```bash
git add .github README.md
git commit -m "ci: test workflow for windows, macos and linux; add readme"
```

---

### Task 14: Verificação final da fase

**Files:** nenhum.

- [ ] **Step 1: Suíte completa**

```bash
cd /c/Users/cassiano.soares/pdf/app && pnpm exec tsc --noEmit && pnpm test && pnpm build && cd .. && cargo test --workspace
```

Expected: tudo PASS.

- [ ] **Step 2: Build de release local**

```bash
cd /c/Users/cassiano.soares/pdf/app && pnpm tauri build
```

Expected: instaladores em `target/release/bundle/msi/` e `target/release/bundle/nsis/`. Instalar o `.msi`, confirmar que "LivrePDF" aparece no menu Iniciar e que "Abrir com → LivrePDF" em um `.pdf` abre o arquivo (associação + `initial_files`). Com o app aberto, abrir outro `.pdf` pelo Explorer deve abrir nova aba na mesma janela (single-instance).

- [ ] **Step 3: Checklist da spec 4.1**

Marcar cada item contra o app instalado: abrir por diálogo/arrastar/associação ✓, abas ✓, zoom/ajuste/rotação/contínuo/página única ✓, miniaturas/bookmarks ✓, busca/seleção/cópia ✓, imprimir ✓, PDF com senha ✓. Itens "lista de anotações" do painel ficam para a Fase 3 (Comentários). Registrar qualquer falha como tarefa antes de fechar a fase.
