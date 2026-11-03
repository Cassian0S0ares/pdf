use std::sync::Mutex;

use livrepdf_core::{AppError, DocumentInfo, DocumentSession, ErrorCode, SessionStore};
use tauri::{Emitter, Manager, State};

#[derive(Default)]
struct AppState(Mutex<SessionStore>);

/// Filtra argumentos de linha de comando que são caminhos de PDF.
pub fn pdf_args(args: impl IntoIterator<Item = String>) -> Vec<String> {
    args.into_iter()
        .filter(|a| a.to_lowercase().ends_with(".pdf"))
        .collect()
}

fn lock(state: &AppState) -> std::sync::MutexGuard<'_, SessionStore> {
    state.0.lock().expect("session store poisoned")
}

// Comandos async rodam no pool de threads do Tauri, fora da thread principal (UI).

#[tauri::command]
async fn open_document(path: String, state: State<'_, AppState>) -> Result<DocumentInfo, AppError> {
    // Leitura e parse do arquivo fora do lock do store (e fora das threads async).
    let session = tauri::async_runtime::spawn_blocking(move || DocumentSession::open(&path))
        .await
        .map_err(|e| AppError::new(ErrorCode::Internal, "Falha interna ao abrir o documento").with_details(e.to_string()))??;
    let mut store = lock(&state);
    let id = store.insert(session);
    Ok(store.get(&id)?.info(&id))
}

#[tauri::command]
async fn get_document_bytes(doc_id: String, state: State<'_, AppState>) -> Result<tauri::ipc::Response, AppError> {
    let bytes = lock(&state).get(&doc_id)?.bytes().to_vec();
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
async fn close_document(doc_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    lock(&state).remove(&doc_id)
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
