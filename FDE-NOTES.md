# FDE notes: Forge on Tavus

What a customer would get after a week with me: what building on Tavus taught me and what I'd fix in the product, the pilot I'd run with a coaching company, the questions I'd ask them first, and the email I'd send after our first call. All of it came out of the build, not a brainstorm.

## 1. Friction log

Ten things I hit building Forge, in three trends. Each trend has one fix that would remove the whole group, and each item says what happened, where the evidence is, who it bites, and what I'd change. "Hit" means the build broke on it; "read" means I found it in the docs before it could.

### Trend A: the docs and the shipped code drift apart

One fix for the group: a check in the docs pipeline that runs every code example and every CLI template against the current API schema and the current CLI, and a CLI that pins and prints the dependency versions it was tested with.

**1. The CLI installs unpinned dependencies.** Hit.
What happened: `@tavus/cvi-ui` 0.3.1 lists `@daily-co/daily-react`, `@daily-co/daily-js` and `jotai` with no versions and runs `npm install <names>` on `init` and on every `add`. jotai 3 breaks daily-react's `jotai ^2` peer range, so a fresh install on the wrong day fails or lands a mismatched set. I ran both commands with `--skip-install` and pinned daily-react 0.26.0, daily-js 0.93.0 and jotai 2.20.3 by hand.
Evidence: `DEFAULT_DEPENDENCIES` in the CLI bundle (dist/index.js, around line 81) and the peer range in daily-react's package.json; the install steps on https://docs.tavus.io/sections/conversational-video-interface/component-library/overview.
Who it bites: everyone who scaffolds, differently each week.
Fix: pin the tested versions in the CLI and print them, and record the CLI version in `cvi-components.json` (today it stores only `{"tsx": true}`).

**2. The conversation block can't join a private room.** Hit.
What happened: the block's `use-cvi-call` hook calls `daily.join({ url })` and never passes a token, while `require_auth: true` returns a `meeting_token` that has to go to `join({ url, token })`. I patched `joinCall({ url, token })` and threaded a `meetingToken` prop through Conversation.
Evidence: https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/private-rooms against the hook in the CLI template.
Who it bites: anyone who turns on private rooms, which is what you want in production.
Fix: a `meetingToken` prop on Conversation and `joinCall`, and the private-rooms page should show the block, not raw daily-js.

**3. The face filter and the hooks page disagree.** Hit.
What happened: `use-replica-ids` filters `user_id` on `tavus-replica`. The hooks page says `tavus-face` and tells you to run `add use-face-ids`, which prints "Component use-face-ids not found" and installs nothing. I patched the filter to accept both and confirm the live id on the first call.
Evidence: https://docs.tavus.io/sections/conversational-video-interface/component-library/hooks against the CLI's `use-replica-ids.tsx`.
Who it bites: whoever follows the docs. The documented command does nothing, and if the live id ever changes, the face never renders and the screen says "Connecting" forever.
Fix: one name in docs and code, and an alias for the old add command.

**4. Event-schema pages are a title and nothing else as Markdown.** Read.
What happened: the `.md` export of `conversation.utterance`, `conversation.tool_call` and the perception event pages is a heading with no payload; the examples exist only in the rendered HTML. And the hooks page's own example switches on `conversation.replica.started_speaking`, which the schema never sends (it's `conversation.started_speaking` with `properties.role`). I typed every event by hand from the rendered pages.
Evidence: https://docs.tavus.io/sections/event-schemas/conversation-utterance.md and https://docs.tavus.io/sections/event-schemas/conversation-toolcall.md; the example on the hooks page.
Who it bites: anyone building types from the export, and anyone who copies the hooks example (the handler never fires).
Fix: put the schema examples in the export, and build the CLI's event types from the same schema file so they can't drift.

### Trend B: silent failures and silent changes

One fix for the group: an error event on the call, and a webhook, for every dropped or failed delivery; every event name in one published schema that the CLI types are built from; and a changelog entry plus an email to affected accounts for every deprecation, naming the PALs it touches.

**5. App messages over 4 KB are dropped with no error.** Read, and designed around.
What happened: the delivery page says a tool call over 4 KB is dropped in transit, silently. Forge's one big tool call, the reading, is about 2 KB of arguments plus the envelope and grows with every goal, so I moved it to API delivery with an HMAC and kept only the tiny `save_goal` on the app message.
Evidence: https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool-delivery
Who it bites: anyone whose most important tool call is also the biggest one, which is usually how it goes.
Fix: an error event when a message is dropped, and a size budget per tool in the docs and in Create Tool's validation.

