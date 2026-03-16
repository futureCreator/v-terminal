import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export const browserIpc = {
  async createWebview(panelId: string, url: string | null, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("create_browser_webview", { panelId, url, x, y, width, height })
  },

  async navigate(panelId: string, url: string): Promise<void> {
    return invoke("navigate_browser", { panelId, url })
  },

  async close(panelId: string): Promise<void> {
    return invoke("close_browser_webview", { panelId })
  },

  async setBounds(panelId: string, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("set_browser_bounds", { panelId, x, y, width, height })
  },

  async show(panelId: string): Promise<void> {
    return invoke("show_browser_webview", { panelId })
  },

  async hide(panelId: string): Promise<void> {
    return invoke("hide_browser_webview", { panelId })
  },

  async goBack(panelId: string): Promise<void> {
    return invoke("browser_go_back", { panelId })
  },

  async goForward(panelId: string): Promise<void> {
    return invoke("browser_go_forward", { panelId })
  },

  async reload(panelId: string): Promise<void> {
    return invoke("browser_reload", { panelId })
  },

  async onUrlChanged(handler: (data: { panelId: string; url: string }) => void): Promise<UnlistenFn> {
    return listen("browser:url-changed", (event) => handler(event.payload as any))
  },

  async onTitleChanged(handler: (data: { panelId: string; title: string }) => void): Promise<UnlistenFn> {
    return listen("browser:title-changed", (event) => handler(event.payload as any))
  },

  async onLoadingChanged(handler: (data: { panelId: string; isLoading: boolean }) => void): Promise<UnlistenFn> {
    return listen("browser:loading-changed", (event) => handler(event.payload as any))
  },
}
