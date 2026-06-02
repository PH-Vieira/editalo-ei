// Evita abrir um console extra no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod browser_shortcuts;
mod commands;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_window("main") {
                browser_shortcuts::disable_browser_accelerators(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::probe_media,
            commands::prepare_import_media,
            commands::extract_thumbnails,
            commands::extract_waveform,
            commands::export_video,
            commands::save_project_file,
            commands::load_project_file,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a aplicação NaRégua");
}
