import { AlertCircle, CheckCircle2, Compass } from 'lucide-react';
import type { Strings } from '../../i18n';
import { SectionHeader } from './SectionHeader';

export function ProjectStory({ t }: { t: Strings }) {
  const cards = [
    { icon: AlertCircle, color: 'text-[#FF5500]', title: t.story.problemTitle, desc: t.story.problemDesc, foot: t.story.problemFoot },
    { icon: Compass, color: 'text-[#FFA200]', title: t.story.approachTitle, desc: t.story.approachDesc, foot: t.story.approachFoot },
    { icon: CheckCircle2, color: 'text-[#FF733B]', title: t.story.outcomeTitle, desc: t.story.outcomeDesc, foot: t.story.outcomeFoot },
  ];
  return (
    <section id="story" className="py-16 border-b border-[#EFE6DF] dark:border-white/[0.06] bg-[#FAF6F2] dark:bg-[#070504]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader eyebrow={t.story.eyebrow} title={t.story.title} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ icon: Icon, color, title, desc, foot }) => (
            <div
              key={title}
              className="p-6 rounded-2xl bg-white dark:bg-[#120B08] border border-[#EFE6DF] dark:border-white/[0.08] shadow-sm dark:shadow-xl dark:shadow-black/50 flex flex-col justify-between"
            >
              <div>
                <div className={`flex items-center gap-2 mb-3 ${color}`}>
                  <Icon className="w-5 h-5 shrink-0" />
                  <h3 className="font-academic text-lg font-semibold text-[#1A110C] dark:text-white">{title}</h3>
                </div>
                <p className="text-sm text-[#6B5A51] dark:text-[#C5B3A8] leading-relaxed">{desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#EFE6DF] dark:border-white/[0.06] text-[11px] font-console text-[#8D7B72]">{foot}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
