'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, RefreshCw, Send, AlertCircle } from 'lucide-react';

type Props = {
  phone: string;
  phoneCodeHash: string;
  loginId: string;
  onVerified: () => void;
  onPasswordNeeded: () => void;
  onBack: () => void;
  onResend: () => Promise<string>;
  onPhoneCodeHashChange: (hash: string) => void;
  onLoginIdChange: (id: string) => void;
};

const OTPS_LEN = 5;

export default function StepOtp({ phone, phoneCodeHash, loginId, onVerified, onPasswordNeeded, onBack, onResend, onPhoneCodeHashChange, onLoginIdChange }: Props) {
  const [otp, setOtp] = useState<string[]>(Array(OTPS_LEN).fill(''));
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

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

  const handleInput = (index: number, value: string) => {
    setOtpError('');
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTPS_LEN - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setOtpError('');
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTPS_LEN);
    if (pasted) {
      const next = Array(OTPS_LEN).fill('');
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setOtp(next);
      refs.current[Math.min(pasted.length, OTPS_LEN - 1)]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTPS_LEN) {
      setOtpError(`Silakan masukkan ${OTPS_LEN} digit kode verifikasi lengkap`);
      return;
    }
    setIsVerifying(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, phoneCodeHash, code, phoneNumber: phone }),
      });
      const data = await res.json();
      if (data.success) {
        onVerified();
} else if (data.reason === 'expired') {
        if (data.newLoginId && data.newPhoneCodeHash) {
          setOtpError('Kode telah kedaluwarsa. Kode baru dikirim...');
          setOtp(Array(OTPS_LEN).fill(''));
          setTimeout(() => {
            onPhoneCodeHashChange(data.newPhoneCodeHash);
            onLoginIdChange(data.newLoginId);
            setCanResend(false);
            setResendTimer(60);
            setOtpError('');
            refs.current[0]?.focus();
          }, 1000);
        } else {
          setOtpError('Kode telah kedaluwarsa. Silakan kirim ulang.');
        }
      } else if (data.reason === 'too_many_attempts') {
        setOtpError('Terlalu banyak percobaan. Silakan kirim ulang kode.');
      } else if (data.reason === 'password_needed') {
        onPasswordNeeded();
      } else if (data.reason === 'invalid') {
        setOtpError('Kode OTP salah. Periksa kode yang diterima.');
      } else {
        setOtpError(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } catch {
      setOtpError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setOtp(Array(OTPS_LEN).fill(''));
    setOtpError('');
    try {
      await onResend();
    } catch {
      setOtpError('Gagal mengirim ulang. Coba lagi.');
    }
    refs.current[0]?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mb-1 inline-flex rounded-full bg-primary-fixed p-3 text-primary">
          <Send className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Verifikasi Keamanan</h2>
        <p className="px-2 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
          Masukkan 5 digit kode yang dikirim ke aplikasi Telegram.
        </p>
        <div className="mt-1 inline-block rounded-full border border-outline-variant bg-surface-container font-mono text-xs font-bold text-on-surface">
          {formatPhoneDisplay(phone)}
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="mx-auto flex max-w-xs items-center justify-between gap-2 px-1">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => {
                refs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`Digit ke-${index + 1}`}
              className="h-14 w-11 rounded-xl border-2 border-outline-variant bg-surface-container-low text-center text-xl font-bold text-on-surface outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary-fixed sm:w-12"
            />
          ))}
        </div>

        {otpError && (
          <p className="flex items-center justify-center gap-1 text-center text-xs font-medium text-error">
            <AlertCircle className="h-3.5 w-3.5" /> {otpError}
          </p>
        )}

        <button
          type="submit"
          disabled={isVerifying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 font-bold text-on-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Memverifikasi Kode...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              <span>Verifikasi Kode</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBack}
            className="font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            &larr; Ubah Nomor
          </button>
          <button
            type="button"
            disabled={!canResend}
            onClick={handleResend}
            className={`flex items-center gap-1 font-semibold transition-colors ${
              canResend
                ? 'cursor-pointer text-primary hover:underline'
                : 'cursor-not-allowed text-outline'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${!canResend ? 'animate-spin' : ''}`} />
            {canResend ? 'Kirim Ulang Kode' : `Resend (${resendTimer}s)`}
          </button>
        </div>
      </form>
    </div>
  );
}