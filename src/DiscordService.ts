import { Effect, Schedule, Console, Layer } from "effect";
import { DiscordError } from "./Domain";

export class DiscordService extends Effect.Service<DiscordService>()(
  "DiscordService",
  {
    succeed: {
      sendMessage: (url: string, content: string) => {
        const perform = Effect.tryPromise({
          try: async () => {
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            });
            if (!response.ok) {
              throw new Error(`Status ${response.status}`);
            }
          },
          catch: (e) => new DiscordError({ message: String(e) }),
        });

        const policy = Schedule.exponential("1 seconds", 2.0).pipe(
          Schedule.intersect(Schedule.recurs(5))
        );

        return perform.pipe(
          Effect.tapError((e) =>
            Console.error(
              `[DiscordService] Error sending to ${url}: ${e.message}. Retrying...`
            )
          ),
          Effect.retry(policy)
        );
      },
    },
  }
) {
  static readonly Test = Layer.succeed(
    this,
    this.of({
      sendMessage: (url: string, content: string) =>
        Console.log(`[DiscordService][TEST] Sending to ${url}: "${content}"`),
    } as any)
  );
}
