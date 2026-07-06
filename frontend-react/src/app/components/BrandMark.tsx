import { Check, House } from "lucide-react";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex h-10 w-11 shrink-0 items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <House className="h-9 w-9 text-[#1d5f95]" strokeWidth={2.1} />
      <Check
        className="absolute -right-0.5 top-0 h-7 w-7 text-[#f28c28]"
        strokeWidth={3}
      />
    </span>
  );
}
