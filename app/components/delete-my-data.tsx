"use client";

import { useState } from "react";
import { deleteSession, type SessionRef } from "@/lib/client/api";

type Deletion = { kind: "idle" } | { kind: "confirming" } | { kind: "busy" } | { kind: "failed"; message: string };

/** A 2xx from the hard delete, or Tavus saying it is already gone. */
function tavusConfirmed(status: number | null): boolean {
  return status !== null && ((status >= 200 && status < 300) || status === 404 || status === 410);
}

interface DeleteMyDataProps {
  session: SessionRef;
  onDeleted: (tavusConfirmed: boolean) => void;
}

/** The quiet button that wipes Forge's copy and asks Tavus to hard-delete the conversation, after one "are you sure". */
export function DeleteMyData({ session, onDeleted }: DeleteMyDataProps) {
  const [deletion, setDeletion] = useState<Deletion>({ kind: "idle" });

  async function deleteMyData() {
    setDeletion({ kind: "busy" });
    const reply = await deleteSession(session);
    if (reply.ok) {
      onDeleted(tavusConfirmed(reply.data.tavusStatus));
      return;
    }
    const alreadyGone = reply.status === 403 || reply.status === 404;
    setDeletion({
      kind: "failed",
      message: alreadyGone ? "There's nothing left to delete: it's already gone." : "Couldn't delete just now. Try again in a minute.",
    });
  }

  return <DeleteMyDataView deletion={deletion} onAsk={() => setDeletion({ kind: "confirming" })} onCancel={() => setDeletion({ kind: "idle" })} onDelete={deleteMyData} />;
}

interface DeleteMyDataViewProps {
  deletion: Deletion;
  onAsk: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

const QUIET_BUTTON = "min-h-11 text-quiet underline decoration-rule underline-offset-6 transition-colors duration-150 hover:text-ink";

/** The delete control as it looks, with no state of its own. */
function DeleteMyDataView({ deletion, onAsk, onCancel, onDelete }: DeleteMyDataViewProps) {
  if (deletion.kind === "confirming" || deletion.kind === "busy") {
    const busy = deletion.kind === "busy";
    return (
      <div role="group" aria-label="Delete my data" className="flex basis-full flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-ink">Delete everything from this call, here and at Tavus? You can&apos;t undo it.</p>
        <div className="flex items-center gap-6">
          <button type="button" onClick={onDelete} disabled={busy} className="line-btn">
            {busy ? "Deleting" : "Yes, delete it"}
          </button>
          {!busy && (
            <button type="button" onClick={onCancel} className={QUIET_BUTTON}>
              Keep it
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={onAsk} className={QUIET_BUTTON}>
        Delete my data
      </button>
      {deletion.kind === "failed" && (
        <p role="alert" className="basis-full text-ink">
          {deletion.message}
        </p>
      )}
    </>
  );
}
