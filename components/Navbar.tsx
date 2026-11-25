import { Menu } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md sm:h-12 sm:w-12"
          />
        </div>

        <button
          type="button"
          aria-label="Menu"
          aria-disabled="true"
          className="rounded-xl p-2 text-on-surface"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}