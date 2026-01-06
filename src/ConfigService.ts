import { Config, Effect } from "effect";

export class ConfigService extends Effect.Service<ConfigService>()(
  "ConfigService",
  {
    succeed: {
      getWebhookUrl: (id: string) => Config.string(`WEBHOOK_${id}`),
    },
  }
) {}
