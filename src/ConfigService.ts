import { Effect, Layer } from "effect";
import { ConfigError } from "./Domain";

export class ConfigService extends Effect.Service<ConfigService>()(
  "ConfigService",
  {
    succeed: {
      getWebhookUrl: (id: string) => {
        const envKey = `WEBHOOK_${id}`;
        return Effect.sync(() => process.env[envKey]).pipe(
          Effect.flatMap((val) =>
            val
              ? Effect.succeed(val)
              : Effect.fail(
                  new ConfigError({
                    message: `Missing environment variable: ${envKey}`,
                  })
                )
          )
        );
      },
    },
  }
) {
  static readonly Test = Layer.succeed(
    this,
    this.of({
      getWebhookUrl: (id: string) =>
        Effect.succeed(`http://dummy-webhook.com/${id}`),
    })
  );
}
