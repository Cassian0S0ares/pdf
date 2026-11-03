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

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn read_only_reason(&self) -> Option<ReadOnlyReason> {
        self.read_only_reason
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
}

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
