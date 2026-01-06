import { ConfigProvider, Effect, Layer } from "effect";
import { BunContext } from "@effect/platform-bun";
import { SchedulerLive } from "./src/Scheduler";
import { MessageService } from "./src/MessageService";
import { ConfigService } from "./src/ConfigService";
import { DiscordService } from "./src/DiscordService";

const TestConfig = ConfigProvider.fromMap(
  new Map([["WEBHOOK_TEST", "http://dummy-webhook.com/TEST"]])
);

const MainLayer = SchedulerLive.pipe(
  Layer.provide(MessageService.Default),
  Layer.provide(DiscordService.Test),
  Layer.provide(BunContext.layer)
);

const program = Effect.provideConfig(Layer.launch(MainLayer), TestConfig);

Effect.runPromise(program);
