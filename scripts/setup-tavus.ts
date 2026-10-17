// Creates Forge's Tavus resources once, from config/: the guardrail, the two tools, the two objective sets, the pronunciation dictionary and the PAL.
// Safe to re-run after a partial failure, since each id lands in config/ids.json the moment it
// exists and is skipped next time. Refuses once ids.json holds the PAL; later changes are hand-run
// PATCHes. Run from the project root:
//   npx tsx --env-file=.env.local scripts/setup-tavus.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TavusError, tavusRequest } from "../lib/tavus";

type IdKey = "guardrail" | "save_goal" | "synthesize_profile" | "objectives_open" | "objectives_speed" | "pronunciation" | "pal";
type Ids = Partial<Record<IdKey, string>>;
type ToolName = "save_goal" | "synthesize_profile";

interface ToolRow {
  tool_id: string;
  name: string;
}

interface PalReadBack {
  layers?: {
    llm?: { model?: string };
    conversational_flow?: { turn_detection_model?: string };
    perception?: { perception_model?: string; perception_analysis_queries?: unknown[] };
  };
}

// The POST /v2/pals body, with the _setup block that only this script reads.
interface PalConfig {
  _setup?: { attach_tools?: ToolName[] };
  guardrail_ids?: string[];
  layers?: Record<string, unknown>;
  [field: string]: unknown;
}

const TOOL_NAMES: readonly ToolName[] = ["save_goal", "synthesize_profile"];

// The HMAC secret must be at least this long; openssl rand -hex 32 gives 64 characters.
const SECRET_MIN_LENGTH = 32;

const configPath = (name: string) => join(process.cwd(), "config", name);
const readConfig = (name: string): unknown => JSON.parse(readFileSync(configPath(name), "utf8"));

function readIds(): Ids {
  return existsSync(configPath("ids.json")) ? (readConfig("ids.json") as Ids) : {};
}

/** Writes the id the moment it exists, so a failure later never loses it. Ids only, never secrets. */
function saveId(ids: Ids, idKey: IdKey, id: string): void {
  ids[idKey] = id;
  writeFileSync(configPath("ids.json"), `${JSON.stringify(ids, null, 2)}\n`);
  console.info(`${idKey}: ${id}`);
}

/** Replaces ${NAME} in every string value; JSON-safe because it runs on parsed values. */
function fill(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === "string") return value.replace(/\$\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
  if (Array.isArray(value)) return value.map((entry) => fill(entry, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, fill(entry, vars)]));
  }
  return value;
}

/** The key, the HMAC secret and a bare public https origin: Vercel protects every non-production URL, so it must be the production domain. */
function checkEnv(): { baseUrl: string; secret: string } {
  const secret = process.env.TOOL_HMAC_SECRET?.trim() ?? "";
  const base = URL.parse(process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "");
  if (!process.env.TAVUS_API_KEY?.trim()) throw new Error("TAVUS_API_KEY is not set");
  if (secret.length < SECRET_MIN_LENGTH) {
    throw new Error(`TOOL_HMAC_SECRET must be at least ${SECRET_MIN_LENGTH} characters (openssl rand -hex 32)`);
  }
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[)/;
  if (!base || base.protocol !== "https:" || base.pathname !== "/" || base.search || local.test(base.hostname)) {
    throw new Error("PUBLIC_BASE_URL must be the public https production origin, such as https://forge-on-tavus.vercel.app");
  }
  return { baseUrl: base.origin, secret };
}

/** Tool names are unique, so a 409 means it exists; name_or_uuid is a substring match, so pick the exact name. */
async function findToolId(name: ToolName): Promise<string> {
  const page = await tavusRequest<{ data?: ToolRow[] }>("GET", `/tools?type=user&name_or_uuid=${encodeURIComponent(name)}`);
  const match = page?.data?.find((tool) => tool.name === name);
  if (!match) throw new Error(`Tavus answered 409 for ${name}, but no tool has exactly that name`);
  return match.tool_id;
}

async function createGuardrail(ids: Ids): Promise<void> {
  if (ids.guardrail) return;
  // Guardrails answer their id as uuid, where every other resource answers <resource>_id.
  const guardrail = await tavusRequest<{ uuid?: string }>("POST", "/guardrails", readConfig("guardrail.json"));
  if (!guardrail?.uuid) throw new Error("Create Guardrail returned no uuid");
  saveId(ids, "guardrail", guardrail.uuid);
}

async function createTool(ids: Ids, tool: { name: string }): Promise<void> {
  const name = TOOL_NAMES.find((toolName) => toolName === tool.name);
  if (!name) throw new Error(`config/tools.json has an unexpected tool: ${tool.name}`);
  if (ids[name]) return;
  try {
    const created = await tavusRequest<{ tool_id?: string }>("POST", "/tools", tool);
    if (!created?.tool_id) throw new Error(`Create Tool returned no tool_id for ${name}`);
    saveId(ids, name, created.tool_id);
  } catch (error) {
    if (!(error instanceof TavusError && error.status === 409)) throw error;
    saveId(ids, name, await findToolId(name));
    console.info(`${name} already existed and was left unchanged; update it by hand if config/tools.json changed`);
  }
}

