import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

/**
 * Marquee strip of country flags reinforcing global / multi-country support.
 * Static, clearly-labeled example content — not live data.
 */

const FLAGS: { iso: string; flag: string; name: string }[] = [
  { iso: 'ES', flag: '\uD83C\uDDEA\uD83C\uDDF8', name: 'Spain' },
  { iso: 'US', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'United States' },
  { iso: 'GB', flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'United Kingdom' },
  { iso: 'NG', flag: '\uD83C\uDDF3\uD83C\uDDEC', name: 'Nigeria' },
  { iso: 'BR', flag: '\uD83C\uDDE7\uD83C\uDDF7', name: 'Brazil' },
  { iso: 'IN', flag: '\uD83C\uDDEE\uD83C\uDDF3', name: 'India' },
  { iso: 'PH', flag: '\uD83C\uDDF5\uD83C\uDDED', name: 'Philippines' },
  { iso: 'MX', flag: '\uD83C\uDDF2\uD83C\uDDFD', name: 'Mexico' },
  { iso: 'KE', flag: '\uD83C\uDDF0\uD83C\uDDEA', name: 'Kenya' },
  { iso: 'FR', flag: '\uD83C\uDDEB\uD83C\uDDF7', name: 'France' },
  { iso: 'DE', flag: '\uD83C\uDDE9\uD83C\uDDEA', name: 'Germany' },
  { iso: 'AR', flag: '\uD83C\uDDE6\uD83C\uDDF7', name: 'Argentina' },
  { iso: 'ID', flag: '\uD83C\uDDEE\uD83C\uDDE9', name: 'Indonesia' },
  { iso: 'ZA', flag: '\uD83C\uDDFF\uD83C\uDDE6', name: 'South Africa' },
];

export interface CountryFlagStripProps {
  label?: string;
  className?: string;
}

export function CountryFlagStrip({
  label = 'Active in 90+ countries',
  className = '',
}: CountryFlagStripProps) {
  const loop = useMemo(() => [...FLAGS, ...FLAGS], []);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Globe size={16} strokeWidth={1.5} className="text-[#3EE6A8]" />
        <span className="text-xs font-medium tracking-wide text-[#7E8896] uppercase">
          {label}
        </span>
      </div>
      <div className="relative overflow-hidden" aria-hidden="true">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0E1116] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0E1116] to-transparent z-10" />
        <motion.div
          className="flex gap-2 w-max"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
        >
          {loop.map((c, i) => (
            <div
              key={`${c.iso}-${i}`}
              title={c.name}
              className="flex items-center gap-2 shrink-0 rounded-full border border-white/8 bg-[#171B22] px-3 py-1.5 transition-all duration-200 hover:border-[#0052FF]/40"
            >
              <span className="text-base leading-none">{c.flag}</span>
              <span className="text-xs text-[#7E8896] font-medium">{c.iso}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default CountryFlagStrip;
