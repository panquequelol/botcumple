import { Effect, Schedule, Console, Ref, Layer, Match, Config } from "effect";
import { MessageService } from "./MessageService";
import { DiscordService } from "./DiscordService";

export const SchedulerLive = Layer.launch(
  Effect.gen(function* () {
    const messages = yield* MessageService;
    const discord = yield* DiscordService;

    const sentMessageIds = yield* Ref.make(new Set<string>());

    const chileDateFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const process = Effect.gen(function* () {
      const allMessages = yield* messages.getMessages();

      const chileDate = chileDateFormat.format(new Date());

      const sentSet = yield* Ref.get(sentMessageIds);

      for (const msg of allMessages) {
        const msgId = `${msg.date}_${msg.content}`;

        if (chileDate >= msg.date && !sentSet.has(msgId)) {
          yield* Console.log(
            `[Scheduler] Processing message due at ${msg.date}: "${msg.content}" (Chile Date: ${chileDate})`
          );

          for (const target of msg.targets) {
            const webhookUrl = yield* Config.string(`WEBHOOK_${target}`);
            yield* discord.sendMessage(webhookUrl, msg.content);
          }

          yield* Ref.update(sentMessageIds, (set) => set.add(msgId));
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

    yield* Console.log(
      "[Scheduler] Server started. Polling every 10 seconds..."
    );

    yield* process.pipe(Effect.repeat(Schedule.spaced("10 seconds")));
  })
);
