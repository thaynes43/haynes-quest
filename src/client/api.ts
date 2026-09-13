import type { ApiError } from "../shared/contracts";

export const API_REQUEST_TIMEOUT_MS = 8_000;

function requestTimeoutError(): Error & { code: string } {
  return Object.assign(new Error("REQUEST_TIMEOUT"), {
    code: "REQUEST_TIMEOUT",
  });
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(requestTimeoutError());
    }, API_REQUEST_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      signal: controller.signal,
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
      const result = (await response
        .json()
        .catch(() => null)) as ApiError | null;
      throw new Error(result?.error?.code ?? "UNAVAILABLE");
    }
    return (await response.json()) as T;
  })();

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (timedOut) throw requestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId!);
  }
}
export function friendlyError(error: unknown): string {
  const code = error instanceof Error ? error.message.toUpperCase() : "";
  if (code.includes("FIXTURE_BIRTH_DATE"))
    return "Demo Adventurer’s fictional birth date is January 1, 2020.";
  if (code.includes("SUBJECT_UNRESOLVED"))
    return "Use Demo Adventurer for this fictional preview.";
  if (code === "REQUEST_TIMEOUT")
    return "The connection took too long. Your progress is still here. Please try again.";
  if (code === "INVALID_REQUEST")
    return "Check the name, birth date and date range. Choose a photo limit from 1 to 24.";
  if (code === "NO_USABLE_PHOTOS")
    return "No memories fall within those dates. Try a wider date range.";
  if (code === "ERA_CATALOG_UNAVAILABLE")
    return "We haven’t built a complete adventure for those years yet. This preview covers the 2020 and 2024 chapters.";
  if (code === "PREVIEW_NOT_FOUND")
    return "That photo selection has expired. Preview the memories again.";
  if (code === "RATE_LIMITED") return "Take a short pause, then try again.";
  if (code === "SAVE_REVISION_STALE")
    return "The latest saved progress has been loaded. Try your action again.";
  if (code === "SECURE_RANDOM_UNAVAILABLE")
    return "This browser can’t safely identify game actions. Reopen the private game in an up-to-date browser.";
  if (code === "FRIENDLY_HELP_NOT_NEEDED")
    return "You’re already healthy. Your friend will keep their gift for later.";
  if (code === "FRIENDLY_BOON_ALREADY_CLAIMED")
    return "Your friend has already shared their gift for this chapter.";
  if (code === "FRIENDLY_NOT_ACTIVE")
    return "Your friend is resting. Make amends to help them up.";
  if (code === "FRIENDLY_NOT_FOUND")
    return "That friend is in another chapter. Keep exploring this one.";
  if (code === "PICKUP_ALREADY_COLLECTED")
    return "That tool is already in your equipment. Follow your current objective.";
  if (code === "MEMORY_ALREADY_REVEALED")
    return "You have already remembered this picture.";
  if (code === "ENCOUNTER_NOT_FOUND")
    return "That creature is no longer part of this level. Follow your current objective.";
  if (code === "ENEMY_HIT_COOLDOWN")
    return "Keep moving while you recover from that hit.";
  if (code === "ACTION_ID_REUSED" || code === "STALE_ACTION_RESPONSE")
    return "We couldn’t confirm that action. Reopen this journey to load its latest progress.";
  if (code === "ATTACK_COOLDOWN")
    return "Let your attack settle, then strike again.";
  if (code === "GUARD_COOLDOWN")
    return "Your shield is recovering. Keep moving until it’s ready.";
  if (code === "ATTACK_TOOL_REQUIRED")
    return "Find a tool in this level before attacking.";
  if (code === "GUARD_TOOL_REQUIRED")
    return "Find a shield in this level to guard.";
  if (code === "ENCOUNTER_NOT_ACTIVE")
    return "That creature can’t be fought right now. Defeat the other enemies before facing the boss.";
  if (code === "MEMORY_BUNDLE_INCOMPLETE")
    return "Remember every picture in this bundle before you grow.";
  if (code === "ACTION_NOT_AVAILABLE" || code === "LEVEL_NOT_ACTIVE")
    return "That action belongs to a different moment in the journey. Follow your current objective.";
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
