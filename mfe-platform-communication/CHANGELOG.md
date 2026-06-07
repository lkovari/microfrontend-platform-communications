# Changelog

All notable changes to **`@lkovari/microfrontend-platform-communication`** are documented here.

Format: each entry lists **what** changed, **where** (`path:startLine-endLine`), **why** it was needed, and **why the new behavior is better**. Line numbers refer to the current tree after these changes.

---

## [0.3.2] - 2026-06-07

### Summary

Test-coverage expansion for previously untested security-sensitive and lifecycle-critical paths — merge-patch `null`-delete semantics, sensitivity-policy and validator guards, dedupe window expiry, request lifecycle under dispose and concurrency, `sendCommand` validation/dedupe Nacks, and host-bridge `return-existing` mismatch checks — plus one adapter lifecycle fix: the React and Vue bus providers now dispose the bus on unmount, matching Angular's `DestroyRef` teardown. Test count grows to 125.

---

### Fixed — React / Vue bus disposal on unmount

**What:** `BusProvider` (React) and `createBusPlugin` (Vue) now call `bus.dispose()` when the provider/app tears down, mirroring the Angular `provideBus` `DestroyRef` behavior.

**Where:**

| File | Content |
|------|---------|
| `src/react/BusProvider.tsx` | `useEffect` cleanup disposes the ref-held bus on unmount |
| `src/vue/createBusPlugin.ts` | `app.onUnmount(() => bus.dispose())`, feature-detected for the `>=3.3.0` peer range |

**Why:** Both adapters created a bus but never disposed it, so listeners and the request coordinator survived unmount — a leak in HMR, lazy routes, and repeated mounts. Angular already disposed via `DestroyRef`; React/Vue did not.

**Why better:** Consistent teardown semantics across all three adapters; no orphaned subscriptions after unmount. The Vue hook is guarded with `typeof app.onUnmount === 'function'` so consumers below Vue 3.5 degrade gracefully.

---

### Added — Test coverage for merge-patch, policy, validator, dedupe, request, command, and bridge-conflict behavior

**What:** Targeted tests for previously uncovered branches and recently-changed behavior.

**Where:**

| File | Added tests |
|------|-------------|
| `test/state-sync.spec.ts` | `patch` deletes a top-level key on `null`; deletes only the targeted nested key on `null`; cannot store a literal `null` (replace required) |
| `test/bus.spec.ts` | default sensitivity policy blocks `restricted`; `enableDefaultSensitivityPolicy: false` allows it; custom policy composes with the default; unregistered `messageName` throws; `allowUnregisteredMessageNames` permits it; `dispose()` rejects an in-flight `request()`; concurrent requests resolve independently by `causationId`; `sendCommand` validation Nack; `sendCommand` dedupe Nack |
| `test/dedupe.spec.ts` | **new file** — `createDedupeGate` window/expiry/independent-id semantics; bus re-accepts a `messageId` after the dedupe window elapses (fake timers) |
| `test/host-bridge.spec.ts` | `onConflict: 'return-existing'` throws on `appId`, bus-instance, and `stateSync` mismatch |
| `test/adapters.spec.ts` | React `BusProvider` and Vue `createBusPlugin` dispose the bus on unmount |

**Why:** These branches were high-value but untested: RFC 7396-style `null`-delete on state `patch`, the default sensitivity policy and its `enableDefaultSensitivityPolicy: false` escape hatch, the unregistered-`messageName` validator guard, dedupe window expiry, in-flight `request()` rejection on `dispose()`, concurrent request correlation by `causationId`, non-timeout `sendCommand` Nacks (validation and dedupe), and `onConflict: 'return-existing'` mismatch detection for `appId`, bus instance, and `stateSync` options.

**Why better:** These are security-relevant (policy escape hatch, validator guard), recently-changed (RFC 7396 `null`-delete), and time/concurrency-sensitive paths where regressions are silent. Suite grows from 104 to **125** tests.

---

### Changed — package version

**What:** `0.3.1` → `0.3.2` (`package.json`) to reflect the adapter lifecycle behavior change.

---

## [0.3.1] - 2026-06-07

### Summary

Follow-up hardening after the source audit (see repo-root `issues-fix-hu.md`): align the local Angular toolchain with the CI matrix and close documentation gaps so the docs match the already-shipped runtime behavior. No production source-logic or public-API changes.

---

