import React, { useEffect, useState } from "react";
import type { MemoryPreview } from "../shared/contracts";

/** A failed photograph stays visible as an actionable error, never an empty tile. */
export function MemoryImage({ memory }: { memory: MemoryPreview }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    setLoaded(false);
  }, [memory.mediaUrl]);
  useEffect(() => {
    if (!failed || attempt >= 2) return;
    const timer = window.setTimeout(
      () => {
        setFailed(false);
        setAttempt((value) => value + 1);
      },
      (attempt + 1) * 1500,
    );
    return () => window.clearTimeout(timer);
  }, [failed, attempt]);
  if (!memory.mediaUrl)
    return (
      <div className="memory-image-unavailable">
        This memory is still held by the boss.
      </div>
    );
  return (
    <div className={`memory-image ${loaded ? "is-loaded" : ""}`}>
      {!failed && (
        <img
          key={`${memory.id}:${attempt}`}
          src={memory.mediaUrl}
          alt={memory.label}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      )}
      {!loaded && !failed && <span role="status">Opening this memory…</span>}
      {failed && (
        <div className="memory-image-unavailable" role="status">
          <p>
            {attempt < 2
              ? "Reconnecting to this picture…"
              : "This picture couldn’t load."}
          </p>
          {attempt >= 2 && (
            <button
              onClick={() => {
                setAttempt(0);
                setFailed(false);
              }}
            >
              Try the picture again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
