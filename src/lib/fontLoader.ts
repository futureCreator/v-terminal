let defaultLoaded = false;

export async function ensureFontLoaded(): Promise<void> {
  if (defaultLoaded) return;
  try {
    await Promise.all([
      document.fonts.load('14px "JetBrainsMonoNerdFont"'),
      document.fonts.load('14px "Nanum Gothic Coding"').catch(() => {}),
    ]);
    defaultLoaded = true;
  } catch {
    // Fallback: just wait a tick for font to be injected
    await new Promise((r) => setTimeout(r, 100));
    defaultLoaded = true;
  }
}

/**
 * Ensure a specific font family is loaded before applying it to the terminal.
 * Uses the Font Loading API to trigger @font-face download and wait for it.
 */
export async function ensureSpecificFontLoaded(family: string): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`14px "${family}"`),
      document.fonts.load(`bold 14px "${family}"`),
    ]);
  } catch {
    // Font may not exist or load failed — xterm will fall back
  }
}
