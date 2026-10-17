import { Conversation } from "@/app/components/cvi/components/conversation";
import { TestModeStage } from "@/app/components/test-mode-stage";
import type { ActiveSession } from "@/lib/client/forge-state";

/** On screen for the whole call, in case Tavus's own banner does not render in a custom UI. */
const DISCLOSURE_LINE =
  "You're talking with Forge, an AI. It reads expressions and tone to pace the chat, never to decide your type.";

interface VideoStageProps {
  session: ActiveSession;
  /** The call was created as ended: nothing to join, fixtures instead. */
  testMode: boolean;
  presenter: boolean;
  onEvent: (event: unknown) => void;
  onLeave: () => void;
  log: (line: string) => void;
}

/** Forge's face (or the test-mode stand-in), with the AI line under it. */
export function VideoStage({ session, testMode, presenter, onEvent, onLeave, log }: VideoStageProps) {
  return (
    <section aria-label="Video call" className="min-w-0 space-y-3">
      {testMode ? (
        <TestModeStage presenter={presenter} onEvent={onEvent} log={log} />
      ) : (
        <div className="overflow-hidden rounded-card">
          <Conversation
            conversationUrl={session.conversationUrl}
            meetingToken={session.meetingToken}
            startVideoOff={session.voiceOnly}
            onLeave={onLeave}
          />
        </div>
      )}
      <p className="text-sm text-quiet">{DISCLOSURE_LINE}</p>
      {session.voiceOnly && <p className="text-sm text-quiet">Voice only this time: no camera, and that&apos;s fine.</p>}
    </section>
  );
}
