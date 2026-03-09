import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

export function TitleBar({ title }: { title: string }) {
  const win = getCurrentWindow();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-traffic-lights">
        <button
          className="traffic-light traffic-close"
          onClick={() => win.close()}
          title="Close"
          aria-label="Close window"
        />
        <button
          className="traffic-light traffic-minimize"
          onClick={() => win.minimize()}
          title="Minimize"
          aria-label="Minimize window"
        />
        <button
          className="traffic-light traffic-maximize"
          onClick={() => win.toggleMaximize()}
          title="Zoom"
          aria-label="Zoom window"
        />
      </div>
      <span className="titlebar-title" data-tauri-drag-region>
        {title}
      </span>
      <div className="titlebar-spacer" data-tauri-drag-region />
    </div>
  );
}
