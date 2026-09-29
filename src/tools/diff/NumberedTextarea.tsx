// A fixed-size text field with faint line numbers in its left margin.
//
// A textarea can't draw a gutter, so a copy of the text sits behind it with
// the same font, width and wrapping, one block per line, and each block
// carries its number in the margin. A wrapped line's number stays on its
// first visual line, the way a code editor numbers it, with no measuring:
// the browser wraps both copies the same way. The copy follows the field's
// scroll position and its width (which narrows when a scrollbar appears).
import { useLayoutEffect, useMemo, useRef, type ComponentProps } from "react";
import { cn } from "cn";

// Shared by the field and the copy behind it, so they wrap alike.
const textCls = "py-2.5 pr-3 pl-11 text-sm leading-6 md:text-base md:leading-6";

export function NumberedTextarea({ value, className, ...props }: ComponentProps<"textarea"> & { value: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);

  const follow = () => {
    if (!field.current || !copy.current) return;
    copy.current.style.width = `${field.current.clientWidth}px`;
    copy.current.style.transform = `translateY(${-field.current.scrollTop}px)`;
  };

  useLayoutEffect(follow, [value]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(follow);
    observer.observe(field.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      <div
        ref={copy}
        aria-hidden="true"
        className={cn(textCls, "pointer-events-none absolute top-0 left-0 whitespace-pre-wrap break-words text-transparent select-none")}
      >
        {lines.map((line, i) => (
          <div key={i} className="relative">
            <span className="absolute right-full mr-3 text-xs leading-[inherit] text-muted-foreground/55 tabular-nums">
              {i + 1}
            </span>
            {line || "​"}
          </div>
        ))}
      </div>
      <textarea
        ref={field}
        value={value}
        onScroll={follow}
        className={cn(
          textCls,
          "relative block size-full resize-none bg-transparent outline-none placeholder:text-muted-foreground",
        )}
        {...props}
      />
    </div>
  );
}
