import React, { useState } from "react";
import type { FamilySessionView } from "../../shared/contracts";
import { friendlyError } from "../api";
import { signOut, startSignIn, type SignInProblem } from "./session";

/**
 * Minimal family sign-in shell (WO106). All strings are placeholders: the
 * coordinator writes the final copy. Family journeys replace the signed-in body.
 */
export function SignedOutScreen({
  brand,
  problem,
}: {
  brand: React.ReactNode;
  problem: SignInProblem | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await startSignIn();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="site-header">{brand}</header>
      <main className="playtest-start family-signed-out">
        {/* COPY: signed-out heading placeholder */}
        <h1>Signed out</h1>
        {problem === "not-admitted" && (
          // COPY: placeholder for a login without an admitted group
          <p role="alert">This account is not allowed to play.</p>
        )}
        {problem === "failed" && (
          // COPY: placeholder for a failed or interrupted sign-in
          <p role="alert">Sign-in did not finish. Try again.</p>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={busy}
          onClick={() => void signIn()}
        >
          {/* COPY: the single sign-in button */}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </main>
    </div>
  );
}

export function FamilyShell({
  brand,
  session,
  onSignedOut,
  children,
}: {
  brand: React.ReactNode;
  session: FamilySessionView;
  onSignedOut: () => void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function leave(endSession: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await signOut(endSession);
      if (result.endSessionUrl) window.location.assign(result.endSessionUrl);
      else onSignedOut();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }
  return (
    <div className="app-shell" data-role={session.role}>
      <header className="site-header">
        {brand}
        <span className="preview-badge">
          <i />
          {/* COPY: placeholder role label */}
          {session.player.label} · {session.role === "admin" ? "Admin" : "Player"}
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void leave(false)}
        >
          {/* COPY: local sign-out placeholder */}
          Sign out
        </button>
        {session.endSessionAvailable && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void leave(true)}
          >
            {/* COPY: "Sign out of Haynes Network too" placeholder (ADR-005 D-06) */}
            Sign out everywhere
          </button>
        )}
      </header>
      <main className="playtest-start">
        {error && <p role="alert">{error}</p>}
        {children ?? (
          // COPY: signed-in placeholder until family journeys land
          <p>Signed in.</p>
        )}
      </main>
    </div>
  );
}
