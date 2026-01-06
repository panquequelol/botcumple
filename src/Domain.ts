import { Data, Schema } from "effect";

export const MessageSchema = Schema.Struct({
  date: Schema.String,
  content: Schema.String,
  targets: Schema.Array(Schema.String),
});

export interface Message extends Schema.Schema.Type<typeof MessageSchema> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  message: string;
}> {}

export class FileError extends Data.TaggedError("FileError")<{
  message: string;
  cause?: unknown;
}> {}

export class DiscordError extends Data.TaggedError("DiscordError")<{
  message: string;
  status?: number;
}> {}
