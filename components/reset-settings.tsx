"use client";

import { resetPersisted } from "./persisted";

export function ResetSettings() {
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        resetPersisted();
        window.location.reload();
      }}
    >
      Reset chart settings
    </button>
  );
}
