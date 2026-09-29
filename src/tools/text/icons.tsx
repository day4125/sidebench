// Script icons on lucide's grid (24, stroke 2, round caps), so digits and
// letters read apart: x² / x₂ for digits (lucide's own Superscript and
// Subscript paths), xᵃ / xₐ for letters (the same x with a small "a").
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const X_HIGH = ["m4 19 8-8", "m12 19-8-8"];
const X_LOW = ["m4 5 8 8", "m12 5-8 8"];

export function SupDigits(props: Props) {
  return (
    <Svg {...props}>
      {X_HIGH.map((d) => <path key={d} d={d} />)}
      <path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06" />
    </Svg>
  );
}

export function SubDigits(props: Props) {
  return (
    <Svg {...props}>
      {X_LOW.map((d) => <path key={d} d={d} />)}
      <path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07" />
    </Svg>
  );
}

export function SupLetters(props: Props) {
  return (
    <Svg {...props}>
      {X_HIGH.map((d) => <path key={d} d={d} />)}
      <circle cx="17.5" cy="8.5" r="2.5" />
      <path d="M20 6v5" />
    </Svg>
  );
}

export function SubLetters(props: Props) {
  return (
    <Svg {...props}>
      {X_LOW.map((d) => <path key={d} d={d} />)}
      <circle cx="17.5" cy="16.5" r="2.5" />
      <path d="M20 14v5" />
    </Svg>
  );
}
