import { useState } from 'react';
import { Eye, Github, Menu, Moon, Sun, X } from 'lucide-react';
import { SITE } from '../../content';
import type { Strings } from '../../i18n';
import type { Lang } from '../../types';
import { Logo } from './Logo';

interface HeaderProps {
  t: Strings;
  lang: Lang;
  onToggleLang: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export function Header({ t, lang, onToggleLang, isDark, onToggleDark, reducedMotion, onToggleReducedMotion }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const links = [
    ['#story', t.nav.caseStudy],
    ['#figures', t.nav.howItWorks],
    ['#console', t.nav.demo],
    ['#results', t.nav.results],
    ['#credits', t.nav.team],
  ];
  const iconButton =
    'p-2 rounded-full border border-white/10 text-white/70 hover:text-white bg-white/[0.04] hover:border-[#FF5500]/50 transition-all';

  return (
    <header className="sticky top-0 z-50 bg-[#070504]/90 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="#hero" className="flex items-center gap-2.5 shrink-0 group" aria-label="K-Chain">
          <Logo className="w-7 h-7 transition-transform group-hover:rotate-45" />
          <span className="font-sans text-lg font-bold tracking-tight text-white">
            {SITE.name}
            <span className="text-[#FF5500]">.</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-1 bg-[#140D0A]/90 border border-white/10 px-3 py-1.5 rounded-full text-xs text-white/70">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="px-3 py-1 rounded-full hover:text-white hover:bg-white/[0.06] transition-all whitespace-nowrap">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleLang}
            className="px-2.5 py-1 text-xs font-bold rounded-full border border-white/10 bg-white/[0.04] text-white/90 hover:border-[#FF5500]/50 hover:bg-[#FF5500]/10 transition-all font-console"
            title={t.nav.switchLang}
            aria-label={t.nav.switchLang}
          >
            {lang === 'en' ? 'ID' : 'EN'}
          </button>
          <button
            onClick={onToggleReducedMotion}
            className={`hidden sm:inline-flex ${reducedMotion ? 'p-2 rounded-full border bg-orange-500/20 border-orange-500 text-[#FFA200]' : iconButton}`}
            title={t.nav.reducedMotion}
            aria-label={t.nav.reducedMotion}
            aria-pressed={reducedMotion}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggleDark} className={iconButton} title={t.nav.theme} aria-label={t.nav.theme}>
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#FFA200]" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer" className={`hidden sm:inline-flex ${iconButton}`} title={t.nav.github} aria-label={t.nav.github}>
            <Github className="w-3.5 h-3.5" />
          </a>
          <a
            href="#console"
            className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-black bg-white hover:bg-orange-50 rounded-full transition-all whitespace-nowrap"
          >
            {t.nav.tryDemo}
          </a>
          <button onClick={() => setOpen(v => !v)} className={`lg:hidden ${iconButton}`} aria-label={t.nav.menu} aria-expanded={open}>
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-white/[0.06] bg-[#0B0705] px-4 py-3 flex flex-col text-sm">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="py-2.5 text-white/80 hover:text-white border-b border-white/[0.04] last:border-0">
              {label}
            </a>
          ))}
          <div className="flex items-center gap-2 pt-3">
            <a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer" className={iconButton} aria-label={t.nav.github}>
              <Github className="w-4 h-4" />
            </a>
            <button onClick={onToggleReducedMotion} className={iconButton} aria-label={t.nav.reducedMotion} aria-pressed={reducedMotion}>
              <Eye className={`w-4 h-4 ${reducedMotion ? 'text-[#FFA200]' : ''}`} />
            </button>
            <a href="#console" onClick={() => setOpen(false)} className="ml-auto px-4 py-2 text-xs font-semibold text-black bg-white rounded-full">
              {t.nav.tryDemo}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
