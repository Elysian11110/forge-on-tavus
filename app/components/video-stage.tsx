import { Conversation } from "@/app/components/cvi/components/conversation";
import type { ActiveSession } from "@/lib/client/forge-state";

/** Veronica's face in the Forge frame. */
export function VideoStage({ session, onLeave }: { session: ActiveSession; onLeave: () => void }) {
  return (
    <section aria-label="Video call" className="frame min-w-0 self-start">
      <Conversation
        conversationUrl={session.conversationUrl}
        meetingToken={session.meetingToken}
        startVideoOff={session.voiceOnly}
        onLeave={onLeave}
      />
    </section>
  );
}
