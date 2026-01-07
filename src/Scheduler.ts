import { Effect, Schedule, Console, Ref, Layer, Match, Config, Data } from "effect";
import { parseISO, addDays, format, isSameDay } from "date-fns";
import { toDate } from "date-fns-tz";
import { MessageService } from "./MessageService";
import { DiscordService } from "./DiscordService";

class Scheduler extends Data.TaggedClass("Scheduler") {}

const CHILE_TZ = "America/Santiago";

function formatChileDate(date: Date): string {
  return formatInTimeZone(date, CHILE_TZ, "yyyy-MM-dd HH:mm");
}

function formatChileDay(date: Date): string {
  return formatInTimeZone(date, CHILE_TZ, "yyyy-MM-dd");
}

function formatInTimeZone(date: Date, timeZone: string, formatStr: string): string {
  const str = format(date, "yyyy-MM-dd HH:mm:ss.SSS", { timeZone });
  const d = parseISO(str);
  return format(d, formatStr);
}

export const SchedulerLive = Layer.effect(Scheduler)(
  Effect.gen(function* () {
    const messages = yield* MessageService;
    const discord = yield* DiscordService;

    const sentMessageIds = yield* Ref.make(new Set<string>());

    const process = Effect.gen(function* () {
      const allMessages = yield* messages.getMessages();
      const now = new Date();
      const chileNow = toDate(now, { timeZone: CHILE_TZ });
      const today = formatChileDay(chileNow);
      const tomorrow = formatChileDay(addDays(chileNow, 1));

      const sentSet = yield* Ref.get(sentMessageIds);

      for (const msg of allMessages) {
        const msgDate = msg.date;

        if (msg.type === "holiday") {
          const msgId = `holiday_reminder_${msgDate}`;
          const reminderTime = `${tomorrow} 13:00`;

          if (tomorrow === msgDate && !sentSet.has(msgId)) {
            const currentTime = formatChileDate(chileNow);
            if (currentTime >= reminderTime) {
              yield* Console.log(`[Scheduler] Sending holiday reminder for ${msgDate}`);
              for (const target of msg.targets) {
                const webhookUrl = yield* Config.string(`WEBHOOK_${target}`);
                yield* discord.sendMessage(webhookUrl, `mañana es feriado. ${msg.content}`);
              }
              yield* Ref.update(sentMessageIds, (set) => set.add(msgId));
            }
          }
        } else if (msg.type === "birthday") {
          const msgIdBefore = `bday_before_${msgDate}`;
          const msgIdToday = `bday_today_${msgDate}`;
          const beforeTime = `${tomorrow} 10:30`;
          const todayTime = `${today} 23:59`;

          const currentTime = formatChileDate(chileNow);

          if (tomorrow === msgDate && !sentSet.has(msgIdBefore)) {
            if (currentTime >= beforeTime) {
              yield* Console.log(`[Scheduler] Sending birthday before-notice for ${msgDate}`);
              for (const target of msg.targets) {
                const webhookUrl = yield* Config.string(`WEBHOOK_${target}`);
                yield* discord.sendMessage(webhookUrl, `feliz cumpleaños a ${msg.content} mañana!! 🎂`);
              }
              yield* Ref.update(sentMessageIds, (set) => set.add(msgIdBefore));
            }
          }

          if (today === msgDate && !sentSet.has(msgIdToday)) {
            if (currentTime >= todayTime) {
              yield* Console.log(`[Scheduler] Sending birthday message for ${msgDate}`);
              for (const target of msg.targets) {
                const webhookUrl = yield* Config.string(`WEBHOOK_${target}`);
                yield* discord.sendMessage(webhookUrl, `feliz cumpleaños ${msg.content}!! 🎂`);
              }
              yield* Ref.update(sentMessageIds, (set) => set.add(msgIdToday));
            }
          }
        }
      }
    }).pipe(
      Effect.catchAll((e) =>
        Console.error(
          `[Scheduler] Tick failed: ${Match.value(e).pipe(
            Match.when({ _tag: "DiscordError" }, (e) => e.message),
            Match.when({ _tag: "FileError" }, (e) => e.message),
            Match.orElse((e) => String(e))
          )}`
        )
      )
    );

    yield* Console.log("[Scheduler] Server started. Polling every 10 seconds...");

    yield* process.pipe(Effect.repeat(Schedule.spaced("10 seconds")));

    return new Scheduler();
  })
);
