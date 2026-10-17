"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createSession, type RouteReply } from "@/lib/client/api";
import { checkDevices, type MicProblem } from "@/lib/client/devices";
import type { ActiveSession } from "@/lib/client/forge-state";
import type { CreateSessionResponse } from "@/lib/types";

const CONSENT_TEXT =
  "I'm 18 or older, I know Veronica is an AI that reads my expressions and tone to pace the chat, and what I say is kept for 24 hours and used by Forge's AI to build my report.";

const MIC_PROBLEM_TEXT: Record<MicProblem, string> = {
  missing: "No mic found. Plug one in, then try again.",
  blocked: "Veronica needs your mic to hear you. Allow it in your browser's site settings, then try again.",
  unsupported: "This browser can't open a mic here. Try the latest Chrome or Safari, on https.",
};

type Phase = "idle" | "checking" | "calling";

const BUTTON_TEXT: Record<Phase, string> = {
  idle: "Say hi to Veronica",
  checking: "Checking mic and camera",
  calling: "Calling Veronica",
};

/** A friendly line for each way the create can fail. */
function failureText(reply: Extract<RouteReply<CreateSessionResponse>, { ok: false }>): string {
  if (reply.status === 409) return "Veronica is already on a call. Give it a minute, then try again.";
  if (reply.error === "consent_required") return "Tick the box first, then say hi.";
  if (reply.status === 502) return "Couldn't reach Tavus just now. Try again in a minute.";
  if (reply.status === 503) return "Forge isn't fully set up yet. Try again a little later.";
  return "Something got in the way. Try again in a moment.";
}

/** First name, the one consent box and the button. Devices are checked first, so a missing mic never costs a call. */
export function SayHiForm({ onStarted }: { onStarted: (session: ActiveSession) => void }) {
  const [consent, setConsent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const ready = consent && phase === "idle";

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
    const reply = await createSession({ consent: true, firstName: firstName.trim() || undefined });
    if (!reply.ok) {
      setProblem(failureText(reply));
      setPhase("idle");
      return;
    }
    onStarted({ ...reply.data, voiceOnly: !devices.camera });
  }

  return (
    <SayHiView
      firstName={firstName}
      consent={consent}
      phase={phase}
      ready={ready}
      problem={problem}
      onFirstName={setFirstName}
      onConsent={setConsent}
      onSubmit={sayHi}
    />
  );
}

interface SayHiViewProps {
  firstName: string;
  consent: boolean;
  phase: Phase;
  ready: boolean;
  problem: string | null;
  onFirstName: (value: string) => void;
  onConsent: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function Field({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-ink">{label}</span>
        {aside && <span className="type-label text-quiet">{aside}</span>}
      </span>
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "mt-2.5 h-12 w-full border border-rule bg-page px-4 text-ink transition-colors duration-150 hover:border-quiet focus:border-ember disabled:opacity-60";

/** The form as it looks, with no state of its own. */
function SayHiView(props: SayHiViewProps) {
  const busy = props.phase !== "idle";
  return (
    <form onSubmit={props.onSubmit} aria-busy={busy} className="frame p-6 sm:p-8">
      <fieldset disabled={busy} className="space-y-6">
        <Field label="What should Veronica call you?" aside="Optional">
          <input
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={props.firstName}
            onChange={(e) => props.onFirstName(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-4">
          <input
            type="checkbox"
            checked={props.consent}
            onChange={(e) => props.onConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-ember"
          />
          <span className="text-ink-body">{CONSENT_TEXT}</span>
        </label>
      </fieldset>

      <button type="submit" disabled={!props.ready} aria-busy={busy} className="cut-btn mt-8 w-full">
        {busy && <span aria-hidden className="size-2 animate-breathe bg-page" />}
        {BUTTON_TEXT[props.phase]}
        {!busy && (
          <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        )}
      </button>

      {props.problem && (
        <p role="alert" className="mt-5 flex items-start gap-3 text-ink">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-ember" />
          {props.problem}
        </p>
      )}
    </form>
  );
}
