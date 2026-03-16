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
 * Returns true if the font was successfully loaded, false if it fell back.
 */
export async function ensureSpecificFontLoaded(family: string): Promise<boolean> {
  try {
    await Promise.all([
      document.fonts.load(`14px "${family}"`),
      document.fonts.load(`bold 14px "${family}"`),
    ]);
    const loaded = document.fonts.check(`14px "${family}"`);
    if (!loaded) {
      console.warn(`[font] "${family}" not available — will use fallback font`);
    }
    return loaded;
  } catch {
    console.warn(`[font] Failed to load "${family}" — will use fallback font`);
    return false;
  }
}
