import { BadgeCheck } from 'lucide-react';
import BansosSimulation from './BansosSimulation';

export default function HeroSection() {
  return (
    <section id="sisim" className="relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]">
        <svg
          className="h-full w-full"
          viewBox="0 0 1000 1000"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <circle
            cx="500"
            cy="500"
            r="450"
            stroke="#0059bb"
            strokeWidth="2"
            strokeDasharray="8 8"
          />
          <circle cx="500" cy="500" r="350" stroke="#944a00" strokeWidth="2" />
          <path d="M200 500 Q 350 400, 500 500 T 800 500" stroke="#0059bb" strokeWidth="3" />
          <path d="M150 550 Q 350 450, 500 550 T 850 550" stroke="#944a00" strokeWidth="2" />
          <text
            x="500"
            y="520"
            textAnchor="middle"
            fill="#0059bb"
            fontSize="72"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            CEK BANSOS 2026
          </text>
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="flex flex-col items-center space-y-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-secondary-fixed px-4 py-1.5 text-xs font-bold text-on-secondary-fixed">
            <BadgeCheck className="h-4 w-4" aria-hidden /> Program Cek Bansos 2026
          </span>

          <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-on-surface lg:text-5xl">
            Cek Bantuan Bansos 2026
          </h1>

          <div className="flex w-full justify-center pt-2">
            <BansosSimulation />
          </div>
        </div>
      </div>
    </section>
  );
}
