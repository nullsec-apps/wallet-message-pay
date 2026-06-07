import { useMemo, useState, useCallback } from 'react';
import {
  getCountryList,
  getCountryEntry,
  getPhoneCountry,
  isoToFlag,
  type CountryEntry,
  type CountryCode,
} from '../lib/phone';

/**
 * Provides country code, flag, and E.164 metadata for global phone addressing
 * and the country flag strip. Static, derived from libphonenumber-js — real
 * canonical data, never invented.
 */

// 14 representative active countries for the landing flag strip
const FEATURED_ISO: CountryCode[] = [
  'ES', 'GB', 'US', 'NG', 'IN', 'BR', 'MX', 'PH', 'KE', 'FR', 'DE', 'AE', 'ID', 'CO',
];

export interface UseCountryData {
  countries: CountryEntry[];
  featured: CountryEntry[];
  query: string;
  setQuery: (q: string) => void;
  filtered: CountryEntry[];
  lookupByIso: (iso: CountryCode) => CountryEntry | null;
  lookupByPhone: (phone: string) => CountryEntry | null;
  flagFor: (iso?: string | null) => string;
}

export function useCountryData(): UseCountryData {
  const [query, setQuery] = useState('');

  const countries = useMemo(() => getCountryList(), []);

  const featured = useMemo(() => {
    return FEATURED_ISO.map((iso) => getCountryEntry(iso)).filter(
      (c): c is CountryEntry => !!c
    );
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.callingCode.replace('+', '').includes(q.replace('+', ''))
    );
  }, [countries, query]);

  const lookupByIso = useCallback((iso: CountryCode) => getCountryEntry(iso), []);

  const lookupByPhone = useCallback((phone: string) => {
    const iso = getPhoneCountry(phone);
    if (!iso) return null;
    return getCountryEntry(iso);
  }, []);

  const flagFor = useCallback((iso?: string | null) => isoToFlag(iso), []);

  return {
    countries,
    featured,
    query,
    setQuery,
    filtered,
    lookupByIso,
    lookupByPhone,
    flagFor,
  };
}