### Changed — Angular devDependency aligned to the CI matrix (audit L-06)

**What:** Bumped the Angular dev toolchain to the highest supported major.

**Where:**

| File | Content |
|------|---------|
| `package.json` | `@angular/compiler` and `@angular/core` devDependencies `^17.3.0` → `^19.0.0` |

**Why:** The CI matrix (`.github/workflows/angular-matrix.yml`) already exercised Angular 17/18/19, but the pinned devDependency meant a local `pnpm test` only ever ran against Angular 17.

**Why better:** Local development now runs against the newest supported Angular API surface; the 17/18/19 spread remains covered by CI. Peer range (`>=17.0.0`) is unchanged, so consumers are unaffected.

---

### Documentation — `patch` merge-patch / `null`-delete semantics (audit M-05)

**What:** Documented that `state` `patch` is a recursive merge-patch where a `null` value deletes the key (RFC 7396-style), and that a literal `null` requires `replace`.

**Where:**

| File | Content |
|------|---------|
| `README.md` (package) | `patch` state-operation row rewritten + explanatory callout pointing at `mergePatch` (`src/core/state-sync.ts`) |
| `../messagekind-usage-hu.md` | `patch` table row updated; warning callout under the `patch` example; pitfalls bullet |

**Why:** `applyPatch` already performed a deep merge-patch with `null`-deletes-key, but the docs still described a shallow / generic JSON-patch delta.

**Why better:** Docs now match runtime behavior; consumers relying on the old shallow merge or expecting a literal `null` are warned and pointed to `replace`.

---

### Documentation — request/response `causationId` contract (audit C-02)

**What:** Emphasized that a responder must set `response.causationId === request.messageId` and that the bus enforces this at runtime.

**Where:**

| File | Content |
|------|---------|
| `README.md` (package) | request/response feature bullet notes the runtime enforcement and rejection on mismatch |
| `../messagekind-usage-hu.md` | prominent correlation-rule callout in the `command` section (applies to `query` too) |

**Why:** The runtime guard exists in `bus.ts`, but the caller-side obligation was easy to miss, leading to silent request timeouts on a missing/incorrect `causationId`.

**Why better:** Integrators get an explicit, discoverable contract for writing responders.

---

### Documentation — `accepted: true` ≠ delivered (audit M-04)

**What:** Clarified that an `accepted: true` result from `bridge.tryPublish()` / `attemptPublish()` means "accepted for delivery", not "received by subscribers".

**Where:**

| File | Content |
|------|---------|
| `../messagekind-usage-hu.md` | pitfalls bullet explaining microtask-dispatch timing |

**Why:** With the default `microtask` dispatch, actual delivery happens in a later microtask, so `accepted: true` can be mistaken for a delivery guarantee.

**Why better:** Sets correct expectations for the publish result without changing the (already correct) `accepted` wording.

---

## [0.3.0] - 2026-05-31

### Summary

Three additive, opt-in hardening features: **token-gated bridge access** (mitigates trivial `window.__MFE_BRIDGE__` injection), **kind-aware runtime behavior** (the bus now acts on command/query timeout fields instead of treating `kind` as pure convention), and **registry auto-registration** of topics and version ranges derived from the Zod validators. No breaking changes to existing `publish` / `subscribe`.

---

### Added — Token-gated bridge access (items 3 + 4)

**What:** The host can supply an unguessable access token; remotes must present it before obtaining the bus or publishing through the bridge.

**Where:**

| File | Content |
|------|---------|
| `src/core/host-bridge.ts` | `CreateHostBridgeOptions.accessToken?`; `generateAccessToken()` (128-bit CSPRNG hex via `crypto.getRandomValues`); constant-time token compare; closure-held token (never a readable handle property); `getBus(token?)` / `tryPublish(message, token?)` gating |
| `src/core/errors.ts` | `HostBridgeErrorCode` gains `'unauthorized'` |
| `src/core/index.ts` | exports `generateAccessToken` |
| `src/angular/provide-remote-platform-bus.ts` | `provideRemotePlatformBus({ accessToken })` forwards the token to `bridge.getBus()` |
| `src/angular/provide-host-bridge.ts`, `src/react/HostBridgeProvider.tsx`, `src/vue/createHostBridgePlugin.ts` | forward `accessToken` to `createHostBridge` |
| `src/angular/host-bridge.service.ts` | `getBus(token?)` / `tryPublish(message, token?)` pass-through |