**6. Tools delivered over the API are invisible to the browser.** Hit.
What happened: `conversation.tool_call` app messages fire only for app-message delivery. With `synthesize_profile` on API delivery, the only signal in the browser that the reading has started is matching the static filler text ("putting it all together") inside a pal utterance, and whether a static filler even emits an utterance is undocumented. My status line and my watchdog hang on that match.
Evidence: https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool-delivery and https://docs.tavus.io/sections/event-schemas/conversation-toolcall
Who it bites: any UI that wants to show "working on it" for a server-side tool.
Fix: a small tool-started and tool-finished app message, whatever the delivery.

**7. The guardrail app message has no documented event name.** Hit.
What happened: the guardrails page says a violation sends an app message with the guardrail name and a reason, but never names the `event_type`, and the CLI's AppMessage union doesn't include it. My handler casts through unknown and matches on `properties.guardrail`. That message is my crisis card, so it's the last thing I want to be guessing about.
Evidence: https://docs.tavus.io/sections/conversational-video-interface/guardrails and the union in the CLI's `cvi-events-hooks.tsx`.
Who it bites: anyone with a safety guardrail that has to reach the screen.
Fix: document the event name and payload, add it to the union, and put "guardrails are not guaranteed" on the same page a safety reviewer will read.

**8. The block's join is a silent no-op when the call object isn't ready.** Hit.
What happened: Conversation joins inside a mount-only effect with the first render's `joinCall`. DailyProvider creates its call object in its own effect and renders children with it still null, so if CVIProvider and Conversation mount in the same render, the child effect runs first, `daily?.join` does nothing, and nothing retries or warns. Forge mounts CVIProvider at the app root for this reason, with a comment saying why.
Evidence: `useCallInstance` in daily-react 0.26.0 (index.esm.js) and the CLI's `conversation/index.tsx`.
Who it bites: anyone who mounts the block on a route change, which is the natural thing to do in Next.js. A failed join shows nothing at all.
Fix: wait for the call object inside the block and warn when a join is skipped; say on the blocks page that the provider belongs above the route.

Two deprecations I only found by reading belong under the same fix. `sparrow-1` is deprecated, yet 15 of the 31 stock PALs I listed still pin it, and the changelog gives two dates for the Sparrow-2 default (Aug 21: "becomes the default on September 8"; Oct 13: already the default), so I set `sparrow-2` explicitly. And `tavus-gemini-2.5-flash` retires on 2026-10-20 with no changelog entry, only a line on the LLM page and in the Create PAL reference.

### Trend C: cost surprises

One fix for the group: the effective call cap in every create response and a stable error code on every limit, so cost guards can be built on fields instead of on string matching; plus safe defaults in the scaffolded create route (a param allowlist, server-set timers and an auth placeholder).

**9. The call cap is lowered silently, and the price page can't tell you to what.** Hit.
What happened: a `max_call_duration` above the plan's maximum is capped with no error and no field in the response saying so. On the Free plan that maximum is 5 minutes, so my 7-minute arc would have ended at 5:00, mid-reveal. The pricing page shows two developer price tables with different plan names and minute allowances, and the "100 minutes" I was told the account had matches neither. I made 5 the default arc and 7 a switch, with a line in `.env.example` saying 7 needs Starter or higher.
Evidence: the warning on https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/call-duration-and-timeout and the two tables on https://www.tavus.io/pricing
Who it bites: every demo on a Free or Starter plan, cut mid-sentence, and anyone trying to forecast a bill.
Fix: return the effective cap in the create response (or answer 400 when the request asks for more than the plan allows), and one price table.

**10. Limits and already-ended calls come back as prose.** Hit.
What happened: the concurrency limit is a 400 whose body has a `message` ("User has reached maximum concurrent conversations") and no error code, while validation errors use `error`. End Conversation documents 200, 400 ("Invalid conversation_id") and 401, so what an already-ended call returns is anyone's guess. Forge's one-live-call guard matches the word "concurrent" to answer 409, and Delete treats every 4xx except 401, 403 and 429 as "already ended", which could hide a typo in an id.
Evidence: the 400 description on https://docs.tavus.io/api-reference/conversations/create-conversation and the responses block on https://docs.tavus.io/api-reference/conversations/end-conversation
Who it bites: anyone writing a cost guard or a cleanup job. Both end up matching text.
Fix: a stable `code` on every error, 409 or 429 for concurrency, and a documented 200 with `status: ended` for an end call with nothing left to end.

Two smaller ones on the same theme: `participant_absent_timeout` is a join window on the API reference and an inactivity timer on the call-duration page, so a long thinking pause could end a paid call (I set 120 seconds, and the first live call tells me which meaning is real); and List Conversations documents a default `limit` of 10 with no maximum, so my live-call check relies on page one.

### From my live calls

- Run 1 (terra, date): what the debug record showed (evidence sent and matched, which refusal fired, which lines were replaced), what the shutdown reason was, and what the GET returned after the hard delete.
- Run 2 (gemma-4, date): the same, plus which model I kept and why.

