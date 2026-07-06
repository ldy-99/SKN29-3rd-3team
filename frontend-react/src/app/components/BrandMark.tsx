export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-10 w-[116px] shrink-0 overflow-hidden ${className}`}>
      <img
        src="/afit-logo.png"
        alt="AFIT"
        className="absolute -left-4 -top-12 h-[145px] w-[145px] max-w-none select-none mix-blend-multiply"
        draggable={false}
      />
    </span>
  );
}
