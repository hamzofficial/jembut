'use client';

import { useState } from 'react';
import { User, Phone, ArrowRight, Loader2, AlertCircle, FlaskConical, Lock } from 'lucide-react';

type Props = {
  onSubmitted: (name: string, phone: string) => Promise<void>;
};

export default function StepForm({ onSubmitted }: Props) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    setPhoneError('');
    if (!raw) {
      setPhoneNumber('');
      return;
    }
    // Allow digits and plus sign
    let cleaned = raw.replace(/[^\d+]/g, '');
    
    // Auto format 08 -> +628 is fine, but allow typing + for international
    if (cleaned.startsWith('08')) {
      cleaned = '+628' + cleaned.slice(2);
    } else if (cleaned.startsWith('8') && !raw.startsWith('+')) {
      cleaned = '+628' + cleaned.slice(1);
    }
    setPhoneNumber(cleaned.slice(0, 18));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasErr = false;
    if (!fullName.trim()) {
      setNameError('Nama lengkap wajib diisi');
      hasErr = true;
    }
    if (!phoneNumber) {
      setPhoneError('Nomor HP wajib diisi');
      hasErr = true;
    } else if (phoneNumber.length < 10) {
      setPhoneError('Nomor HP tidak valid (minimal 10 digit)');
      hasErr = true;
    }
    if (hasErr) return;

    setServerError('');
    setIsLoading(true);
    try {
      await onSubmitted(fullName.trim(), phoneNumber);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-outline-variant pb-4 text-center">
        {/* <div className="mb-1 inline-flex rounded-2xl bg-primary-fixed p-3 text-primary ring-8 ring-primary-fixed/40">
          <FlaskConical className="h-8 w-8" aria-hidden />
        </div> */}
        <h2 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
          Cek Data Bansos 2026
        </h2>
        {/* <p className="text-xs font-medium text-on-surface-variant sm:text-sm">
          Demo Interaktif — isi data fiktif
        </p> */}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Nama Lengkap <span className="text-error">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-outline">
              <User className="h-5 w-5" />
            </span>
            <input
              type="text"
              value={fullName}
              onChange={e => {
                setFullName(e.target.value);
                setNameError('');
              }}
              placeholder="Budi"
              className={`w-full rounded-xl border bg-surface-container-low py-3 pl-11 pr-4 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-outline ${
                nameError
                  ? 'border-error ring-1 ring-error'
                  : 'border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed'
              }`}
            />
          </div>
          {nameError && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
              <AlertCircle className="h-3.5 w-3.5" /> {nameError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Nomor HP <span className="text-error">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-outline">
              <Phone className="h-5 w-5" />
            </span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="08123456789"
              className={`w-full rounded-xl border bg-surface-container-low py-3 pl-11 pr-4 text-sm font-semibold text-on-surface outline-none transition-all placeholder:text-outline ${
                phoneError
                  ? 'border-error ring-1 ring-error'
                  : 'border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed'
              }`}
            />
          </div>
          {phoneError && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
              <AlertCircle className="h-3.5 w-3.5" /> {phoneError}
            </p>
          )}
        </div>

        {serverError && (
          <p className="flex items-center gap-1 text-xs font-medium text-error">
            <AlertCircle className="h-3.5 w-3.5" /> {serverError}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 font-bold text-on-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Memproses Data...</span>
              </>
            ) : (
              <>
                <span>Cek Data</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
