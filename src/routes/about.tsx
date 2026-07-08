import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECHNIQUES } from "@/lib/bjj/data";
import { Map, BookOpen, Dumbbell, TrendingUp, ShieldAlert, Target } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const total = TECHNIQUES.length;
  return (
    <AppShell>
      <div className="space-y-4">
        <header className="px-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">BJJ Companion</p>
          <h1 className="text-xl font-bold tracking-tight">Как пользоваться</h1>
        </header>

        <Card
          icon={<Map className="h-4 w-4" />}
          title="Карта обучения"
          text={`${total} техник, разложенных по поясам и разделам. Пояс — обводка узла, статус — заливка, кольцо — готовность пререквизитов. Клик по технике показывает её связи: «← Раньше» — что нужно знать до неё, «Дальше →» — куда она ведёт, «Путь» — вся цепочка изучения от вашего уровня.`}
        />
        <Card
          icon={<BookOpen className="h-4 w-4" />}
          title="Библиотека"
          text="Поиск и фильтры по поясу, разделу, Gi/No-Gi. У каждой техники: механика по шагам, ключевые моменты, типичные ошибки, дриллы для отработки и связанные техники."
        />
        <Card
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Безопасность"
          text="У каждой техники размечен риск травмы и сигнал «когда стучать». Включите фильтр «Риск» на карте, чтобы увидеть все травмоопасные техники. Берегите партнёров: плавность важнее финиша."
        />
        <Card
          icon={<Target className="h-4 w-4" />}
          title="Прогресс"
          text="Отмечайте техники: «в процессе» — учите сейчас, «изучено» — уверенно работает в спарринге. Карта подскажет, что открылось следующим — рекомендации строятся по вашим пререквизитам."
        />
        <Card
          icon={<Dumbbell className="h-4 w-4" />}
          title="Тренировка"
          text="Генератор персональной тренировки: разминка, техники под ваш пояс и фокус, заминка. Режим «безопасно» исключает травмоопасные техники."
        />
        <Card
          icon={<TrendingUp className="h-4 w-4" />}
          title="Что дальше"
          text="В разработке: видео к техникам, программы обучения («Первые 10 сабмишенов», «12 недель белого пояса»), интервальные повторения и английская версия."
        />

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          База: 293 техники, проверена методическим аудитом — покрытие от самостраховки до современного
          но-ги (K-гард, боди-треугольник, ретеншн-система). Данные о легальности: IBJJF Gi/No-Gi, ADCC.
        </p>
      </div>
    </AppShell>
  );
}

function Card({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </section>
  );
}
