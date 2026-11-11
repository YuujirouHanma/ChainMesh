import type { Strings } from '../../i18n';
import { SectionHeader } from '../layout/SectionHeader';
import { Fig1BlockLink } from './Fig1BlockLink';
import { Fig2CompleteGraph } from './Fig2CompleteGraph';
import { Fig3NearestSync } from './Fig3NearestSync';
import { Fig4Broadcast } from './Fig4Broadcast';
import { Fig5Fork } from './Fig5Fork';
import { Fig6Checks } from './Fig6Checks';

export function FiguresSection({ t, lang, reducedMotion }: { t: Strings; lang: 'en' | 'id'; reducedMotion: boolean }) {
  return (
    <section id="figures" className="py-16 border-b border-[#EFE6DF] dark:border-white/[0.06] bg-[#FAF6F2] dark:bg-[#070504]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader eyebrow={t.figures.eyebrow} title={t.figures.title} subtitle={t.figures.subtitle} />
        <div className="space-y-10">
          <Fig1BlockLink t={t} lang={lang} />
          <Fig2CompleteGraph t={t} />
          <Fig3NearestSync t={t} />
          <Fig4Broadcast t={t} reducedMotion={reducedMotion} />
          <Fig5Fork t={t} lang={lang} />
          <Fig6Checks t={t} />
        </div>
      </div>
    </section>
  );
}
