"use client";

import { useState, type FormEvent } from "react";
import { createSession, type RouteReply } from "@/lib/client/api";
import { checkDevices, type MicProblem } from "@/lib/client/devices";
import type { ActiveSession } from "@/lib/client/forge-state";
import type { CreateSessionResponse } from "@/lib/types";

const CONSENT_TEXT =
  "I'm 18 or older, I know Forge is an AI, and I'm okay with Tavus reading my expressions and tone during the call.";

const MIC_PROBLEM_TEXT: Record<MicProblem, string> = {
  missing: "No mic found. Plug one in, then try again.",
  blocked: "Forge needs your mic to hear you. Allow it in your browser's site settings, then try again.",
  unsupported: "This browser can't open a mic here. Try the latest Chrome or Safari, on https.",
};

type Phase = "idle" | "checking" | "calling";

const BUTTON_TEXT: Record<Phase, string> = {
  idle: "Say hi to Forge",
  checking: "Checking your mic and camera...",
  calling: "Calling Forge...",
};

/** A friendly line for each way the create can fail. */
function failureText(reply: Extract<RouteReply<CreateSessionResponse>, { ok: false }>): string {
  if (reply.status === 401) return "That passcode didn't work. Check it and try again.";
  if (reply.status === 409) return "Forge is already on a call. Give it a minute, then try again.";
  if (reply.error === "consent_required") return "Tick the box first, then say hi.";
  if (reply.status === 502) return "Couldn't reach Tavus just now. Try again in a minute.";
  if (reply.status === 503) return "Forge isn't fully set up yet. Try again a little later.";
  return "Something got in the way. Try again in a moment.";
}

interface SayHiFormProps {
  askPasscode: boolean;
  onStarted: (session: ActiveSession) => void;
}

/** Passcode, an optional first name, the one consent box and the button. Devices are checked first, so a missing mic never costs a call. */
export function SayHiForm({ askPasscode, onStarted }: SayHiFormProps) {
  const [consent, setConsent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [passcode, setPasscode] = useState("");
  // A 401 reveals the field, in case the server wants a passcode the page did not know about.
  const [showPasscode, setShowPasscode] = useState(askPasscode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const ready = consent && phase === "idle" && (!showPasscode || passcode.trim() !== "");

  async function sayHi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setProblem(null);

    setPhase("checking");
    const devices = await checkDevices();
    if (!devices.mic) {
      setProblem(MIC_PROBLEM_TEXT[devices.problem]);
      setPhase("idle");
      return;
    }

    setPhase("calling");
    const reply = await createSession({
      consent: true,
      firstName: firstName.trim() || undefined,
      passcode: showPasscode ? passcode : undefined,
    });
    if (!reply.ok) {
      if (reply.status === 401) setShowPasscode(true);
      setProblem(failureText(reply));
      setPhase("idle");
      return;
    }
    onStarted({ ...reply.data, voiceOnly: !devices.camera });
  }

  return (
    <form onSubmit={sayHi} className="mt-12 space-y-5 rounded-card bg-surface p-5 sm:p-7">
      {showPasscode && (
        <label className="block">
          <span className="text-sm text-ink">Passcode</span>
          <input
            type="password"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="mt-2 h-11 w-full rounded-btn-sm border border-line bg-raised px-3.5 text-ink"
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm text-ink">
          What should Forge call you? <span className="text-quiet">Optional</span>
        </span>
        <input
          type="text"
          autoComplete="given-name"
          maxLength={40}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="mt-2 h-11 w-full rounded-btn-sm border border-line bg-raised px-3.5 text-ink"
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-5 shrink-0 cursor-pointer"
        />
        <span className="text-ink-body">{CONSENT_TEXT}</span>
      </label>

      <button
        type="submit"
        disabled={!ready}
        className="h-12 w-full rounded-btn bg-forge-violet px-6 font-medium text-forge-fg transition-colors duration-150 hover:bg-forge-violet-deep disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {BUTTON_TEXT[phase]}
      </button>

      {problem && (
        <p role="alert" className="text-emph">
          {problem}
        </p>
      )}
    </form>
  );
}
