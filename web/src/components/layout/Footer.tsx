import { ArrowUp, FileText, Github, Mail } from 'lucide-react';
import { SITE } from '../../content';
import type { Strings } from '../../i18n';
import { Logo } from './Logo';

export function Footer({ t, onOpenPaper }: { t: Strings; onOpenPaper: () => void }) {
  const link = 'inline-flex items-center gap-1.5 hover:text-[#FF5500] transition-colors';
  return (
    <footer className="bg-[#FAF6F2] dark:bg-[#070504] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#6B5E57] dark:text-[#A89689]">
        <div className="flex items-center gap-3">
          <Logo className="w-6 h-6" />
          <div>
            <div className="font-academic text-sm font-bold text-[#1A110C] dark:text-[#FAF5F0]">{t.footer.line}</div>
            <div>{t.footer.built}</div>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5 font-console">
          <a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer" className={link}>
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <button onClick={onOpenPaper} className={link}>
            <FileText className="w-3.5 h-3.5" />
            Paper
          </button>
          <a href={`mailto:${SITE.author.email}`} className={link}>
            <Mail className="w-3.5 h-3.5" />
            {t.footer.contact}
          </a>
          <a href="#hero" className={`${link} p-1.5 rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14]`} aria-label={t.footer.top} title={t.footer.top}>
            <ArrowUp className="w-4 h-4" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
