import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { PageHeader } from "@/components/bjj/ui";
import { TECHNIQUES } from "@/lib/bjj/data";
import {
  Map,
  BookOpen,
  Dumbbell,
  NotebookPen,
  ShieldAlert,
  Swords,
  HelpCircle,
  Users,
  Settings,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const total = TECHNIQUES.length;
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader kicker="BJJ Companion" title="Как пользоваться" className="px-1" />

        <Card
          icon={<BookOpen className="h-4 w-4" />}
          title="Библиотека"
          text={`${total} техники: поиск, фильтры по поясу, разделу и Gi/No-Gi. У каждой техники механика по шагам, ключевые моменты, типичные ошибки, дриллы, связанные и похожие техники. Отмечайте статус: «в процессе» — учите сейчас, «изучено» — уверенно работает в спарринге.`}
        />
        <Card
          icon={<Map className="h-4 w-4" />}
          title="Карта"
          text="Схема вокруг выбранной техники: сверху — откуда в неё попадают, снизу — куда она ведёт и чем финишируется, сбоку — альтернативы из той же позиции. Помогает увидеть свою игру как связки, а не отдельные приёмы."
        />
        <Card
          icon={<HelpCircle className="h-4 w-4" />}
          title="Что если…"
          text="Выберите позицию — «я в маунте снизу», «соперник взял спину» — и получите варианты: атаки, свипы, переходы и выходы. Быстрый разбор ситуаций между тренировками."
        />
        <Card
          icon={<Dumbbell className="h-4 w-4" />}
          title="Отработка"
          text="Генератор собирает план под вас: разминка, техники по поясу и фокусу, заминка. Подбор по профилю или по дневнику — что учите и что давно не повторяли. Готовый план можно запустить: таймер идёт по разделам, за 5 секунд до конца раздела — короткие сигналы, в конце — громкий."
        />
        <Card
          icon={<Swords className="h-4 w-4" />}
          title="Сценарии"
          text="Спарринг из заданной позиции: выберите сценарий, договоритесь с партнёром, запустите таймер на 3 или 5 минут. Звуковые сигналы скажут, когда время на исходе."
        />
        <Card
          icon={<NotebookPen className="h-4 w-4" />}
          title="Дневник"
          text="Отмечайте тренировки: техники, заметки, интенсивность, раунды, самочувствие и травмы. Календарь месяца сверяет факт с вашим планом (частота из профиля): недоборы недель, сверхплановые тренировки и итог месяца."
        />
        <Card
          icon={<TrendingUp className="h-4 w-4" />}
          title="Моя игра"
          text="Прогресс по поясам и разделам, ваш стиль из 10 архетипов, характеристики от отмеченных техник и «Разрыв» — чем то, что вы реально тренируете, отличается от стиля, который выбрали. Тап по кружку профиля открывает лист игрока: пояс, формат, частота, стиль."
        />
        <Card
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Безопасность"
          text="У техник размечен риск травмы и сигнал «когда стучать». Режим «Безопасный» в генераторе исключает сложные и травмоопасные техники. Берегите партнёров: плавность важнее финиша."
        />
        <Card
          icon={<Users className="h-4 w-4" />}
          title="Кто в игре"
          text="Тап по логотипу сверху — сколько людей тренируется с приложением и как они распределены по поясам."
        />
        <Card
          icon={<Settings className="h-4 w-4" />}
          title="Аккаунт и данные"
          text="Шестерёнка в шапке: вход в аккаунт (облачная синхронизация прогресса между устройствами), язык, экспорт и импорт данных."
        />

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          База: {total} техники, проверена методическим аудитом — покрытие от самостраховки до современного
          но-ги (K-гард, боди-треугольник, ретеншн-система). Данные о легальности: IBJJF Gi/No-Gi, ADCC.
          В планах: видео к техникам, программы обучения и английская версия.
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
