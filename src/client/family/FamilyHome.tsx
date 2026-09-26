import React, { useCallback, useEffect, useState } from "react";
import type { FamilySessionView } from "../../shared/contracts";
import type { FamilyJourneyCard, FamilyPlayResponse } from "../../shared/family-api";
import { FamilyAdmin } from "./FamilyAdmin";
import { familyApi, familyErrorText } from "./family-client";

/**
 * The family home (DESIGN-024 player journey): one big card per published
 * journey, and "Set up your family" for administrators only. All strings are
 * placeholders marked `COPY:`; the coordinator owns the final copy and layout.
 */
export function FamilyHome({
  session,
  onPlay,
}: {
  session: FamilySessionView;
  onPlay: (response: FamilyPlayResponse) => void;
}) {
  const admin = session.role === "admin";
  const [journeys, setJourneys] = useState<readonly FamilyJourneyCard[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setJourneys((await familyApi.journeys()).journeys);
    } catch (e) {
      setError(familyErrorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function play(childId: string, fresh = false) {
    setBusy(true);
    setError("");
    try {
      onPlay(await familyApi.play(childId, fresh));
    } catch (e) {
      setError(familyErrorText(e));
      setBusy(false);
    }
  }

  if (admin && setup)
    return (
      <FamilyAdmin
        onBack={() => {
          setSetup(false);
          void load();
        }}
        onPlay={onPlay}
      />
    );

  return (
    <section className="family-home" aria-busy={journeys === null}>
      {/* COPY: family home heading */}
      <h1>Choose your journey</h1>
      {error && <p role="alert">{error}</p>}
      {journeys === null && !error && <p role="status">Loading journeys…</p>}
      {journeys?.length === 0 && (
        // COPY: empty home placeholder (member vs admin)
        <p>{admin ? "No journeys yet. Set up your family to begin." : "No journeys yet. Ask a family admin to set one up."}</p>
      )}
      <div className="family-journeys">
        {journeys?.map((journey) => (
          <button
            key={journey.childId}
            className="family-journey-card"
            disabled={busy}
            onClick={() => void play(journey.childId)}
          >
            <strong>{journey.displayName}</strong>
            <span>
              {journey.run
                ? journey.run.completed
                  ? "Journey complete" // COPY: completed journey card line
                  : `${journey.run.chapterName ?? "Next chapter"} · Age ${journey.run.ageYears}` // COPY: card progress line
                : "Ready to start" /* COPY: card for a journey not yet started */}
            </span>
            {admin && journey.newerPublication && (
              // COPY: admin hint that newer photos are published
              <small>Newer photos are published. Start fresh from setup to use them.</small>
            )}
          </button>
        ))}
      </div>
      {admin && (
        <button className="secondary family-setup-button" disabled={busy} onClick={() => setSetup(true)}>
          {/* COPY: admin entry to family setup */}
          Set up your family
        </button>
      )}
    </section>
  );
}
