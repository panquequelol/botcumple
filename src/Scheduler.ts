import { Context, Effect, Schedule, Console, Ref, Layer, Config } from "effect";
import { MessageService } from "./MessageService";
import { DiscordService } from "./DiscordService";

export const SchedulerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const messages = yield* MessageService;
    const discord = yield* DiscordService;

    // State to track sent messages (format: "${date}_${content}")
    const sentFeatures = yield* Ref.make(new Set<string>());

    const process = Effect.gen(function* () {
      // Log for liveness every few ticks? No, too noisy.

      const allMessages = yield* messages.getMessages();

      // Get current date in Chile timezone (America/Santiago)
      // Format: YYYY-MM-DD
      const chileDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const sentSet = yield* Ref.get(sentFeatures);

      for (const msg of allMessages) {
        const msgId = `${msg.date}_${msg.content}`;

        // Lexicographical comparison works for ISO dates (YYYY-MM-DD)
        if (chileDate >= msg.date && !sentSet.has(msgId)) {
          yield* Console.log(
            `[Scheduler] Processing message due at ${msg.date}: "${msg.content}" (Chile Date: ${chileDate})`,
          );

          for (const target of msg.targets) {
            yield* Config.string(`WEBHOOK_${target}`).pipe(
              Effect.flatMap((url) => discord.sendMessage(url, msg.content)),
              Effect.catchAll((e) =>
                Console.error(
                  `[Scheduler] Failed to send to ${target}: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                ),
              ),
            );
          }

          // Update state
          yield* Ref.update(sentFeatures, (set) => {
            const next = new Set(set);
            next.add(msgId);
            return next;
          });
        }
      }
    }).pipe(
      Effect.catchAll((e) =>
        Console.error(
          `[Scheduler] Tick failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        ),
      ),
    );

    yield* Console.log(
      "[Scheduler] Server started. Polling every 10 seconds...",
    );

    // Run every 10 seconds
    yield* process.pipe(Effect.repeat(Schedule.spaced("10 seconds")));
  }),
);