**Why:** Previously anyone holding a reference to `window.__MFE_BRIDGE__` could call `getBus()` / `tryPublish()` regardless of the `remotes` list.

**Why better:** A token known only to the host and distributed out-of-band to legitimate remotes blocks trivial, random injection. When no token is configured, behavior is unchanged (backward compatible). This is **not** a full security model — `allowedPublishers` remains a convention and cryptographic ACL is still out of scope.

---

### Added — Kind-aware runtime behavior (item 2)

**What:** The bus now acts on kind-specific fields.

**Where:**

| File | Content |
|------|---------|
| `src/core/bus.ts` | `request()` falls back to query `timeoutMs` when no explicit timeout is passed, and validates the response `messageName` against `expectedResult`; new `sendCommand(command): Promise<AckResult>` waits for an acknowledgment (`causationId === command.messageId`) bounded by `ackTimeoutMs` |
| `src/core/bus.ts` | `BusPublisher.sendCommand` added to the interface |
| `src/angular/bus.service.ts` | `BusService.sendCommand` pass-through |

**Why:** `ackTimeoutMs` / `timeoutMs` / `expectedResult` were schema-only and ignored at runtime.

**Why better:** Commands get explicit ACK/timeout handling and queries get timeout + result-name enforcement without changing fire-and-forget `publish`.

---

### Added — Registry auto-registration from validators (item 1)

**What:** `TopicRegistry` can derive topics and version ranges directly from the Zod validators map.

**Where:**

| File | Content |
|------|---------|
| `src/core/registry.ts` | `registerFromValidators()`, static `TopicRegistry.fromValidators()`, `getRegistration()`, and Zod introspection that reads a literal or inclusive min/max `messageVersion` |
| `src/schemas/message-base.schema.ts` | `versionedMessageSchema(schema, version)` pins `messageVersion` to a literal so auto-detection is meaningful |
| `src/schemas/index.ts` | exports `versionedMessageSchema` |
| `src/core/bus.ts` | `CreateBusOptions.autoRegisterTopics?` builds/augments the registry from `validators` in `createBus` |

**Why:** Topics and version ranges had to be hand-listed via `register()`.

**Why better:** Less duplication; explicit `register()` entries always win (auto-registration never overwrites them).

---

### Changed

| Change | Location |
|--------|----------|
| `MfeBridgeHandle.getBus` / `tryPublish` accept an optional `token` argument | `src/core/host-bridge.ts` |

---

### Changed — TypeScript compiler strictness

**What:** Hardened the library `tsconfig.json` and aligned the examples workspace `tsconfig.json` with the library's contract strictness.

**Where:**

| File | Content |
|------|---------|
| `tsconfig.json` | Added `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `forceConsistentCasingInFileNames` (on top of existing `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| `../examples/tsconfig.json` | Added `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` so the host/remote demos are checked at the same strictness the contracts enforce |

**Why:** The examples app validated consumer usage of the contracts at a lower strictness than the library itself, so code could pass in examples yet fail under the published settings. The library, which emits `.d.ts`, also lacked the safety flags that are most valuable for a declaration-emitting package.

**Why better:** `verbatimModuleSyntax` + `isolatedModules` keep type-only imports out of emitted JS and guarantee each file transpiles standalone; `noImplicitOverride` protects the Angular/React/Vue adapter class hierarchies; `forceConsistentCasingInFileNames` avoids cross-OS import breakage. No source changes were required — `pnpm typecheck` and `pnpm build` pass unchanged. No runtime or public-API impact.

---

### Migration from 0.2.1

| If you… | Action |
|--------|--------|
| Implement a custom `Bus` | Implement the new `sendCommand()` method (`src/core/bus.ts`). |
| Want injection protection | Pass `accessToken` to `createHostBridge` / `provideHostBridge` / `HostBridgeProvider` / `createHostBridgePlugin` and present it from remotes via `getBus(token)` / `provideRemotePlatformBus({ accessToken })`. |
| Rely on `getBus()` with no token | No change — gating is inactive unless `accessToken` is configured. |

---

### Verification commands

