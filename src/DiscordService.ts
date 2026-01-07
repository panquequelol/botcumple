import { Effect, Schedule, Console } from "effect";
import { HttpClient } from "@effect/platform";
import { DiscordError } from "./Domain";

export class DiscordService extends Effect.Service<DiscordService>()(
  "DiscordService",
  {
    succeed: {
      sendMessage: (url: string, content: string) => {
        const request = HttpClient.post(url, {
          body: HttpClient.bodyJson({ content }),
        });

        const policy = Schedule.exponential("1 seconds", 2.0).pipe(
          Schedule.intersect(Schedule.recurs(5))
        );

        return request.pipe(
          Effect.flatMap(HttpClient.response),
          Effect.filterSuccess({
            ifLeft: (res) =>
              new DiscordError({
                message: `HTTP ${res.status}`,
                status: res.status,
              }),
          }),
          Effect.asVoid,
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
