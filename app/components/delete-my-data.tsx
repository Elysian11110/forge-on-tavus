"use client";

import { useState } from "react";
import { deleteSession, type SessionRef } from "@/lib/client/api";

type Deletion = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; message: string };

/** A 2xx from the hard delete, or Tavus saying it is already gone. */
function tavusConfirmed(status: number | null): boolean {
  return status !== null && ((status >= 200 && status < 300) || status === 404 || status === 410);
}

interface DeleteMyDataProps {
  session: SessionRef;
  onDeleted: (tavusConfirmed: boolean) => void;
  log: (line: string) => void;
}

/** The button that wipes Forge's copy and asks Tavus to hard-delete the conversation. */
export function DeleteMyData({ session, onDeleted, log }: DeleteMyDataProps) {
  const [deletion, setDeletion] = useState<Deletion>({ kind: "idle" });

  async function deleteMyData() {
    setDeletion({ kind: "busy" });
    const reply = await deleteSession(session);
    if (reply.ok) {
      log(`deleted: Forge's copy gone, Tavus hard delete answered ${reply.data.tavusStatus ?? "nothing"}`);
      onDeleted(tavusConfirmed(reply.data.tavusStatus));
      return;
    }
    log(`delete failed (${reply.status || "network"})`);
    const alreadyGone = reply.status === 403 || reply.status === 404;
    setDeletion({
      kind: "failed",
      message: alreadyGone ? "There's nothing left to delete: it's already gone." : "Couldn't delete just now. Try again in a minute.",
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={deleteMyData}
        disabled={deletion.kind === "busy"}
        className="h-11 rounded-btn border border-line px-5 text-ink transition-colors duration-150 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deletion.kind === "busy" ? "Deleting..." : "Delete my data"}
      </button>
      {deletion.kind === "failed" && (
        <p role="alert" className="basis-full text-accent-ink">
          {deletion.message}
        </p>
      )}
    </>
  );
}
