import { Effect, Schedule, Console, Ref, Layer, Config, Data } from "effect";
import { addDays, format } from "date-fns";
import { toDate } from "date-fns-tz";
import { MessageService } from "./MessageService";
import { DiscordService } from "./DiscordService";

const Scheduler = Data.Tagged("Scheduler");

const CHILE_TZ = "America/Santiago";

const SCHEDULE = {
  holidayReminderHour: "13:00",
  birthdayBeforeHour: "10:30",
  birthdayTodayHour: "23:59",
} as const;

function formatChileDate(date: Date): string {
  return format(date, "yyyy-MM-dd HH:mm", { timeZone: CHILE_TZ });
}

function formatChileDay(date: Date): string {
  return format(date, "yyyy-MM-dd", { timeZone: CHILE_TZ });
}

function sendToAllTargets(
  discord: DiscordService,
  targets: readonly string[],
  content: string
) {
  return Effect.all(
    targets.map((target) => {
      const webhookUrl = Config.string(`WEBHOOK_${target}`);
      return Effect.timeout(
        discord.sendMessage(webhookUrl, content),
        "5 seconds"
      ).pipe(
        Effect.catchTag("DiscordError", (e) =>
          Console.error(`[Scheduler] Failed to send to ${target}: ${e.message}`)
        ),
        Effect.catchAll((e) =>
          Console.error(`[Scheduler] Unexpected error: ${e}`)
        )
      );
    })
  );
}

function shouldSendHolidayReminder(
  msgDate: string,
  tomorrow: string,
  sentSet: ReadonlySet<string>
) {
  const msgId = `holiday_reminder_${msgDate}`;
  if (tomorrow !== msgDate || sentSet.has(msgId)) return null;
  const reminderTime = `${tomorrow} ${SCHEDULE.holidayReminderHour}`;
  return { msgId, reminderTime };
}

function shouldSendBirthdayBeforeNotice(
  msgDate: string,
  tomorrow: string,
  today: string,
  sentSet: ReadonlySet<string>
) {
  const msgId = `bday_before_${msgDate}`;
  if (tomorrow !== msgDate || sentSet.has(msgId)) return null;
  const beforeTime = `${tomorrow} ${SCHEDULE.birthdayBeforeHour}`;
  return { msgId, beforeTime };
}

function shouldSendBirthdayTodayNotice(
  msgDate: string,
  today: string,
  sentSet: ReadonlySet<string>
) {
  const msgId = `bday_today_${msgDate}`;
  if (today !== msgDate || sentSet.has(msgId)) return null;
  const todayTime = `${today} ${SCHEDULE.birthdayTodayHour}`;
  return { msgId, todayTime };
}

function processHoliday(
  discord: DiscordService,
  msg: { date: string; content: string; targets: readonly string[] },
  tomorrow: string,
  currentTime: string,
  sentSet: ReadonlySet<string>
) {
  const check = shouldSendHolidayReminder(msg.date, tomorrow, sentSet);
  if (!check) return Effect.void;

  if (currentTime < check.reminderTime) return Effect.void;

  return Effect.gen(function* () {
    yield* Console.log(`[Scheduler] Sending holiday reminder for ${msg.date}`);
    yield* sendToAllTargets(discord, msg.targets, `mañana es feriado. ${msg.content}`);
    yield* Ref.update(sentSet, (set) => new Set(set).add(check.msgId));
  });
}

function processBirthday(
  discord: DiscordService,
  msg: { date: string; content: string; targets: readonly string[] },
  today: string,
  tomorrow: string,
  currentTime: string,
  sentSet: ReadonlySet<string>
) {
  return Effect.gen(function* () {
    const beforeCheck = shouldSendBirthdayBeforeNotice(msg.date, tomorrow, today, sentSet);
    if (beforeCheck && currentTime >= beforeCheck.beforeTime) {
      yield* Console.log(`[Scheduler] Sending birthday before-notice for ${msg.date}`);
      yield* sendToAllTargets(discord, msg.targets, `mañana es el cumple de ${msg.content}, acuerdense`);
      yield* Ref.update(sentSet, (set) => new Set(set).add(beforeCheck.msgId));
    }

    const todayCheck = shouldSendBirthdayTodayNotice(msg.date, today, sentSet);
    if (todayCheck && currentTime >= todayCheck.todayTime) {
      yield* Console.log(`[Scheduler] Sending birthday message for ${msg.date}`);
      yield* sendToAllTargets(discord, msg.targets, `hoy es el cumple de ${msg.content}, felicidades`);
      yield* Ref.update(sentSet, (set) => new Set(set).add(todayCheck.msgId));
    }
  });
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
      const currentTime = formatChileDate(chileNow);
      const sentSet = yield* Ref.get(sentMessageIds);

      for (const msg of allMessages) {
        if (msg.type === "holiday") {
          yield* processHoliday(discord, msg, tomorrow, currentTime, sentSet);
        } else if (msg.type === "birthday") {
          yield* processBirthday(discord, msg, today, tomorrow, currentTime, sentSet);
        }
      }
    }).pipe(
      Effect.catchTag("DiscordError", (e) =>
        Console.error(`[Scheduler] Discord error: ${e.message}`)
      ),
      Effect.catchTag("FileError", (e) =>
        Console.error(`[Scheduler] File error: ${e.message}`)
      ),
      Effect.catchAll((e) =>
        Console.error(`[Scheduler] Unexpected error: ${e}`)
      )
    );

    yield* Console.log("[Scheduler] Server started. Polling every 10 seconds...");

    return yield* process.pipe(Effect.repeat(Schedule.spaced("10 seconds")));
  })
);
