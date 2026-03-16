use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};
use tauri::webview::{PageLoadEvent, Webview};

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// Holds all active browser child-webviews keyed by panel_id.
pub struct BrowserState {
    pub webviews: Mutex<HashMap<String, Webview<tauri::Wry>>>,
}

impl BrowserState {
    pub fn new() -> Self {
        Self {
            webviews: Mutex::new(HashMap::new()),
        }
    }
}

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UrlChangedPayload {
    panel_id: String,
    url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadingChangedPayload {
    panel_id: String,
    is_loading: bool,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Creates a child WebView on the main window at the given logical coordinates.
///
/// # Security
/// `javascript:` and `data:` URL schemes are blocked in the `on_navigation`
/// callback — the callback returns `false` for those schemes which cancels
/// the navigation.
#[tauri::command]
pub fn create_browser_webview(
    app: AppHandle,
    state: tauri::State<BrowserState>,
    panel_id: String,
    url: Option<String>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let webview_url = match &url {
        Some(u) if !u.is_empty() => WebviewUrl::External(
            u.parse::<url::Url>().map_err(|e| format!("invalid url: {e}"))?,
        ),
        _ => WebviewUrl::External(
            "about:blank"
                .parse::<url::Url>()
                .map_err(|e| format!("parse about:blank: {e}"))?,
        ),
    };

    let label = format!("browser-{panel_id}");

    let panel_id_nav = panel_id.clone();
    let app_nav = app.clone();

    let panel_id_load = panel_id.clone();
    let app_load = app.clone();

    let builder = WebviewBuilder::new(&label, webview_url)
        .on_navigation(move |nav_url| {
            let scheme = nav_url.scheme();
            // Block dangerous schemes
            if scheme == "javascript" || scheme == "data" {
                eprintln!(
                    "[browser] blocked navigation to {} scheme",
                    scheme
                );
                return false;
            }
            let _ = app_nav.emit(
                "browser:url-changed",
                UrlChangedPayload {
                    panel_id: panel_id_nav.clone(),
                    url: nav_url.to_string(),
                },
            );
            true
        })
        .on_page_load(move |_webview, payload| {
            let is_loading = matches!(payload.event(), PageLoadEvent::Started);
            let _ = app_load.emit(
                "browser:loading-changed",
                LoadingChangedPayload {
                    panel_id: panel_id_load.clone(),
                    is_loading,
                },
            );
        });

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| format!("add_child failed: {e}"))?;

    state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .insert(panel_id, webview);

    Ok(())
}

/// Navigates an existing browser WebView to the given URL.
#[tauri::command]
pub fn navigate_browser(
    state: tauri::State<BrowserState>,
    panel_id: String,
    url: String,
) -> Result<(), String> {
    let parsed = url
        .parse::<url::Url>()
        .map_err(|e| format!("invalid url: {e}"))?;

    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .navigate(parsed)
        .map_err(|e| format!("navigate failed: {e}"))
}

/// Closes and removes a browser WebView.
#[tauri::command]
pub fn close_browser_webview(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let mut webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    if let Some(webview) = webviews.remove(&panel_id) {
        webview
            .close()
            .map_err(|e| format!("close failed: {e}"))?;
    }

    Ok(())
}

/// Repositions and resizes a browser WebView.
#[tauri::command]
pub fn set_browser_bounds(
    state: tauri::State<BrowserState>,
    panel_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("set_position failed: {e}"))?;

    webview
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("set_size failed: {e}"))?;

    Ok(())
}

/// Makes a browser WebView visible.
#[tauri::command]
pub fn show_browser_webview(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .show()
        .map_err(|e| format!("show failed: {e}"))
}

/// Hides a browser WebView.
#[tauri::command]
pub fn hide_browser_webview(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .hide()
        .map_err(|e| format!("hide failed: {e}"))
}

/// Navigates back in the WebView's history.
#[tauri::command]
pub fn browser_go_back(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .eval("window.history.back()")
        .map_err(|e| format!("eval back failed: {e}"))
}

/// Navigates forward in the WebView's history.
#[tauri::command]
pub fn browser_go_forward(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .eval("window.history.forward()")
        .map_err(|e| format!("eval forward failed: {e}"))
}

/// Reloads the current page in the WebView.
#[tauri::command]
pub fn browser_reload(
    state: tauri::State<BrowserState>,
    panel_id: String,
) -> Result<(), String> {
    let webviews = state
        .webviews
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;

    let webview = webviews
        .get(&panel_id)
        .ok_or_else(|| format!("no webview for panel_id '{panel_id}'"))?;

    webview
        .eval("window.location.reload()")
        .map_err(|e| format!("eval reload failed: {e}"))
}
