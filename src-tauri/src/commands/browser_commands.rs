use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewBuilder, WebviewUrl};
use tauri::LogicalPosition;
use tauri::LogicalSize;

#[derive(Clone, Serialize)]
struct BrowserUrlPayload {
    label: String,
    url: String,
}

// Placeholder __WEBVIEW_LABEL__ is replaced with the actual label at runtime.
// Note: Tauri 2 injects __TAURI_INTERNALS__ into child webviews created via
// window.add_child(), so invoke() IS available even for external URLs.
// If IPC is somehow unavailable, on_navigation still provides best-effort tracking.
const URL_SYNC_SCRIPT: &str = r#"
(function() {
  var LABEL = '__WEBVIEW_LABEL__';
  var lastUrl = location.href;

  function reportUrl() {
    var url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (window.__TAURI_INTERNALS__) {
        window.__TAURI_INTERNALS__.invoke('browser_url_report', { label: LABEL, url: url });
      }
    }
  }

  // Intercept pushState / replaceState
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() {
    origPush.apply(this, arguments);
    reportUrl();
  };
  history.replaceState = function() {
    origReplace.apply(this, arguments);
    reportUrl();
  };

  window.addEventListener('popstate', reportUrl);
  window.addEventListener('hashchange', reportUrl);
})();
"#;

#[tauri::command]
pub async fn browser_create(
    app: AppHandle,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app.get_window("main")
        .ok_or("Main window not found")?;

    let parsed_url = url.parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    let app_handle = app.clone();
    let label_for_nav = label.clone();

    let builder = WebviewBuilder::new(
        &label,
        WebviewUrl::External(parsed_url),
    )
    .initialization_script(&URL_SYNC_SCRIPT.replace("__WEBVIEW_LABEL__", &label))
    .on_navigation(move |nav_url| {
        let _ = app_handle.emit("browser-url-changed", BrowserUrlPayload {
            label: label_for_nav.clone(),
            url: nav_url.to_string(),
        });
        true // allow all navigation
    });

    window.add_child(
        builder,
        LogicalPosition::new(x, y),
        LogicalSize::new(width, height),
    ).map_err(|e| format!("Failed to create browser webview: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn browser_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;

    let final_url = if !url.contains("://") {
        format!("https://{url}")
    } else {
        url
    };

    let parsed = final_url.parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    webview.navigate(parsed)
        .map_err(|e| format!("Navigation failed: {e}"))
}

#[tauri::command]
pub async fn browser_go_back(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.history.back()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_go_forward(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.history.forward()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_reload(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.location.reload()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_resize(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("Set position failed: {e}"))?;
    webview.set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("Set size failed: {e}"))
}

#[tauri::command]
pub async fn browser_destroy(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| format!("Close failed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_get_current_url(
    app: AppHandle,
    label: String,
) -> Result<String, String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.location.href")
        .map_err(|e| format!("Eval failed: {e}"))?;
    // Note: eval is fire-and-forget in Tauri 2 — use the URL sync event instead
    Ok(String::new())
}

#[tauri::command]
pub async fn browser_url_report(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    app.emit("browser-url-changed", BrowserUrlPayload { label, url })
        .map_err(|e| format!("Emit failed: {e}"))
}
