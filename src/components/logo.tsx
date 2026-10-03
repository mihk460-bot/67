export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-20 rounded-2xl" : "size-9 rounded-lg";
  const diamond = size === "lg" ? "size-10 rounded" : "size-4 rounded-[3px]";
  return (
    <div
      className={`${box} flex items-center justify-center border border-primary/60 bg-card`}
      aria-hidden
    >
      <div className={`${diamond} rotate-45 bg-primary`} />
    </div>
  );
}
