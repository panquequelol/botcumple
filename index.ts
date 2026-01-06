import { Effect, Layer } from "effect";
import { BunContext } from "@effect/platform-bun";
import { SchedulerLive } from "./src/Scheduler";
import { MessageService } from "./src/MessageService";
import { ConfigService } from "./src/ConfigService";
import { DiscordService } from "./src/DiscordService";

const MainLayer = SchedulerLive.pipe(
  Layer.provide(MessageService.Default),
  Layer.provide(ConfigService.Default),
  Layer.provide(DiscordService.Default),
  Layer.provide(BunContext.layer)
);

const program = Layer.launch(MainLayer);

Effect.runPromise(program).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
