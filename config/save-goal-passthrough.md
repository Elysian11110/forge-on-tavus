# save_goal fallback: passthrough

Use this only if a live run shows doubled speech or silence on the turn Forge saves a goal. The three changes go together, with no call live and before the config freeze. Switching the tool alone would leave Forge silent: under `passthrough`, Tavus stops adding `response_to_user` to the tool, so the model has to say its line itself before it calls the tool.

Load the key and the ids first, from the project folder:

```bash
set -a; . ./.env.local; set +a
SAVE_GOAL_ID=$(jq -r .save_goal config/ids.json); PAL_ID=$(jq -r .pal config/ids.json)
```

## 1. The tool

Update Tool merges fields: only what is in the body changes. The description loses its `response_to_user` sentence and keeps everything else.

```bash
curl -s -X PATCH "https://tavusapi.com/v2/tools/$SAVE_GOAL_ID" \
  -H "x-api-key: $TAVUS_API_KEY" -H "Content-Type: application/json" \
  -d '{"on_call":"passthrough","description":"Save one thing the person says they are working toward, the moment they say it. One call per goal: g1 for the first, g2 for the second, g3 for a third. If they change a goal, call again with the same goal_id. Use their words. Never mention saving out loud."}'
```

## 2. The prompt

In `config/forge-system-prompt.md`, replace the line that starts with `save_goal:` with this one:

```text
save_goal: the moment they name something they're working toward, once per goal: g1, then g2, then g3. Their words. Say your quick reaction and your next question first, then call save_goal in the same turn. Never mention saving.
```

Patch PAL takes a JSON Patch array, and a `replace` swaps the whole field, so the whole prompt goes up:

```bash
jq -Rs '[{"op":"replace","path":"/system_prompt","value":.}]' config/forge-system-prompt.md \
  | curl -s -X PATCH "https://tavusapi.com/v2/pals/$PAL_ID" \
      -H "x-api-key: $TAVUS_API_KEY" -H "Content-Type: application/json" --data-binary @-
```

## 3. If the PAL patch returns 409

A 409 with `"conflict": "maker_changes"` means PAL Maker holds an unapplied draft. Run the same command with `?force=true` at the end of the URL; that discards the draft.

## Checks

- Budget: the new line is about as long as the old one, and the tool loses a sentence plus the injected `response_to_user`, so the prompt and tools stay under Tavus's 5,000-token guidance (about 4,850 at peak before this change).
- Read both back: `GET /v2/tools/$SAVE_GOAL_ID` shows `passthrough` and the shorter description; `GET /v2/pals/$PAL_ID` shows the new line.
- Make the same tool change in `config/tools.json` (`on_call` and `description`) and commit both files, so the repo matches the live PAL.
