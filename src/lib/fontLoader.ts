let loaded = false;

export async function ensureFontLoaded(): Promise<void> {
  if (loaded) return;
  try {
    await Promise.all([
      document.fonts.load('14px "JetBrainsMonoNerdFont"'),
      document.fonts.load('14px "Nanum Gothic Coding"').catch(() => {}),
    ]);
    loaded = true;
  } catch {
    // Fallback: just wait a tick for font to be injected
    await new Promise((r) => setTimeout(r, 100));
    loaded = true;
  }
}
