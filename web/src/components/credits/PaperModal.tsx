import { useEffect } from 'react';
import { ExternalLink, FileText, Github, X } from 'lucide-react';
import { SITE } from '../../content';
import type { Strings } from '../../i18n';

export function PaperModal({ t, open, onClose }: { t: Strings; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.paper.title}>
      <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-[#0B0705] border border-[#2C1C14] rounded-2xl overflow-hidden shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="px-4 sm:px-6 py-3 border-b border-[#2C1C14] flex items-center justify-between gap-3 bg-[#140D0A]">
          <span className="flex items-center gap-2 font-academic font-bold text-sm text-white">
            <FileText className="w-5 h-5 text-[#FF5500]" />
            {t.paper.title}
          </span>
          <div className="flex items-center gap-1">
            <a href={SITE.paperPdf} target="_blank" rel="noopener noreferrer" className="p-2 text-[#A89689] hover:text-white" title={t.paper.open} aria-label={t.paper.open}>
              <ExternalLink className="w-4 h-4" />
            </a>
            <a href={SITE.paperSource} target="_blank" rel="noopener noreferrer" className="p-2 text-[#A89689] hover:text-white" title={t.paper.github} aria-label={t.paper.github}>
              <Github className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-2 text-[#A89689] hover:text-white" aria-label={t.paper.close}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <object data={SITE.paperPdf} type="application/pdf" className="flex-1 w-full bg-white">
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[#1A110C]">
            <p>{t.paper.fallback}</p>
            <a href={SITE.paperPdf} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-[#FF5500] text-white font-semibold">
              {t.paper.open}
            </a>
          </div>
        </object>
      </div>
    </div>
  );
}
