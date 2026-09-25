import type { SignOutResponse } from "../../shared/contracts";
import { api } from "../api";

/** Starts Authentik sign-in; the server fixes the provider and return path. */
export async function startSignIn(
  navigate: (url: string) => void = (url) => window.location.assign(url),
): Promise<void> {
  const { url } = await api<{ url: string }>("/auth/sign-in/social", {});
  navigate(url);
}

/**
 * Ends the game session. With `endSession`, also returns Authentik's
 * end-session URL (when the server offers one) for a shared device.
 */
export async function signOut(endSession = false): Promise<SignOutResponse> {
  return api<SignOutResponse>("/sign-out", endSession ? { endSession: true } : {});
}

export type SignInProblem = "not-admitted" | "failed";

/** Reads the error Better Auth appends to the return path after a refused sign-in. */
export function readSignInProblem(search: string): SignInProblem | null {
  const error = new URLSearchParams(search).get("error");
  if (!error) return null;
  return error === "not_admitted" ? "not-admitted" : "failed";
}
