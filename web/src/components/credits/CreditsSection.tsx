import { ExternalLink, FileText, Github } from 'lucide-react';
import { SITE, TEAM } from '../../content';
import type { Strings } from '../../i18n';
import { SectionHeader } from '../layout/SectionHeader';

export function CreditsSection({ t, lang, onOpenPaper }: { t: Strings; lang: 'en' | 'id'; onOpenPaper: () => void }) {
  const c = t.credits;
  return (
    <section id="credits" className="py-16 border-b border-[#EFE6DF] dark:border-white/[0.06] bg-[#FAF6F2] dark:bg-[#070504]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <ul className="lg:col-span-3 space-y-3">
            {TEAM.map(member => (
              <li key={member.name} className="p-4 rounded-xl bg-white dark:bg-[#140D0A] border border-[#EFE6DF] dark:border-[#2C1C14] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F5ECE5] dark:bg-[#261811] flex items-center justify-center text-[#C93300] dark:text-[#FFA200] font-bold font-console text-sm border border-[#EFE6DF] dark:border-[#3D2619]">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#1A110C] dark:text-[#FAF5F0]">
                      {member.name}
                      {member.me && <span className="ml-2 text-[10px] font-console px-1.5 py-0.5 rounded bg-[#FF5500] text-white align-middle">{c.me}</span>}
                    </div>
                    <div className="text-xs text-[#6B5E57] dark:text-[#A89689]">{member.role[lang]}</div>
                  </div>
                </div>
                {member.github && (
                  <a
                    href={`https://github.com/${member.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 p-2 text-xs text-[#8C7769] hover:text-[#FF5500] font-console"
                    title={`github.com/${member.github}`}
                  >
                    <Github className="w-4 h-4" />
                    <span className="hidden sm:inline">{member.github}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="lg:col-span-2 p-5 rounded-xl bg-[#0B0705] border border-[#2C1C14] text-[#E5D7CE] flex flex-col">
            <div className="text-[11px] uppercase tracking-wider text-[#8C7769] font-console mb-1">PDF</div>
            <h3 className="font-academic text-xl italic text-white">
              {c.paperTitle} <span className="text-sm not-italic text-[#A89689]">{c.paperBy}</span>
            </h3>
            <p className="mt-2 text-xs text-[#A89689] leading-relaxed">{c.paperQuestion}</p>
            <ol className="mt-4 space-y-1 text-xs font-console text-[#E5D7CE] list-decimal pl-5">
              {c.sections.map(section => (
                <li key={section}>{section}</li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={onOpenPaper} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF5500] to-[#C93300] text-white rounded-lg text-xs font-semibold font-console">
                <FileText className="w-4 h-4" />
                {c.readPaper}
              </button>
              <a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-console border border-[#2C1C14] hover:border-[#FF5500]/60">
                <ExternalLink className="w-4 h-4" />
                {c.repo}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
