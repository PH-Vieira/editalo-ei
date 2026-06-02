//! Desativa atalhos padrão do navegador no WebView2 (Windows).
//! No frontend, `browserNavigationGuard` cobre o mesmo caso no Vite/dev.

#[cfg(windows)]
pub fn disable_browser_accelerators(window: &tauri::Window) {
    let _ = window.with_webview(|webview| {
        #[allow(unsafe_code)]
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
            use windows::core::Interface;

            let core = webview
                .controller()
                .CoreWebView2()
                .expect("CoreWebView2 indisponível");
            let settings = core.Settings().expect("Settings indisponível");
            let settings3: ICoreWebView2Settings3 = settings
                .cast()
                .expect("ICoreWebView2Settings3 indisponível");
            let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
    });
}

#[cfg(not(windows))]
pub fn disable_browser_accelerators(_window: &tauri::Window) {}
