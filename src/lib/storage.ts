// UI state only (INTENT.md): theme, sidebar. Never anything from the
// content a tool processes. Every key lives under sidebench:site:*.
// localStorage can throw (privacy modes, blocked storage); the setting is
// then simply not remembered.

const PREFIX = "sidebench:site:";

export type SiteSetting = "theme" | "sidebar";

export function readSetting(key: SiteSetting): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSetting(key: SiteSetting, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not persisted; the page still works.
  }
}
