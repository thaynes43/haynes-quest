import type { AuthoredConnection } from "../../shared/authored-level";
import type { LevelEditorConnectionMatch } from "../../shared/editor-project";

export function connectionMatchForCommand(
  connection: AuthoredConnection,
  index: number,
): LevelEditorConnectionMatch {
  return {
    from: connection.from,
    to: connection.to,
    mode: connection.mode,
    index,
  };
}
