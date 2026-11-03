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