```bash
cd mfe-platform-communication
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## [0.2.1] - 2026-05-23

### Summary

Lint and CI hardening: zero-warning ESLint, Prettier check in CI, Vitest hygiene rules, strict TypeScript safety rules aligned with `strict` tsconfig, and removal of type assertions from production `src/`.

---

### CI strictness

| Change | Location |
|--------|----------|
| `lint` / `lint:fix` use `--max-warnings 0` | `package.json` scripts |
| New `format:check` script (`prettier --check`) | `package.json` scripts |
| CI runs `pnpm format:check` before lint | `.github/workflows/angular-matrix.yml` |

**Why:** Treat warnings as failures in CI; catch formatting drift without auto-fixing in the pipeline.

---

### ESLint — unsafe TypeScript + no assertions

| Rule / change | Location |
|---------------|----------|
| `@typescript-eslint/no-explicit-any`: error | `eslint.config.mjs` |
| `@typescript-eslint/no-unsafe-*`: error (assignment, member-access, return, call, argument) | `eslint.config.mjs` |
| `@typescript-eslint/no-non-null-assertion`: error | `eslint.config.mjs` |
| `@typescript-eslint/switch-exhaustiveness-check`: error | `eslint.config.mjs` |
| `no-restricted-syntax` bans `as` / angle-bracket assertions (`as const` allowed) | `eslint.config.mjs` |
| `no-console`: error in `src/`; allowed in `observability.ts`; `console.error` only in `bus.ts` | `eslint.config.mjs` |

**Why:** Align runtime safety with strict tsconfig and project no-assertion preference.

---

### Vitest plugin — test hygiene

| Rule | Location |
|------|----------|
| `@vitest/eslint-plugin` recommended rules | `eslint.config.mjs` |
| `vitest/expect-expect`, `no-disabled-tests`, `no-focused-tests`, `valid-title` | `eslint.config.mjs` |
| Tests refactored away from `expect` inside conditionals | `test/bus.spec.ts`, `test/host-bridge.spec.ts`, `test/registry.spec.ts` |

**Why:** Prevent silent or skipped tests from merging; keep titles and assertions reviewable.

---

### Production code — assertion-free refactors

| Change | Location |
|--------|----------|
| `readBusMessageFromEvent()` with `MessageBaseSchema.passthrough()` | `src/core/bus-event.ts` |
| `subscribe` handler typed as `(message: MessageBase) => void` | `src/core/bus.ts` |
| `request` overload: optional `ZodType<TRes>` third arg for typed responses | `src/core/bus.ts`, `src/angular/bus.service.ts` |
| `StateMessageSchema.safeParse` in state sync hook | `src/core/state-sync.ts` |
| `getSnapshot(stateKey)` returns `unknown` (no generic cast) | `src/core/state-sync.ts`, `src/core/host-bridge.ts` |
| React/Vue `useSubscribe` accepts `MessageBase` handlers | `src/react/useSubscribe.ts`, `src/vue/useSubscribe.ts` |
| `BusService.messages$()` returns `Observable<MessageBase>` | `src/angular/bus.service.ts` |
| `expectParsedMessage()` test helper for schema-narrowed assertions | `test/helpers.ts` |

**Why:** Satisfy lint rules without weakening validation; callers narrow with Zod where they need typed payloads.

---

### Migration from 0.2.0

| If you… | Action |
|--------|--------|
| Use `bus.subscribe<MyMsg>(…)` for typed handlers | Pass `(message: MessageBase) => void` and parse with your topic schema, or use framework helpers that accept `MessageBase`. |
| Use `bus.request<TReq, TRes>(req, timeout)` without validator | Return type is `Promise<MessageBase>`; pass a `ZodType<TRes>` as third argument for typed responses. |
| Use `bridge.getSnapshot<T>(key)` | Use `getSnapshot(key)` and narrow the `unknown` result (e.g. with Zod). |
| Use `BusService.messages$<M>(…)` | Use `messages$(…)` → `Observable<MessageBase>`. |

---

## [0.2.0] - 2026-05-23

### Summary

Production-readiness work (RFC FIX-01–FIX-16): TopicRegistry tests, publish outcome API, dedupe visibility on the bridge, request fail-fast, observability hooks, full Angular host/remote DI surface, state bootstrap snapshot, examples + federation E2E CI, contract snapshot governance, and expanded docs.

---

### Migration from 0.1.4

| If you… | Action |
|--------|--------|
| Use `bridge.tryPublish()` from remotes | Handle `accepted: false` with `errorCode: 'dedupe'` for duplicate `messageId` within the dedupe window. |
| Use `onDispatchError` + `tryPublish` | Expect `Nack` (`errorCode: 'delivery'`) when publish fails, not silent `accepted: true`. |
| Use `bus.publish()` only | No change for dedupe (still silent drop). |
| Use `request()` with invalid publish + `onDispatchError` | Set `failFastOnDispatchError: true` to avoid 5s timeout, or fix the request payload. |
| Use Angular `provideBus` / `provideHostBridge` | Bus/bridge auto-`dispose()` on injector destroy; recreate providers if you need a new bridge after teardown. |
| Implement custom `Bus` | Implement new `attemptPublish()` (`src/core/bus.ts:20`). |

---

## Added

### TopicRegistry test coverage (FIX-01)

**What:** Dedicated unit tests for `TopicRegistry` and bus integration tests proving ACL/version enforcement in the real publish/subscribe path.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `test/registry.spec.ts` | 1–127 | Unit tests: unknown topic (permissive), `allowedPublishers` / `allowedSubscribers`, `minMessageVersion` / `maxMessageVersion`, `BusPolicyError` codes |
| `test/bus.spec.ts` | 1024–1053 | `TopicRegistry blocks publish from unauthorized source` |
| `test/bus.spec.ts` | 1055–1073 | `TopicRegistry blocks subscribe from unauthorized subscriberId` |
| `vitest.config.ts` | 18–24 | Coverage threshold ≥ 80% for `src/core/registry.ts` |

**Why:** `registry.ts` was the only ACL/version gate in enterprise setups but had **zero tests**; regressions could break security silently.

**Why better:** CI fails if registry logic or wiring regresses; integrators can copy patterns from tests and RFC §4.1.8.

**Implementation reference:** `src/core/registry.ts` (unchanged logic); enforcement at `src/core/bus.ts:157` (`assertCanPublish`) and `src/core/bus.ts:264` (`assertCanSubscribe`).

---

### `PublishOutcome`, `attemptPublish`, and `onDedupe` (FIX-14)

**What:** Publish path returns an explicit outcome; optional dedupe callback.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/bus.ts` | 13–16 | `PublishOutcome`: `'delivered' \| 'dedupe' \| 'rejected'` |
| `src/core/bus.ts` | 20 | `BusPublisher.attemptPublish()` |
| `src/core/bus.ts` | 60 | `CreateBusOptions.onDedupe?` |
| `src/core/bus.ts` | 67 | `PrepareSyncResult = 'deliver' \| 'dedupe'` |
| `src/core/bus.ts` | 147–163 | `prepareSync()` returns `'dedupe'` when `dedupe.shouldDrop` |
| `src/core/bus.ts` | 184–207 | `runPublish()` — outcomes + `onDedupe` invocation |
| `src/core/bus.ts` | 216–218 | `attemptPublish()` implementation |
| `src/core/index.ts` | 37 | `PublishOutcome` export |
| `test/bus.spec.ts` | 1075–1105 | `attemptPublish returns dedupe…`, `onDedupe` called once |

