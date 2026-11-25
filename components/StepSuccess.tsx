'use client';

import { CheckCircle2, ExternalLink, RotateCcw, FlaskConical } from 'lucide-react';

type Props = {
  name: string;
  phone: string;
  onReset: () => void;
};

export default function StepSuccess({ name, phone, onReset }: Props) {
  const formatPhoneDisplay = (num: string) => {
    if (!num) return '';
    if (num.startsWith('62')) {
      const rest = num.slice(2);
      if (rest.length <= 3) return `+62 ${rest}`;
      if (rest.length <= 7) return `+62 ${rest.slice(0, 3)}-${rest.slice(3)}`;
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    return num;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mb-1 inline-flex rounded-full bg-primary-fixed p-3 text-primary ring-8 ring-primary-fixed/40">
          <CheckCircle2 className="h-10 w-10" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-on-surface sm:text-2xl">Cek Bantuan Berhasil!</h2>
        <p className="text-xs text-on-surface-variant sm:text-sm">
          Berikut Hasil Data dari bantuan Anda
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-primary-fixed-dim bg-gradient-to-br from-surface-container-low to-secondary-fixed/30 p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="text-xs font-medium text-on-surface-variant">Nama</span>
          <span className="text-sm font-bold uppercase text-on-surface">{name}</span>
        </div>
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="text-xs font-medium text-on-surface-variant">Telepon</span>
          <span className="font-mono text-xs font-bold text-on-surface">
            {formatPhoneDisplay(phone)}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="text-xs font-medium text-on-surface-variant">Status</span>
          <span className="rounded-full border border-outline-variant bg-primary-fixed px-2.5 py-0.5 text-xs font-bold text-on-primary-fixed">
            TERDAFTAR
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="text-xs font-medium text-on-surface-variant">Periode</span>
          <span className="text-xs font-semibold text-on-surface">Tahap 2 (2026)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant">Saluran</span>
          <span className="text-xs font-bold text-primary">Bank BNI</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <a
          href="https://kemensos.go.id"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition-all hover:bg-primary-container"
        >
          <ExternalLink className="h-4 w-4" /> Kunjungi Situs Resmi Kemensos
        </a>
      </div>
    </div>
  );
}
