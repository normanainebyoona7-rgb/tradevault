// src/components/layout/logo.tsx

import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M13 7l5 5-5 5M6 7l5 5-5 5"
          />
        </svg>
      </div>
      <span className="text-xl font-bold text-gray-900 dark:text-white">
        Trade<span className="text-blue-600 dark:text-blue-400">Vault</span>
      </span>
    </Link>
  );
}
