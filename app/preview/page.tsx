import { notFound } from "next/navigation";
import { PreviewState } from "@/app/preview/preview-state";
import { synthesize } from "@/lib/synthesize";
import { samArguments, samInput } from "@/tests/fixtures/sam";

// Dev only: every screen state, filled from the Sam fixture, one per ?state= so each can be
// screenshotted at phone and desktop width. Production answers 404.
export default async function PreviewPage(props: PageProps<"/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state } = await props.searchParams;

  const called = synthesize(samInput());
  const refused = synthesize(samInput({ args: { ...samArguments, trc_code: "none" } }));
  const tooFew = synthesize(samInput({ turns: [] }));

  return (
    <PreviewState
      state={typeof state === "string" ? state : "index"}
      profiles={{ called: called.profile, refused: refused.profile, tooFew: tooFew.profile }}
      debug={called.debug}
    />
  );
}
