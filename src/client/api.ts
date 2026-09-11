import type { ApiError } from "../shared/contracts";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Quest-Request": "1",
          },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(result?.error?.code ?? "UNAVAILABLE");
  }
  return response.json() as Promise<T>;
}
export function friendlyError(error: unknown): string {
  const code = error instanceof Error ? error.message.toUpperCase() : "";
  if (code.includes("FIXTURE_BIRTH_DATE"))
    return "Demo Adventurer’s fictional birth date is January 1, 2020.";
  if (code.includes("SUBJECT_UNRESOLVED"))
    return "Use Demo Adventurer for this fictional preview.";
  if (code.includes("NOT_FOUND") || code.includes("NO_MATCH"))
    return "We couldn’t find that journey. Try Demo Adventurer in this preview.";
  if (code.includes("ORDER"))
    return "There’s an earlier memory waiting for you. Follow its glow first.";
  if (code.includes("SELECTION") || code.includes("VALIDATION"))
    return "Check your dates and choose at least one memory.";
  if (code.includes("EXPIRED"))
    return "That photo selection has expired. Preview the memories again.";
  return "We couldn’t save that change. Your earlier progress is safe. Please try again.";
}