**Why:** Duplicate `messageId` was **silently dropped** in `publish()` with no signal to remotes or metrics.

**Why better:** Callers can branch on outcome; `onDedupe` supports logging/metrics without parsing Nacks; `publish()` stays void for backward-compatible fire-and-forget usage.

**Note:** `publish()` (`src/core/bus.ts:212–214`) still calls `runPublish(message, false)` and does not return the outcome — behavior unchanged for existing host code.

---

### Host bridge: dedupe `Nack` via `attemptPublish` (FIX-14)

**What:** `tryPublish` maps `attemptPublish` outcomes to `Ack` / `Nack`, including `errorCode: 'dedupe'`.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/host-bridge.ts` | 221–256 | `tryPublish` uses `bus.attemptPublish`; dedupe → `Nack` with `errorCode: 'dedupe'`; rejected → `errorCode: 'delivery'` |
| `test/host-bridge.spec.ts` | 395–430 | `tryPublish returns dedupe Nack for duplicate messageId` |

**Why:** Remotes using `tryPublish` previously received **`accepted: true`** even when the bus dropped a duplicate (`0.1.4`).

**Why better:** Enterprise teams can retry, alert, or audit dedupe conflicts; aligns with `BusErrorCode: 'dedupe'` in `src/contracts/envelopes.ts` (already defined, now used).

---

### `failFastOnDispatchError` and `request()` cancellation (FIX-10)

**What:** Opt-in immediate `request()` rejection when publish fails under `onDispatchError`; internal `cancelRequest` on the request coordinator.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/bus.ts` | 61 | `CreateBusOptions.failFastOnDispatchError?` |
| `src/core/bus.ts` | 166–176 | `handlePublishError` rethrows when `failFastOnDispatchError && fromRequest` |
| `src/core/bus.ts` | 220–244 | `request()` uses `runPublish(message, true)`; dedupe/failure → `cancelRequest` + throw; `void wait.catch` avoids floating rejection |
| `src/core/request-response.ts` | 27–35 | `cancelRequest(causationId, error)` clears timer and rejects waiter |
| `test/bus.spec.ts` | 1107–1132 | Fail-fast rejects with `BusValidationError` instead of 5s wait |

