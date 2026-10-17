import { Conversation } from "@/app/components/cvi/components/conversation";
import { TestModeStage } from "@/app/components/test-mode-stage";
import type { ActiveSession } from "@/lib/client/forge-state";

interface VideoStageProps {
  session: ActiveSession;
  /** The call was created as ended: nothing to join, fixtures instead. */
  testMode: boolean;
  presenter: boolean;
  onEvent: (event: unknown) => void;
  onLeave: () => void;
  log: (line: string) => void;
}

/** Forge's face (or the test-mode stand-in) in the Forge frame. */
export function VideoStage({ session, testMode, presenter, onEvent, onLeave, log }: VideoStageProps) {
  return (
    <section aria-label="Video call" className="frame min-w-0 self-start">
      {testMode ? (
        <TestModeStage presenter={presenter} onEvent={onEvent} log={log} />
      ) : (
        <Conversation
          conversationUrl={session.conversationUrl}
          meetingToken={session.meetingToken}
          startVideoOff={session.voiceOnly}
          onLeave={onLeave}
        />
      )}
    </section>
  );
}
