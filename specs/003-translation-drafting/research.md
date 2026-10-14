# Phase 0 Research: Translation Drafting

## Getting reliable structured output from Claude (array of translated strings)

- **Decision**: use the Anthropic TypeScript SDK's `client.messages.parse()` with `output_config.format` built via `zodOutputFormat()` (the `@anthropic-ai/sdk/helpers/zod` helper), not forced tool-use.
- **Rationale**: forcing a specific tool call (`tool_choice: {type: "tool", name: ...}` or `{type: "any"}`) — the approach assumed during brainstorming — returns an HTTP 400 on Claude Sonnet 5.5 (and every other current-generation model: Opus 5.5, Fable 5.1). Forced tool use was removed from these models; Anthropic's own recommended replacement for "I just want this JSON shape back" is exactly `client.messages.parse()` with a Zod-defined `output_config.format`, which validates the response against the schema itself (`response.parsed_output`) with no manual JSON parsing or retry-on-malformed-tool-call logic needed. This is simpler than the brainstormed tool-use approach, not just a workaround for its removal.
- **Schema**: `z.object({ translations: z.array(z.string()) })`. After the call, the handler still validates `translations.length` matches the number of strings sent — `parsed_output` being schema-valid doesn't guarantee Claude preserved the array's length or order, so this check is not optional (FR from spec.md: a mismatched length is a hard translation failure, never a best-effort splice).
- **Alternatives considered**:
  - Forced tool use (`tool_choice: {type: "tool", ...}`) — rejected, returns 400 on Claude Sonnet 5.5 (confirmed against current API docs, not assumed).
  - Free-form text output parsed as JSON manually — rejected, more failure modes (preamble text, markdown code fences, truncation) than the SDK's own structured-output path with no corresponding benefit.
  - `strict: true` tool use with `tool_choice: {type: "auto"}` plus a prompt instruction — viable fallback, but `messages.parse()` is the more direct, officially-recommended fit for "return this exact JSON shape," so it's the primary choice; not needed as a fallback given `parse()`'s length/order check already covers correctness.

## Batching: one Claude call per translation request

- **Decision**: a single `messages.parse()` call per `POST /translate` request. All translatable strings for the whole recipe — name, description, every group name, every ingredient name, and every step's extracted text-node strings — are flattened into one ordered array and sent together; the response is redistributed back into the respective fields by position.
- **Rationale**: matches the spec's "whole recipe in one action" requirement directly; a single call is simpler, cheaper (one request's worth of input-token overhead instead of N), and keeps terminology consistent across the whole recipe (one French ingredient name translated the same way everywhere it appears, one context window for word choice) rather than risking inconsistent phrasing across several independent calls.
- **Alternatives considered**: one call per field/step — rejected, no benefit over a single call and loses cross-field terminology consistency; batching via the Message Batches API (async, 50% cheaper) — rejected, this is a synchronous, interactive user action (the owner is waiting on the result in the editor), not a non-latency-sensitive bulk job.

## Rich-text (Tiptap JSON) text extraction

- **Decision**: a pure, recursive tree-walking function extracts every `{type: "text", text: "..."}` node's `text` value from a Tiptap document, in traversal order, into a flat array; a matching reinsertion function walks the *same original* tree in the same order, replacing each text node's `text` field with the corresponding translated string at the same index, and returns a new tree with every other node (marks, `bulletList`/`listItem` nesting, `image` nodes, `attrs`) completely untouched.
- **Rationale**: this was the one brainstormed decision this spec already locked in (FR-002/SC-002) — it guarantees formatting preservation by construction (the structure is never regenerated or re-derived from a model's output, only its leaf text values are substituted), rather than relying on a model faithfully reproducing nested JSON.
- **Alternatives considered**: none — already decided during brainstorming; research here only confirms the data shape (standard ProseMirror/Tiptap `doc` JSON: nodes have `type`, optional `content` (child array), optional `marks`, optional `attrs`; leaf text nodes have `text` and no `content`) so the tree-walking code can be written against a precise shape rather than a guess.

## Dependency versions (verified 2026-10-14)

| Package | Verified latest |
|---|---|
| `@anthropic-ai/sdk` | 0.133.0 |
| `zod` | 4.6.7 |
| Claude model id (Sonnet 5.5) | `claude-sonnet-5-5` — confirmed current, not a stale/retired id |

## Model and cost-control choice

- **Decision**: `claude-sonnet-5-5`, set as a plain Lambda environment variable (not a secret — it's not sensitive), so changing it later is a one-line `infra/api.ts` edit.
- **Rationale**: the owner explicitly asked for "a more capable model for now" given ample Claude API credits, while keeping it trivially swappable — matches Sonnet 5.5's position as the current mid/high-capability tier (meaningfully more capable than Haiku 5.5, cheaper than Opus 5.5) and was reviewed and accepted by the owner by name during brainstorming.
- **Alternatives considered**: `claude-opus-5-5` — more capable still, but the owner's stated preference during brainstorming was specifically Sonnet-tier capability with room to upgrade later if quality disappoints, not the most capable model available; `claude-haiku-5-5` — rejected per the owner's explicit "more capable" preference.

## Secret management

- **Decision**: `new sst.Secret("AnthropicApiKey")`, set via `sst secret set AnthropicApiKey <key> --stage production` from the owner's machine (same mechanism as every other secret in this project, per 002's precedent) — never passed through CI or committed. The new Lambda function reads it via a plain `environment: { ANTHROPIC_API_KEY: anthropicApiKey.value }` binding in `infra/api.ts`, not SST's generated `Resource` types.
- **Rationale**: 002 already established (and hit in practice) that relying on SST's generated `Resource.*` types breaks `tsc` in a fresh checkout — those types don't exist until a real `sst deploy`/`dev` has run at least once, which CI's test job never does (and shouldn't, since it needs no AWS/Anthropic credentials at all). Passing the secret's value through a plain environment variable keeps the handler's own typecheck independent of any prior deploy, exactly like `TABLE_NAME` and `IMAGES_BUCKET_NAME` already do.

**Output**: all Technical Context items resolved; no `NEEDS CLARIFICATION` markers remain.
