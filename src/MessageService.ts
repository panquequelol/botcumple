import { Effect, Schema } from "effect";
import { FileSystem } from "@effect/platform";
import { FileError, MessageSchema, type Message } from "./Domain";

export class MessageService extends Effect.Service<MessageService>()(
  "MessageService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const decode = Schema.decodeUnknown(
        Schema.parseJson(Schema.Array(MessageSchema))
      );

      return {
        getMessages: (): Effect.Effect<
          ReadonlyArray<Message>,
          FileError,
          FileSystem.FileSystem
        > =>
          fs.readFileString("messages.json").pipe(
            Effect.flatMap(decode),
            Effect.catchAll(
              (error) =>
                new FileError({
                  message: "Failed to read or parse messages.json",
                  cause: error,
                })
            )
          ),
      };
    }),
  }
) {}