## 2. Pilot plan: a coaching company

The customer: a coaching or wellness company that wants each client to have an on-demand coach with a face between human sessions.

**Goal.** Prove in 30 days that a Forge-style call (a face, a reading the client trusts, and moves tied to their own goals) gets clients to act between sessions, at a cost per completed call the business can carry.

**Scope.**
- In: one PAL on the customer's own coach face and voice; their method's rules in the prompt and in the server checks; English; 20 to 30 pilot clients who opted in; five-minute calls in week one and seven-minute calls from week two if their plan allows; the result screen and "Delete my data"; a 30-minute check-in with me every week.
- Out: memory across calls (designed, built in phase two if the pilot passes); languages other than English; mobile Safari (tested in week one, promised only after); anything that decides something about a client (hiring, placement, anything clinical).

**Metrics and targets.**

| What | How I measure it | Target |
|---|---|---|
| Completion | calls that reach the reveal, over calls created | 80% |
| Called vs honestly withheld | share of completed calls that call a type; the rest refused on purpose | 50% called on five minutes, 70% on seven; every refusal traceable to the evidence count |
| "What fits" | one tap after the rundown, 1 to 5 | 4.0 average, under 10% at 1 or 2 |
| Test-retest | the same client a week apart, the same TRC row | 7 of 10 pairs |
| Acted on a move | the coach asks at the next session whether the client tried it | 50% |
| Time to first word | create to Forge's first spoken line | under 10 seconds, median |
| Cost per completed rundown | Tavus minutes at the plan rate, over completed calls | under $2.50 on Builder |
| Safety | every crisis flag shows the card and withholds the reading | zero readings after a flag |
| Deletion | "Delete my data" confirmed by Tavus | 100% |

**Timeline.**
- Week 0: their face and voice on the PAL, the prompt swapped for their method, the consent copy marked up by their legal, a staging PAL with one test call per change, the status page and the kill line in their runbook.
- Weeks 1 and 2: 20 to 30 clients, one call each. Weekly check-in. I read the verbose record of every flagged call and fix the top three issues.
- Weeks 3 and 4: the second call for the test-retest pairs, the seven-minute arc if the plan allows, the metrics review.
- Day 30: go or no-go against the targets. If go, phase two is memory and the check-in call, Spanish, and writing the chosen move back to their CRM.

**Risks, and what I'd do.**
- Refusals feel like failures to clients. It's the feature, but if the rating says they feel short-changed, move to seven minutes and add the second reading after the settling question.
- Emotion recognition and the EU AI Act. If any client takes the call at work or in education, emotion recognition is pinned to limited, everyone is told in the consent, and their legal signs the copy.
- Concurrency. Self-serve plans allow 1 to 15 calls at once, and past the cap the create fails. A 9 a.m. push needs a waiting room or an Enterprise plan.
- A prompt change reaches every live call at once. Staging PAL, the freeze before any session, config in git.
- Dead air at the reveal. Measured in week one; if it passes five seconds, shorten the schema or trigger the reading earlier.
- Tavus's default retention isn't in the docs. Get it in writing before the first client.

## 3. Five discovery questions

1. "Walk me through what happens between two coaching sessions today. Where does the client lose momentum?" It tells me whether the gap is engagement or insight, which changes what Forge should do first.
2. "When a client gets a reading they don't like, what do your coaches do, and what would you want the AI to do?" It settles the pushback behaviour up front, and whether they can live with "I won't guess".
3. "Who owns the client's data, where does it live today, and who has to sign off on video and reading expressions?" Consent, EU, retention: the blockers that take weeks, so they start now.
4. "What does a check-in cost you in coach time, and what would a completed call be worth to you?" That's the pricing conversation: cost per completed rundown against what they pay a person for the same check-in.
5. "If this works, what's the number you'd show your board on day 30?" The one metric the pilot gets designed around. Everything else is secondary.

## 4. Recap email after the first call

Subject: Forge pilot: what we agreed today

Hey [name],

Thanks for today. Here's what I took away and what happens next.

You want clients to keep moving between sessions, and the number you'd show the board is completed calls that lead to an action at the next session. That's the metric the whole pilot is built around.

By Friday I'll have a PAL on [coach]'s face and voice (I need the photo and a two-minute voice sample), your method's rules in the prompt, and the consent copy in a doc for [legal contact] to mark up.

From you: 20 to 30 clients who opt in, one named coach who asks at each session whether the client tried their move, and your data retention requirement in writing so I can check it against Tavus's.

Week one is five-minute calls, and we read every flagged call together on Thursday at 4. Day 30 is go or no-go against the targets in the attached plan.

Zee
