import { useCallback, useEffect, useState } from 'react';
import { CreditsSection } from './components/credits/CreditsSection';
import { PaperModal } from './components/credits/PaperModal';
import { DemoSection } from './components/demo/DemoSection';
import { FiguresSection } from './components/figures/FiguresSection';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { Hero } from './components/layout/Hero';
import { ProjectStory } from './components/layout/ProjectStory';
import { ResultsSection } from './components/results/ResultsSection';
import { STRINGS } from './i18n';
import { useSandbox } from './lib/useSandbox';
import type { Lang } from './types';

function initialLang(): Lang {
  const saved = localStorage.getItem('chainmesh-lang');
  if (saved === 'en' || saved === 'id') return saved;
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('chainmesh-theme') !== 'light');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paperOpen, setPaperOpen] = useState(false);
  const sandbox = useSandbox();
  const t = STRINGS[lang];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('chainmesh-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('chainmesh-lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  const openPaper = useCallback(() => setPaperOpen(true), []);
  const closePaper = useCallback(() => setPaperOpen(false), []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F2] dark:bg-[#070504] text-[#1A110C] dark:text-[#FAF5F0]">
      <Header
        t={t}
        lang={lang}
        onToggleLang={() => setLang(current => (current === 'en' ? 'id' : 'en'))}
        isDark={isDark}
        onToggleDark={() => setIsDark(current => !current)}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion(current => !current)}
      />
      <main>
        <Hero t={t} lang={lang} snapshot={sandbox.snapshot} status={sandbox.status} onOpenPaper={openPaper} />
        <ProjectStory t={t} />
        <FiguresSection t={t} lang={lang} reducedMotion={reducedMotion} />
        <DemoSection t={t} lang={lang} sandbox={sandbox} reducedMotion={reducedMotion} />
        <ResultsSection t={t} />
        <CreditsSection t={t} lang={lang} onOpenPaper={openPaper} />
      </main>
      <Footer t={t} onOpenPaper={openPaper} />
      <PaperModal t={t} open={paperOpen} onClose={closePaper} />
    </div>
  );
}
