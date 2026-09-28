import { useEffect, useRef, useState } from "react";

/**
 * A flag that turns itself off after `ms`, for brief confirmations on a
 * button ("Kopierat", "Nedladdad"). The third item turns it off early.
 */
export function useFlash(ms = 1600): [boolean, () => void, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = () => {
    window.clearTimeout(timer.current);
    setOn(true);
    timer.current = window.setTimeout(() => setOn(false), ms);
  };
  const clear = () => {
    window.clearTimeout(timer.current);
    setOn(false);
  };
  return [on, flash, clear];
}
