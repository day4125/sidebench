// UI state only (INTENT.md): theme, sidebar. Never anything from the
// content a tool processes. Every key lives under sidebench:site:*.
// localStorage can throw (privacy modes, blocked storage); the setting is
// then simply not remembered.

const PREFIX = "sidebench:site:";

export type SiteSetting = "theme" | "sidebar" | "text:hidden";

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

// Per-tab state: sessionStorage outlives a reload or a trip to another tool
// in the same tab and is gone when the tab closes. Same rule as above: UI
// state only.

export type SessionSetting = "chars:recent";

export function readSession(key: SessionSetting): string | null {
  try {
    return sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSession(key: SessionSetting, value: string) {
  try {
    sessionStorage.setItem(PREFIX + key, value);
  } catch {
    // Not kept; the page still works.
  }
}
