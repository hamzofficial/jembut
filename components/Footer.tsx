import { FlaskConical } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-variant bg-white py-8 text-center">
      <div className="mx-auto max-w-[1280px] space-y-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-on-surface-variant">
          <a href="#tentang" className="transition-colors hover:text-primary">
            Tentang Simulasi
          </a>
          <a href="#sisim" className="transition-colors hover:text-primary">
            Ketentuan
          </a>
          <a href="#bantuan" className="transition-colors hover:text-primary">
            Kebijakan Privasi
          </a>
          <a href="#bantuan" className="transition-colors hover:text-primary">
            Pusat Bantuan
          </a>    
        </div>
        <p className="text-xs font-semibold text-on-surface sm:text-sm">
          © 2026 Kementerian Sosial RI - Semua Hak Dilindungi Undang-Undang
        </p>
      </div>
    </footer>
  );
}
