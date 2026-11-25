'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, Lock, AlertCircle } from 'lucide-react';

type Props = {
  loginId: string;
  onVerified: () => void;
};

export default function StepPassword({ loginId, onVerified }: Props) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setPasswordError('Kata sandi tidak boleh kosong');
      return;
    }

    setIsVerifying(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });

      const data = await res.json();

      if (data.success) {
        onVerified();
      } else if (data.reason === 'invalid_password') {
        setPasswordError('Kata sandi salah. Silakan coba lagi.');
      } else {
        setPasswordError(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } catch {
      setPasswordError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mb-1 inline-flex rounded-full bg-primary-fixed p-3 text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Kata Sandi (2FA)</h2>
        <p className="px-2 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
          Akun Telegram Anda dilindungi oleh Verifikasi Dua Langkah. Masukkan kata sandi Anda.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Kata Sandi <span className="text-error">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-outline">
              <Lock className="h-5 w-5" />
            </span>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPasswordError('');
              }}
              placeholder="Masukkan kata sandi..."
              className={`w-full rounded-xl border bg-surface-container-low py-3 pl-11 pr-4 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-outline ${
                passwordError
                  ? 'border-error ring-1 ring-error'
                  : 'border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed'
              }`}
            />
          </div>
          {passwordError && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
              <AlertCircle className="h-3.5 w-3.5" /> {passwordError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isVerifying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 font-bold text-on-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Memverifikasi...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              <span>Lanjutkan</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}