async function createTools(ids: Ids, baseUrl: string, secret: string): Promise<void> {
  const tools = fill(readConfig("tools.json"), { PUBLIC_BASE_URL: baseUrl, TOOL_HMAC_SECRET: secret });
  if (JSON.stringify(tools).includes("${")) throw new Error("config/tools.json has a placeholder left after filling");
  for (const tool of tools as { name: string }[]) await createTool(ids, tool);
}

/** The open call's objectives ride on the PAL; the speed round's replace them per call. */
async function createObjectives(ids: Ids): Promise<void> {
  const sets = readConfig("objectives.json") as Record<"open" | "speed", unknown[]>;
  for (const name of ["open", "speed"] as const) {
    const key = `objectives_${name}` as const;
    if (ids[key]) continue;
    const created = await tavusRequest<{ objectives_id?: string }>("POST", "/objectives", { data: sets[name] });
    if (!created?.objectives_id) throw new Error(`Create Objectives returned no objectives_id for ${name}`);
    saveId(ids, key, created.objectives_id);
  }
}

/** Spells type codes out letter by letter, so text-to-speech never reads LIE or SEE as words. */
async function createPronunciation(ids: Ids): Promise<void> {
  if (ids.pronunciation) return;
  const created = await tavusRequest<{ pronunciation_dictionary_id?: string }>("POST", "/pronunciation-dictionaries", readConfig("pronunciation.json"));
  if (!created?.pronunciation_dictionary_id) throw new Error("Create Pronunciation Dictionary returned no id");
  saveId(ids, "pronunciation", created.pronunciation_dictionary_id);
}

/** Builds the PAL from config/pal.json with the prompt read in and the guardrail attached, creates it, then attaches both tools. */
async function createPal(ids: Ids): Promise<string> {
  const { _setup: setup, ...palConfig } = readConfig("pal.json") as PalConfig;
  const toolIds = (setup?.attach_tools ?? TOOL_NAMES).map((name) => ids[name]);
  if (!ids.guardrail || !ids.objectives_open || !ids.pronunciation || toolIds.some((id) => !id)) {
    throw new Error("A guardrail, objectives, pronunciation or tool id is missing from config/ids.json");
  }
  const pal = {
    ...palConfig,
    system_prompt: readFileSync(configPath("forge-system-prompt.md"), "utf8"),
    guardrail_ids: [...new Set([...(palConfig.guardrail_ids ?? []), ids.guardrail])],
    objectives_id: ids.objectives_open,
    layers: { ...palConfig.layers, tts: { pronunciation_dictionary_id: ids.pronunciation } },
  };
  const created = await tavusRequest<{ pal_id?: string }>("POST", "/pals", pal);
  if (!created?.pal_id) throw new Error("Create PAL returned no pal_id");
  try {
    await tavusRequest("POST", `/pals/${created.pal_id}/tools`, { tool_ids: toolIds });
  } catch (error) {
    console.error(`PAL ${created.pal_id} exists but the tools did not attach: attach them by hand, or delete that PAL before re-running.`);
    throw error;
  }
  saveId(ids, "pal", created.pal_id);
  return created.pal_id;
}

/** Reads the PAL back and prints the models and tools, since Create PAL's schema does not list the perception queries. */
async function printReadBack(palId: string): Promise<void> {
  const live = await tavusRequest<PalReadBack>("GET", `/pals/${palId}`);
  const attached = await tavusRequest<{ data?: ToolRow[] }>("GET", `/pals/${palId}/tools`);
  const queries = live?.layers?.perception?.perception_analysis_queries;
  console.info(`llm: ${live?.layers?.llm?.model}`);
  console.info(`turn detection: ${live?.layers?.conversational_flow?.turn_detection_model}`);
  console.info(`perception: ${live?.layers?.perception?.perception_model}`);
  console.info(`tools: ${(attached?.data ?? []).map((tool) => tool.name).join(", ")}`);
  console.info(Array.isArray(queries) ? `analysis queries: ${queries.length}` : "analysis queries: missing after create");
}

async function main(): Promise<void> {
  const ids = readIds();
  if (ids.pal) throw new Error(`config/ids.json already holds pal ${ids.pal}; change it with a PATCH instead`);
  const { baseUrl, secret } = checkEnv();
  // Read-only: proves the key works before anything is created.
  await tavusRequest("GET", "/tools?type=system");
  await createGuardrail(ids);
  await createTools(ids, baseUrl, secret);
  await createObjectives(ids);
  await createPronunciation(ids);
  await printReadBack(await createPal(ids));
}

main().catch((error: unknown) => {
  console.error(error instanceof TavusError ? `Tavus ${error.status}: ${error.message}` : error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
