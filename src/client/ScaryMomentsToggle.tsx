import React, { useId, useState } from "react";
import {
  SCARY_MOMENTS_DESCRIPTION,
  SCARY_MOMENTS_LABEL,
  readScaryMoments,
  writeScaryMoments,
} from "./scary-moments";

/**
 * DESIGN-027 D-02 parent switch. Stored per device; every game started on
 * this device afterwards reads it, so admins and family members alike can
 * turn scary moments off without changing a published journey.
 */
export function ScaryMomentsToggle({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useState(() => readScaryMoments());
  const descriptionId = useId();
  return (
    <label className={`scary-moments-toggle ${className}`.trim()}>
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        aria-describedby={descriptionId}
        onChange={(event) => {
          const next = event.target.checked;
          setEnabled(next);
          writeScaryMoments(next);
        }}
      />
      <span className="scary-moments-copy">
        <strong>{SCARY_MOMENTS_LABEL}</strong>
        <small id={descriptionId}>{SCARY_MOMENTS_DESCRIPTION}</small>
      </span>
    </label>
  );
}
