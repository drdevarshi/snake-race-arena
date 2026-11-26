import Link from "next/link";
import { getT } from "@/i18n/translate";
import { getCourse, listCourseIds } from "@/game/courses";
import { CoursePreview } from "@/components/game/CoursePreview";
import { NeonLink } from "@/components/ui/NeonButton";
import { IconApple, IconPlay, IconTrophy } from "@/components/ui/Icons";

export const metadata = { title: "Game Arena" };

export default function ArenaPage() {
  const t = getT();
  const courses = listCourseIds().map((id) => getCourse(id)!);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 max-sm:py-5 sm:px-6">
      <header className="mb-10 max-sm:mb-5">
        <h1 className="font-display text-4xl font-black uppercase max-sm:text-3xl">
          <span className="text-neon-gradient">{t("arena.title")}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-400 max-sm:text-base">{t("arena.subtitle")}</p>
      </header>

      <h2 className="mb-4 font-display text-xl font-bold uppercase text-white max-sm:mb-3 max-sm:text-lg">{t("arena.practiceTitle")}</h2>
      <div className="grid gap-6 max-sm:gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <article key={c.id} className="panel overflow-hidden transition-all hover:border-neon-green/60 hover:shadow-glow-green">
            {/* Tapping the preview starts the course. It repeats the Play link, so it is skipped by Tab and screen readers. */}
            <Link href={`/play?course=${c.id}`} tabIndex={-1} aria-hidden className="block border-b border-arena-border bg-arena-black p-3 max-sm:p-2">
              <CoursePreview courseId={c.id} className="aspect-[14/9] w-full" />
            </Link>
            {/* Phones: Play sits directly under the description; from sm up the original order is kept. */}
            <div className="p-5 max-sm:flex max-sm:flex-col max-sm:p-4">
              <h3 className="font-display text-xl font-bold uppercase text-white max-sm:text-lg">{t(c.nameKey)}</h3>
              <p className="mt-1 text-slate-400 max-sm:text-sm">{t(`game.courseDesc.${c.id}`)}</p>
              <ul className="mt-3 flex flex-wrap max-sm:order-1 gap-x-4 gap-y-1 text-sm font-semibold text-slate-400">
                <li className="flex items-center gap-1.5"><IconApple width={16} height={16} className="text-red-400" />{c.apples.length}</li>
                <li>{t("arena.size", { w: c.width, h: c.height })}</li>
                <li>{t("arena.defaultSpeed", { speed: t(`game.speeds.${c.defaultSpeed}`) })}</li>
              </ul>
              <NeonLink href={`/play?course=${c.id}`} className="mt-5 max-sm:mt-3 max-sm:self-start" icon={<IconPlay width={18} height={18} />}>
                {t("arena.play")}
              </NeonLink>
            </div>
          </article>
        ))}
      </div>

      <section className="panel mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
        <IconTrophy width={40} height={40} className="shrink-0 text-neon-gold" />
        <div>
          <h2 className="font-display text-lg font-bold uppercase text-white">{t("arena.competitionsTitle")}</h2>
          <p className="text-slate-400">{t("arena.competitionsSoon")}</p>
        </div>
      </section>
    </div>
  );
}
