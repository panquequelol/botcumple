import { Effect, Schedule, Console } from "effect";
import { HttpClient, HttpClientRequest, HttpBody } from "@effect/platform";
import { DiscordError } from "./Domain";

export class DiscordService extends Effect.Service<DiscordService>()(
  "DiscordService",
  {
    succeed: {
      sendMessage: (url: string, content: string) =>
        Effect.gen(function* () {
          const perform = Effect.gen(function* () {
            const body = yield* HttpBody.json({ content });

            return yield* HttpClientRequest.post(url, {
              body,
            }).pipe(
              HttpClient.execute,
              Effect.flatMap((response) =>
                response.status === 204
                  ? Effect.void
                  : Effect.fail(
                      new DiscordError({
                        message: `Unexpected status: ${response.status}`,
                      }),
                    ),
              ),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DiscordError({
                    message:
                      typeof error === "object" &&
                      error !== null &&
                      "message" in error
                        ? String(error.message)
                        : String(error),
                  }),
                ),
              ),
            );
          });

          const policy = Schedule.exponential("1 seconds", 2.0).pipe(
            Schedule.intersect(Schedule.recurs(5)),
          );

          return yield* perform.pipe(
            Effect.tapError((e) =>
              Console.error(
                `[DiscordService] Error sending to ${url}: ${e._tag === "DiscordError" ? e.message : String(e)}. Retrying...`,
              ),
            ),
            Effect.retry(policy),
          );
        }),
    },
  },
) {}
