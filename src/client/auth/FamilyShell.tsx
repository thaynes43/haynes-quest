import React, { useState } from "react";
import type { FamilySessionView } from "../../shared/contracts";
import { friendlyError } from "../api";
import { signOut, startSignIn, type SignInProblem } from "./session";

/**
 * Family sign-in shell (WO106, ADR-005). Family journeys replace the
 * signed-in body.
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
        <h1>Our family adventure</h1>
        <p>Climb, explore and find your memories from every year.</p>
        {problem === "not-admitted" && (
          <p role="alert">
            This Haynes Network account can't open Haynes Quest yet. Ask a
            family admin to add you to the Family role.
          </p>
        )}
        {problem === "failed" && (
          <p role="alert">Sign-in didn't finish. Please try again.</p>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={busy}
          onClick={() => void signIn()}
        >
          {busy ? "Opening Haynes Network…" : "Sign in with Haynes Network"}
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
          {session.player.label}
          {session.role === "admin" ? " · Family admin" : ""}
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void leave(false)}
        >
          Sign out
        </button>
        {session.endSessionAvailable && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void leave(true)}
          >
            Sign out of Haynes Network too
          </button>
        )}
      </header>
      <main className="playtest-start">
        {error && <p role="alert">{error}</p>}
        {children ?? (
          <p>You're signed in. Family quests are being prepared.</p>
        )}
      </main>
    </div>
  );
}
