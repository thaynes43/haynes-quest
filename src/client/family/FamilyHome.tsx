import React, { useCallback, useEffect, useState } from "react";
import type { FamilySessionView } from "../../shared/contracts";
import type { FamilyJourneyCard, FamilyPlayResponse } from "../../shared/family-api";
import { FamilyAdmin } from "./FamilyAdmin";
import { familyApi, familyErrorText } from "./family-client";

/**
 * The family home (DESIGN-024 player journey): one big card per published
 * journey, and Family setup for administrators only.
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
      <h1>Who's playing?</h1>
      {error && <p role="alert">{error}</p>}
      {journeys === null && !error && <p role="status">Getting your quests ready…</p>}
      {journeys?.length === 0 && (
        <p>{admin ? "No quests yet. Open Family setup to make one." : "No quests are ready yet. A family admin can set one up."}</p>
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
                  ? "Quest complete!"
                  : `${journey.run.chapterName ?? "Next chapter"} · Age ${journey.run.ageYears}`
                : "Tap to start your quest"}
            </span>
            {admin && journey.newerPublication && (
              <small>New photos are published. Use Start fresh in Family setup to play with them.</small>
            )}
          </button>
        ))}
      </div>
      {admin && (
        <button className="secondary family-setup-button" disabled={busy} onClick={() => setSetup(true)}>
          Family setup
        </button>
      )}
    </section>
  );
}
