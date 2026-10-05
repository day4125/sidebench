import type { SVGProps } from "react";

// The sidebench mark: a workbench. Lucide has no bench, so it's drawn here
// on lucide's grid (24 px, 2 px round strokes) to sit with the tool icons.
// public/favicon.svg is the same drawing on a cobalt tile.
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="6" width="18" height="4" rx="1" />
      <path d="M6 10 5 19M18 10l1 9M5.5 15h13" />
    </svg>
  );
}
