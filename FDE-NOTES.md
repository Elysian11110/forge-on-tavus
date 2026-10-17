# FDE notes: Forge on Tavus

What building on Tavus taught me and what I'd fix in the product, the pilot I'd run with a coaching company, the questions I'd ask first, and the email I'd send after the first call. All of it came out of the build.

## 1. Friction log

Ten things I hit, in three trends, with one fix per trend. "Hit" broke the build; "read" I caught in the docs first.

### Trend A: the docs and the shipped code drift apart

One fix: run every docs example and CLI template against the current API and CLI in the docs pipeline, and have the CLI pin and print the versions it was tested with.

1. **The CLI installs unpinned dependencies.** Hit. `@tavus/cvi-ui` 0.3.1 runs `npm install` on daily-react, daily-js and jotai with no versions, and jotai 3 breaks daily-react's peer range. I used `--skip-install` and pinned by hand. Fix: pin and print, and record the CLI version in `cvi-components.json`. ([component library](https://docs.tavus.io/sections/conversational-video-interface/component-library/overview))
2. **The conversation block can't join a private room.** Hit. Its hook calls `daily.join({ url })` with no token, so `require_auth` rooms never connect. I threaded a `meetingToken` prop through. Fix: that prop in the block, and the private-rooms page showing the block instead of raw daily-js. ([private rooms](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/private-rooms))
3. **The face filter and the hooks page disagree.** Hit. The hook filters on `tavus-replica`, the docs say `tavus-face` and tell you to run `add use-face-ids`, which installs nothing. If the id ever changes the face never renders. Fix: one name everywhere and an alias for the old command. ([hooks](https://docs.tavus.io/sections/conversational-video-interface/component-library/hooks))
4. **Event-schema pages export as a title and nothing else.** Read. The `.md` export of the utterance, tool-call and perception pages has no payload, and the hooks example switches on an event name the schema never sends. I typed every event by hand. Fix: ship the examples in the export and build the CLI's types from the same schema. ([utterance](https://docs.tavus.io/sections/event-schemas/conversation-utterance.md))

### Trend B: silent failures and silent changes

One fix: an error event and a webhook for every dropped or failed delivery, every event name in one published schema, and a changelog entry plus an email for every deprecation naming the PALs it touches.

5. **App messages over 4 KB are dropped with no error.** Read, designed around. Forge's reading is the one big tool call, so it goes over API delivery with an HMAC and only `save_goal` rides the app message. Fix: an error event on a drop, and a size budget in Create Tool's validation. ([tool delivery](https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool-delivery))
6. **Tools delivered over the API are invisible to the browser.** Hit. No `conversation.tool_call` fires, so "putting it together" on screen comes from matching the filler line in Veronica's speech. Fix: a tool-started and tool-finished app message whatever the delivery.
7. **The guardrail app message has no documented event name.** Hit. The page says a violation sends an app message, never names the `event_type`, and the CLI union lacks it. That message is my crisis card. Fix: document it, add it to the union, and put "guardrails are not guaranteed" on the same page. ([guardrails](https://docs.tavus.io/sections/conversational-video-interface/guardrails))
8. **The block's join is a silent no-op when the call object isn't ready.** Hit. Mount the provider and the block in the same render and `daily?.join` does nothing, with no retry and no warning. Forge mounts the provider at the app root for this reason. Fix: wait for the call object inside the block and warn on a skipped join.

Also read: `sparrow-1` is deprecated yet 15 of 31 stock PALs still pin it, the changelog gives two dates for the Sparrow-2 default, and `tavus-gemini-2.5-flash` retires on 2026-10-20 with no changelog entry.

### Trend C: cost surprises

One fix: the effective call cap in every create response and a stable error code on every limit, so cost guards are built on fields, not on string matching.

9. **The call cap is lowered silently.** Hit. A `max_call_duration` above the plan's maximum is capped with no error and no field saying so; the pricing page has two developer tables with different plan names. A 23-minute call ran uncut on my Trial plan, so that cap is above the 5 minutes Free gets. Fix: return the effective cap, or answer 400, and one price table. ([call duration](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/call-duration-and-timeout))
10. **Limits and already-ended calls come back as prose.** Hit. The concurrency limit is a 400 with a `message` and no code, and what End returns for an ended call is undocumented, so my live-call guard matches the word "concurrent". Fix: a stable `code` on every error, 409 for concurrency, a documented 200 for an end with nothing to end. ([end conversation](https://docs.tavus.io/api-reference/conversations/end-conversation))

### From my live calls

- Run 1 (terra, 5-minute speed round): stiff and formal, cut mid-reveal at the cap. Switched to gemma-4.
- Run 2 (gemma-4, 8 minutes): warm but laughed at everything, wrapped up on a passing line at seven minutes, read "what is real right now" as Se when the next clause was "and in the future", and said the TRC code "AST" out loud. Fixes: calm baseline, Objectives for the call order, a Sensing-or-Intuition question first, Jungian letters in the reveal.
- Run 3 (gemma-4, 23 minutes): asked the same past-versus-present question about ten times because the objective could only complete on a one-sided answer and the answers were honestly both; read "end_call" aloud from my own rundown text; the full report failed because the Forge extractor can't parse a call that long. Fixes: a yes-or-no ladder instead of a repeat, tools used silently, the scorer runs without the extractor and a call-only report stands in.

## 2. Pilot plan: a coaching company

The customer: a coaching company that wants each client to have an on-demand coach with a face between human sessions.

**Goal.** Prove in 30 days that a Forge-style call gets clients to act between sessions, at a cost per completed call the business can carry.

**Scope.** In: one PAL on their coach's face and voice, their method's rules in the prompt and the server checks, English, 20 to 30 opted-in clients, a weekly 30-minute check-in with me. Out: memory across calls (phase two), other languages, mobile Safari, anything that decides something about a client.

| What | How | Target |
|---|---|---|
| Completion | calls that reach the reveal, over calls created | 80% |
| Called vs withheld | share of completed calls that call a type; every refusal traceable to the evidence count | 70% called |
| "What fits" | one tap after the rundown, 1 to 5 | 4.0 average |
| Test-retest | same client a week apart, same TRC row | 7 of 10 pairs |
| Acted on a move | the coach asks at the next session | 50% |
| Time to first word | create to Veronica's first line | under 10 s median |
| Cost per completed rundown | Tavus minutes at the plan rate | under $2.50 |
| Safety | every crisis flag shows the card and withholds the reading | zero misses |

**Timeline.** Week 0: their face, voice and method on a staging PAL, consent copy marked up by their legal. Weeks 1 and 2: one call per client, I read every flagged call and fix the top three issues. Weeks 3 and 4: the second call for the test-retest pairs, the metrics review. Day 30: go or no-go; if go, memory, Spanish and writing the move back to their CRM.

**Risks.** Refusals feel like failures (if the rating says so, add the second reading). Emotion recognition at work or in education (pin it to limited, say so in the consent). Concurrency on a 9 a.m. push (a waiting room or Enterprise). A prompt change reaches every live call (staging PAL, config in git). Tavus's default retention isn't in the docs (get it in writing first).

## 3. Five discovery questions

1. "What happens between two coaching sessions today, and where does the client lose momentum?" Engagement or insight: it changes what Forge does first.
2. "When a client gets a reading they don't like, what do your coaches do?" Settles the pushback behaviour, and whether they can live with "I won't guess".
3. "Who owns the client's data, where does it live, and who signs off on video?" The blockers that take weeks start now.
4. "What does a check-in cost you in coach time?" That's the pricing conversation.
5. "What's the number you'd show your board on day 30?" The pilot gets designed around it.

## 4. Recap email after the first call

Subject: Forge pilot: what we agreed today

Hey [name],

Thanks for today. You want clients to keep moving between sessions, and the number you'd show the board is completed calls that lead to an action at the next session. That's what the pilot is built around.

By Friday I'll have a PAL on [coach]'s face and voice (I need the photo and a two-minute voice sample), your method's rules in the prompt, and the consent copy for [legal contact] to mark up.

From you: 20 to 30 clients who opt in, one coach who asks at each session whether the client tried their move, and your retention requirement in writing so I can check it against Tavus's.

Week one is calls, and we read every flagged one together on Thursday at 4. Day 30 is go or no-go against the targets in the attached plan.

Zee
