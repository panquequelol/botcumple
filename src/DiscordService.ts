import { Effect, Schedule, Console } from "effect";
import { DiscordError } from "./Domain";

export class DiscordService extends Effect.Service<DiscordService>()(
  "DiscordService",
  {
    succeed: {
      sendMessage: (url: string, content: string) => {
        const policy = Schedule.exponential("1 seconds", 2.0).pipe(
          Schedule.intersect(Schedule.recurs(5))
        );

        return Effect.tryPromise({
          try: () =>
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            }),
          catch: (e) =>
            new DiscordError({ message: String(e) }),
        }).pipe(
          Effect.flatMap((res) =>
            res.ok
              ? Effect.void
              : Effect.fail(
                  new DiscordError({
                    message: `HTTP ${res.status}`,
                    status: res.status,
                  })
                )
          ),
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
) {}
