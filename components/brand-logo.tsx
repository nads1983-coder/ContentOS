import { clsx } from "clsx";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base"
};

export function BrandLogo({
  size = "md",
  showWordmark = true,
  className
}: BrandLogoProps) {
  return (
    <div className={clsx("flex min-w-0 max-w-full items-center gap-3", className)}>
      <div
        className={clsx(
          "grid shrink-0 place-items-center rounded-lg border border-gold/55 bg-[linear-gradient(135deg,rgba(139,63,242,0.38),rgba(201,154,34,0.18))] font-bold text-goldSoft shadow-gold ring-1 ring-white/10",
          sizeClasses[size]
        )}
        aria-hidden="true"
      >
        CO
      </div>
      {showWordmark ? (
        <div className="min-w-0 max-w-[calc(100vw-6rem)] sm:max-w-none">
          <p className="truncate text-base font-extrabold tracking-normal text-bone sm:text-lg">
            Content<span className="text-goldSoft">OS</span>
          </p>
          <p className="text-xs leading-5 text-muted sm:hidden">
            Create from one idea.
          </p>
          <p className="hidden truncate text-xs text-muted sm:block">
            Create platform-ready content from one idea.
          </p>
        </div>
      ) : null}
    </div>
  );
}
