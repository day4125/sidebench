import { useCallback, useState } from "react";
import { writeSetting } from "@/lib/storage";

// The theme is a class on <html>. public/theme-init.js sets it before first
// paint (the saved choice, else the system's); this hook only reads and
// flips it.

export type Theme = "light" | "dark";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    writeSetting("theme", next);
    setThemeState(next);
  }, []);
  return { theme, setTheme };
}
