import { Data, Schema } from "effect";

export const MessageSchema = Schema.Struct({
  date: Schema.String,
  type: Schema.Union(Schema.Literal("holiday"), Schema.Literal("birthday")),
  content: Schema.String,
  targets: Schema.Array(Schema.String),
});

export type Message = Schema.Schema.Type<typeof MessageSchema>;

export class FileError extends Data.TaggedError("FileError")<{
  message: string;
  cause?: unknown;
}> {}

export class DiscordError extends Data.TaggedError("DiscordError")<{
  message: string;
  status?: number;
}> {}
