interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}

/** Judul bagian bergaya buku teks: label kecil, judul serif, keterangan singkat. */
export function SectionHeader({ eyebrow, title, subtitle, dark = false }: SectionHeaderProps) {
  return (
    <div className="mb-10">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#FF5500] dark:text-[#FF6B1A] font-console mb-1">{eyebrow}</div>
      <h2 className={`font-academic text-3xl sm:text-4xl font-bold ${dark ? 'text-white' : 'text-[#1A110C] dark:text-[#FAF5F0]'}`}>{title}</h2>
      {subtitle && (
        <p className={`text-sm mt-2 max-w-3xl leading-relaxed ${dark ? 'text-[#A89689]' : 'text-[#6B5A51] dark:text-[#C5B3A8]'}`}>{subtitle}</p>
      )}
    </div>
  );
}
