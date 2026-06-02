// Evita abrir um console extra no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::probe_media,
            commands::export_video,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a aplicação Editá-lo-ei");
}
