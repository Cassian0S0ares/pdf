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

    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

fn not_found(doc_id: &str) -> AppError {
    AppError::new(ErrorCode::DocumentNotFound, "Documento não está aberto").with_details(doc_id)
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
