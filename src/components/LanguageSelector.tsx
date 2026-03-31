import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇿🇦' },
  { code: 'af', label: 'Afrikaans', flag: '🇿🇦' },
  { code: 'xh', label: 'IsiXhosa', flag: '🇿🇦' },
  { code: 'zu', label: 'IsiZulu', flag: '🇿🇦' },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
        title="Change language"
      >
        <Languages className="w-4 h-4" />
        <span className="hidden sm:inline uppercase text-xs font-black tracking-widest">
          {current.code}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white/90 backdrop-blur-md border border-white/40 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`w-full flex items-center space-x-2.5 px-4 py-2.5 text-sm font-medium transition-colors
                ${language === lang.code
                  ? 'bg-blue-50 text-blue-600 font-black'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
              {language === lang.code && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
