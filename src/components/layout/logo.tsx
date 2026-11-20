import Link from "next/link";

export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg
          viewBox="0 0 64 64"
          className="h-5 w-5"
          fill="none"
          aria-hidden="true"
        >
          <rect x="14" y="34" width="7" height="14" rx="2" fill="white" fillOpacity="0.55" />
          <rect x="25" y="26" width="7" height="22" rx="2" fill="white" fillOpacity="0.8" />
          <rect x="36" y="30" width="7" height="18" rx="2" fill="white" fillOpacity="0.65" />
          <path
            d="M15 26L26 18L35 23L45 13"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M45 13H39.5M45 13V18.5"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          Trade<span className="text-primary">Vault</span>
        </span>
      )}
    </Link>
  );
}
