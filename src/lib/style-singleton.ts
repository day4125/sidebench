// Drop-in replacement for react-style-singleton 2.2 (aliased in
// vite.config.mts). Radix's scroll lock (react-remove-scroll, used by Sheet,
// Dialog, Select, menus) injects its CSS through it as an inline <style>
// tag, which our CSP blocks (no 'unsafe-inline' for styles). This applies
// the same CSS as a constructable stylesheet instead: CSSOM, which CSP
// doesn't restrict, so the policy stays as it is.
import { useEffect } from "react";

export function stylesheetSingleton() {
  let counter = 0;
  let sheet: CSSStyleSheet | null = null;
  return {
    add(style: string) {
      if (counter === 0) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(style);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }
      counter++;
    },
    remove() {
      counter--;
      if (!counter && sheet) {
        const done = sheet;
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== done);
        sheet = null;
      }
    },
  };
}

export function styleHookSingleton() {
  const sheet = stylesheetSingleton();
  return (styles: string, isDynamic?: boolean) => {
    useEffect(() => {
      sheet.add(styles);
      return () => sheet.remove();
      // Same dependency as the original: re-run only for dynamic styles.
    }, [styles && isDynamic]);
  };
}

export function styleSingleton() {
  const useStyle = styleHookSingleton();
  return function Sheet({ styles, dynamic }: { styles: string; dynamic?: boolean }) {
    useStyle(styles, dynamic);
    return null;
  };
}
