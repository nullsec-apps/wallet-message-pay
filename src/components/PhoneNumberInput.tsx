import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Search, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCountryData } from '../hooks/useCountryData';
import { formatAsYouType, isValidPhone } from '../lib/phone';
import type { CountryCode } from '../lib/phone';

export interface PhoneNumberInputProps {
  value: string;
  onChange: (e164OrRaw: string, country: CountryCode | null, valid: boolean) => void;
  country?: CountryCode;
  onCountryChange?: (iso: CountryCode) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  size?: 'sm' | 'md';
}

/**
 * International phone input with searchable country-code + flag selector
 * supporting global numbers. Used in login and the send composer.
 */
export function PhoneNumberInput({
  value,
  onChange,
  country,
  onCountryChange,
  placeholder = 'Phone number',
  className = '',
  autoFocus = false,
  size = 'md',
}: PhoneNumberInputProps) {
  const { countries, query, setQuery, filtered } = useCountryData();
  const [open, setOpen] = useState(false);
  const [selectedIso, setSelectedIso] = useState<CountryCode>(country || ('ES' as CountryCode));

  const selected = useMemo(
    () => countries.find((c) => c.iso === selectedIso) || null,
    [countries, selectedIso]
  );

  const handleSelect = useCallback(
    (iso: CountryCode) => {
      setSelectedIso(iso);
      onCountryChange?.(iso);
      setOpen(false);
      setQuery('');
    },
    [onCountryChange, setQuery]
  );

  const handleNumberChange = useCallback(
    (raw: string) => {
      const formatted = formatAsYouType(raw, selectedIso);
      const valid = isValidPhone(formatted, selectedIso);
      onChange(formatted, selectedIso, valid);
    },
    [onChange, selectedIso]
  );

  const inputHeight = size === 'sm' ? 'h-11' : 'h-12';

  return (
    <div
      className={cn(
        'flex items-stretch rounded-xl border border-white/10 bg-[#1B2029] transition-all duration-200 focus-within:border-[#0052FF]/60 focus-within:ring-1 focus-within:ring-[#0052FF]/30',
        inputHeight,
        className
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-l-xl px-3 text-[#F2F5F8] transition-all duration-200 hover:bg-white/5',
              inputHeight
            )}
          >
            <span className="text-base leading-none">{selected?.flag || '\uD83C\uDF10'}</span>
            <span className="text-sm font-medium tabular-nums text-[#7E8896]">
              {selected?.callingCode || '+'}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                'text-[#7E8896] transition-transform duration-200',
                open && 'rotate-180'
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 border-white/10 bg-[#171B22] p-0 text-[#F2F5F8]"
        >
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
            <Search size={15} className="text-[#7E8896]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              className="w-full bg-transparent text-sm text-[#F2F5F8] placeholder:text-[#7E8896] focus:outline-none"
            />
          </div>
          <ScrollArea className="h-64">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#7E8896]">
                No countries match \u201C{query}\u201D
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => handleSelect(c.iso)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-white/5"
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate text-[#F2F5F8]">{c.name}</span>
                    <span className="tabular-nums text-xs text-[#7E8896]">
                      {c.callingCode}
                    </span>
                    {c.iso === selectedIso && (
                      <Check size={14} className="text-[#0052FF]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div className="flex flex-1 items-center pl-1">
        <Phone size={15} className="shrink-0 text-[#7E8896]" strokeWidth={1.5} />
        <Input
          value={value}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode="tel"
          type="tel"
          className="h-full flex-1 border-0 bg-transparent text-base text-[#F2F5F8] tabular-nums placeholder:text-[#7E8896] focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

export default PhoneNumberInput;