**Why:** With `onDispatchError`, failed `publish` during `request()` was swallowed; the waiter hung until **default 5000 ms timeout** — hard to debug in production.

**Why better:** Explicit, fast failure when opted in; default remains `false` so existing apps keep 0.1.4 timeout behavior unless they enable the flag.

---

### Observability adapter (FIX-08)

**What:** Pluggable hooks for publish, deliver, errors, and request timeouts; console reference implementation.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/observability.ts` | 1–32 | `ObservabilityContext`, `ObservabilityAdapter`, `ConsoleObservabilityAdapter` |
| `src/core/bus.ts` | 62 | `CreateBusOptions.observability?` |
| `src/core/bus.ts` | 105–107, 167, 188, 227–228, 298 | Hook invocations on errors, publish, deliver, timeout, `observeAll` |
| `src/core/index.ts` | 32–36 | Public exports |
| `test/bus.spec.ts` | 1134–1176 | Adapter receives publish/deliver; console adapter smoke |

**Why:** Only `observeAll` existed; SRE teams need structured extension points (future OpenTelemetry) without coupling to `EventTarget`.

**Why better:** Single adapter interface for metrics/tracing/logging; devs can use `ConsoleObservabilityAdapter` locally without custom `observeAll` wrappers.

---

### `MfeBridgeHandle.getSnapshot` (FIX-16)

**What:** Optional `getSnapshot(stateKey)` on the bridge when state sync is attached.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/host-bridge.ts` | 15 | `getSnapshot?` on `MfeBridgeHandle` |
| `src/core/host-bridge.ts` | 257–261 | Delegates to `stateCoordinator.getSnapshot` |
| `src/core/state-sync.ts` | 27, 133 | Coordinator API (pre-existing; now exposed on bridge) |
| `test/host-bridge.spec.ts` | 432–456 | Snapshot returns `initialSnapshots` value |

**Why:** Remotes connecting after host init had **no API** to read host state revision/snapshot without waiting for a state message.

**Why better:** Remote bootstrap can render consistent UI immediately (`bridge.getSnapshot?.('person')`) instead of stale placeholders.

---

### Angular adapter extensions (FIX-05)

**What:** Parity with core `Bus` for observability hooks and lifecycle; first-class remote bootstrap.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/angular/bus.service.ts` | 51–68 | `observeAll$()`, `registerBeforeDeliver()`, `dispose()` |
| `src/angular/provide-host-bridge.ts` | 31–34, 41–43 | `DestroyRef` → `bridge.dispose()`; `injectHostBridge()` |
| `src/angular/provide-bus.ts` | 19–22 | `DestroyRef` → `bus.dispose()` |
| `src/angular/provide-remote-platform-bus.ts` | 1–25 | **New file** — validates `window.__MFE_BRIDGE__`, provides `BUS_TOKEN` |
| `src/angular/index.ts` | 2–3 | Exports `injectHostBridge`, `provideRemotePlatformBus` |
| `test/adapters.spec.ts` | 413–456 | `provideBus` + `provideHostBridge` wiring |
| `test/adapters.spec.ts` | 458–503 | `BusService.request` causation path |
| `test/adapters.spec.ts` | 505–535 | Injector destroy disposes bus |
| `test/adapters.spec.ts` | 537–556 | `provideRemotePlatformBus` |
| `test/adapters.spec.ts` | 558–595 | `observeAll$` |
| `test/adapters.spec.ts` | 597–654 | React `usePublish` |
| `test/adapters.spec.ts` | 656–670 | Vue `createHostBridgePlugin` |

**Why:** Enterprise Angular hosts needed DI-friendly bridge access, remote `BUS_TOKEN` without copy-paste, and HMR-safe cleanup; `BusService` exposed only `publish` / `request` / `messages$`.

**Why better:** Matches core capabilities; reduces memory leaks in tests and lazy routes; remotes use one provider instead of manual `getBus()` guards.

---

### Core public API: `HostBridgeConflictPolicy` (FIX-17 bundled)

**What:** Export conflict policy union from `/core` barrel.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `src/core/host-bridge.ts` | 25 | `HostBridgeConflictPolicy` type |
| `src/core/index.ts` | 27–31 | Re-export with `CreateHostBridgeOptions` |

**Why:** Type existed on `host-bridge.ts` but was missing from `core/index.ts`; consumers deep-imported or duplicated the union.

**Why better:** Stable import from `@lkovari/.../core` for host `onConflict` typing.

---

### Contract snapshot tooling (FIX-03)

**What:** Script exports Zod schemas to JSON; committed snapshots; CI verifies drift.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `scripts/export-schemas.mts` | 1–37 | Exports 8 schemas to `contracts-snapshot/*.json` |
| `contracts-snapshot/` | — | `MessageBase.json`, `EventMessage.json`, … (8 files) |
| `package.json` | 62 | `"export:schemas": "tsx scripts/export-schemas.mts"` |
| `package.json` | devDeps | `tsx`, `zod-to-json-schema` |
| `.github/workflows/contract-snapshot.yml` | 1–34 | Run export + `git diff --exit-code contracts-snapshot/` |

**Why:** `messageVersion` bumps were manual; breaking schema edits could reach production unnoticed.

**Why better:** PRs fail if schemas change without updating snapshots; teams get a diffable contract history and a clear bump policy (RFC §1.5).

**Breaking change policy (documented in RFC):** field removal, type narrowing, enum value removal → require `messageVersion` bump + CHANGELOG + snapshot update.

---

### Examples workspace + federation E2E (FIX-02, FIX-06)

**What:** Runnable Module Federation host + remote; Playwright smoke against production build.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `../pnpm-workspace.yaml` | 1–3 | Workspace: `mfe-platform-communication`, `examples` |
| `../examples/package.json` | 1–30 | `build`, `dev`, `test:e2e` scripts |
| `../examples/host/src/bootstrap.ts` | 1–35 | Host bus + bridge + dynamic `import('remoteOrders/bootstrap')` |
| `../examples/remote-orders/src/bootstrap.ts` | 1–42 | `getBus`, subscribe, `tryPublish` `person:updated` |
| `../examples/host/webpack.config.cjs` | — | MF host, remote URL `/remote-orders/remoteEntry.js` (prod) |
| `../examples/remote-orders/webpack.config.cjs` | — | MF remote exposes `./bootstrap` |
| `../examples/federation-e2e/smoke.mjs` | 1–95 | Static server + Playwright: bridge v1 + host receives remote publish |
| `../examples/README.md` | — | Dev/build/smoke instructions |
| `.github/workflows/federation-e2e.yml` | 1–41 | Build lib + examples, Playwright smoke |

**Why:** README referenced `examples/` that did not exist; all tests ran in jsdom, not real MF + `window.__MFE_BRIDGE__`.

**Why better:** Integrators have a copy-paste harness; CI catches federation/bridge regressions before deploy.

---

### Test suite and coverage gates (FIX-01, FIX-07)

**What:** Test count **63 → 86**; coverage thresholds for registry and adapters.

**Where:**

| File | Lines | Content |
|------|-------|---------|
| `test/registry.spec.ts` | **new** | 9 tests |
| `test/bus.spec.ts` | 1022–1177 | Registry integration, dedupe, fail-fast, observability |
| `test/host-bridge.spec.ts` | 395–456 | Dedupe Nack, `getSnapshot` |
| `test/adapters.spec.ts` | 413–670 | Angular/React/Vue expanded |
| `vitest.config.ts` | 15–43 | `coverage.thresholds` for registry, angular, react, vue |
| `.github/workflows/angular-matrix.yml` | 35 | `pnpm test:coverage` in matrix |

**Why:** Adapter happy paths and registry were under-tested (~0% on critical modules).

**Why better:** Regressions blocked in CI; documents expected behavior for each framework entry.

---

## Changed

### `tryPublish` acknowledgment on dedupe (breaking for remote callers)

**Before (0.1.4):** `tryPublish` → `accepted: true` when duplicate `messageId` was dropped inside `publish()`.

**After:** `tryPublish` → `accepted: false`, `errorCode: 'dedupe'` (`src/core/host-bridge.ts:230–237`).

**Why changed:** Silent success hid duplicate sends from ops and made idempotent retries indistinguishable from first delivery.

**Why better:** Explicit contract for remotes; matches `Nack` type in `src/contracts/envelopes.ts`; enables metrics and user-visible retry.

---

### `tryPublish` when `onDispatchError` swallows publish errors

**Before:** Validation/policy failure → `onDispatchError` called → `publish` returns → `tryPublish` often still **`accepted: true`**.

**After:** `attemptPublish` → `{ status: 'rejected' }` → `tryPublish` → `Nack` `errorCode: 'delivery'` (`src/core/host-bridge.ts:239–246`).

**Why changed:** ACK implied delivery though no subscriber ran.

**Why better:** Remotes can surface failure to users instead of assuming success.

---

### Angular `provideBus` / `provideHostBridge` lifecycle

**Before:** No automatic `dispose()` on teardown.

**After:** `DestroyRef.onDestroy` calls `bus.dispose()` / `bridge.dispose()` (`provide-bus.ts:19–22`, `provide-host-bridge.ts:31–34`).

**Why changed:** HMR and lazy routes leaked listeners and left stale `window.__MFE_BRIDGE__`.

**Why better:** Correct resource cleanup by default; aligns with Angular injector lifetime.

**Migration:** If you relied on bus surviving injector destroy, hoist `provideBus` to a longer-lived injector or avoid destroying the host environment.

---

### Internal publish pipeline refactor

**What:** `prepareSync` returns `'deliver' | 'dedupe'` instead of `boolean`; shared `runPublish()` for `publish`, `attemptPublish`, and `request`.

**Where:** `src/core/bus.ts:67`, `147–207`, `212–244`.

**Why:** Single place to attach observability, outcomes, and fail-fast request path.

**Why better:** Less duplication; easier to test; `publish()` behavior preserved except where outcomes surface via new APIs.

---

### `request()` error handling when publish fails

**What:** On publish failure during `request()`, pending waiter is cancelled (`cancelRequest`) instead of waiting full timeout.

**Where:** `src/core/bus.ts:231–243`, `src/core/request-response.ts:27–35`.

**Why:** Fail-fast and dedupe paths must not leave orphaned 5s timers.

**Why better:** Predictable latency; no unhandled rejection from abandoned `wait` promises (`void wait.catch` at line 242).

---

## Removed

| Item | Reason |
|------|--------|
| `mfe-platform-communication/EXAMPLE-USAGE.md` | Replaced by runnable `../examples/` workspace and `../examples/README.md` (FIX-06). Content was non-executable copy-paste only. |

---

## Documentation (repository root)

Not shipped in the npm package tarball (except package `README.md` sync), but part of this release:

| File | What changed |
|------|----------------|
| `README.md` | PoC status → RFC §1.5 link; security model; design summary; adapters; examples; issues 20–26 |
| `mfe-platform-communication/README.md` | Synced with root README |
| `platform-communication-rfc.md` | §1.5 Production Readiness Checklist; security; observability; TopicRegistry example; request trap warning; `getSnapshot` bootstrap; FIX-11–16 decisions |

**Why:** FIX-04, FIX-09, FIX-11–16 required governance and integrator-facing clarity without a separate “fixes” doc section.

---

## Dependency and workspace notes

| Change | Location |
|--------|----------|
| `tsx`, `zod-to-json-schema` (dev) | `package.json` devDependencies |
| Root `pnpm-workspace.yaml`, `package.json` | Monorepo for `examples` |
| `examples` devDeps: `webpack`, `playwright`, `concurrently`, … | `../examples/package.json` |

---

## Verification commands

```bash
cd mfe-platform-communication
pnpm test
pnpm test:coverage
pnpm lint
pnpm format:check
pnpm build
pnpm export:schemas

cd ../examples
NODE_ENV=production pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

---

## [0.1.4] - prior PoC

Initial public API: `createBus`, `createHostBridge`, framework adapters, Zod validation, dedupe (silent on `publish`), request/response by `causationId`, state sync on host, `TopicRegistry` without dedicated tests.

See [npm](https://www.npmjs.com/package/@lkovari/microfrontend-platform-communication) for published artifact history.
