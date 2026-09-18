---
description: ">"
---


# Bluebox OTel Instrumentation

You already know OpenTelemetry — this skill does not teach it. It carries the Bluebox
contract and the discipline that turns wiring into verified coverage.

## Inventory, plan, one question — then work

Levels: **1** traces; **2** traces + metrics; **3** traces + metrics + logs, with the
existing logger bridged.

Your first response is the plan the developer approves:

1. **Inventory.** Every service in `src/` (or the equivalent): language, and **telemetry
   today** — `none`; `sdk` (OTel packages in the manifest or a bootstrap file); `agent`
   (a zero-code agent in the image or start command); each with its exporter target,
   `collector:<name>` when `OTEL_EXPORTER_OTLP_ENDPOINT` points at a service of the same
   stack, `direct:<host>` otherwise. A OneAgent SDK is not telemetry: it emits nothing
   without a OneAgent, so it counts as `none (OneAgent SDK present)`, in scope. Read all of
   this from the Dockerfile, the compose/Helm entry, the manifest and the env — not from
   service source. Out of scope, one line of reason each: browser apps and browser-driving
   load tools (server-side OTel cannot see their work); off-the-shelf images this repo builds
   no code for (postgres, rabbitmq, nginx — a collector concern; an in-stack OpenTelemetry
   collector is the one exception: it stays in scope as the routing row of Hard rule 3);
   with a compose/Helm stack, services it never deploys; images the base image already shows unbuildable on
   this host. Only what the base image tells you up front is a skip; the same blocker met
   while building is `blocked` (Hard rule 12).
   **Runtime probe, in parallel.** With the first inventory read — not after it, it must not
   slow the plan — start one bounded probe for the container runtime the stack would run
   under, and read its result when you write the plan:
   ```bash
   sh -c 'for rt in podman docker nerdctl; do command -v "$rt" >/dev/null 2>&1 || continue; c=none; "$rt" compose version >/dev/null 2>&1 && c="$rt compose"; [ "$c" = none ] && "$rt-compose" version >/dev/null 2>&1 && c="$rt-compose"; d=down; "$rt" version --format "{{.Server.Version}}" >/dev/null 2>&1 && d=up; echo "$rt: daemon=$d compose=$c"; done; echo probe-done'
   ```
   Run it as its own tool call in the same message as the first inventory reads (that is the
   parallelism), passing the tool's timeout parameter as 30 s (Claude Code Bash: `timeout:
   30000`; the default is 120 s), and
   read its output when you write the plan. `command -v` and version calls only: never
   search the filesystem for a binary, never start a daemon or machine, never install
   anything (Hard rule 12); nothing is written, so the order rule below is untouched. Read
   the output as four states: the first line with `daemon=up` and a compose command is **the
   runtime** (the loop lists podman first: Bluebox prefers podman wherever both are
   installed), and its `compose=` value is `<compose>` everywhere this skill says so (`docker
   compose`, `podman compose`, `podman-compose`, `nerdctl compose`); `daemon=up
   compose=none` on every line is a runtime without compose — for a compose stack that is
   **no usable runtime**, say which plugin is missing; `daemon=down` on every line is **a
   runtime the user must start** (name the first line's runtime, podman when both are
   installed); no line at all is **no runtime**. A tool result
   reporting the timeout (partial output, no `probe-done` line) is a hung daemon: report
   that runtime as unresponsive and re-run the loop once without it. A stack that needs no runtime (a plain
   `make run`, `npm start`) reads the probe as informational.
2. **Plan, per in-scope service** — one table row, a table even for one service: language,
   recipe (zero-code agent, or SDK when nothing zero-code covers it, written as
   `<package> <version>` with the version resolved under Hard rule 9, e.g.
   `@opentelemetry/auto-instrumentations-node 0.80.0`), and the files that
   will change: the Dockerfile or start command, the deployment entry, for SDK recipes the
   bootstrap file and the request-handling files by name (`handlers*`, `routes*`,
   `controllers*`, the mux registration — span naming and log correlation change call
   sites there; a listed file left untouched is reported "listed, unchanged"), for level 3
   the logging configuration. Name files by convention, not by reading source. A service
   that already exports gets no second SDK or log bridge (Hard rule 3). Under the table: a
   per-runtime legend of what each level yields, and one line "Expected: about L–H min for
   N services; first telemetry shows at the end, verification is batched" — 11.5 min for
   the run plus per service .NET 0.9, Java 1.2, Go 2.7, Node 2.8, other 1.5 min (the
   benchmark's calibration), 0.7 of the per-service part at level 1 or 2, L and H at 0.8
   and 1.2 of the sum. Then one line from the probe: "Runtime: podman (daemon up, `podman
   compose`)", or "Runtime: <rt> found, daemon down — start it (<the detected runtime's own start step: `podman machine start`, Docker Desktop or `dockerd`, nerdctl's containerd VM>)
   before the run", or "Runtime: none found — this stack cannot be built or started on this
   host; wiring only". Shared files get their own line: compose/Helm and run instructions
   are edited; `.env.otel.bluebox-template` is read, never edited; `.gitignore` gains
   `.bluebox/`; `.bluebox/instrumentation-run.json` records each service as it finishes and
   `.bluebox/instrumentation-run.md` is its readable record; `docs/otel-instrumentation.md`
   is written only when the developer chooses "open a PR" at the end.
   The table plus the shared-files line is the allowlist the developer approves. A file the plan did
   not name gets its own question before you touch it; unattended, leave it and mark the
   service `blocked` (`other: edited since the plan` when it changed under you).
3. **One question.** Ask scope and depth together — the level (recommend 3 with a
   developer present; level 1 is the fast path) and the scope (default: all in-scope
   server-side services) — and, because the plan names the start command, the run:
   "Approve and run" approves the plan and the later start of the app for verification;
   "Approve, I start the app myself" approves the wiring only, and you ask again before
   starting anything. The Runtime line decides which options exist: with no usable runtime
   for a containerised stack, do not offer "Approve and run" — the question offers the
   wiring only, and the run and the verification are not proposed at all, not now and not
   after wiring (those services close `blocked`, `no_runtime — …`, with the commands in
   Next steps); with a runtime the user must start (daemon down), offer "Approve, I start the app
   myself" only, and re-run the probe before any start. With a question tool (`AskUserQuestion` in Claude Code) ask through
   it; keep the question text sparse — one status line, one compact line per item, the
   question — the details are in the printed plan. Without such a tool, ask in plain text
   and **stop and wait**. That pause is the consent gate: a dismissed or cancelled question
   is not an answer — stop and say what you would have done. Skip the question only when the
   user already chose, said not to ask, or no interactive user exists (a headless run):
   then the level is the one the request names, logs asked for means 3, otherwise **level
   2** (nobody consented to application logs leaving the environment), and you print the
   plan table plus one line "Taking level N: <why>" and continue.

**Order is fixed: inventory text, plan table, the question, then the first file change.**
A file created or edited before the table, or before the question was answered or skipped
for one of the reasons above, is a violation. Do not read service source before the
question either.

## Hard rules

1. **Never handle the ingest token, and never make a tool print it back.** Do not fetch,
   print, or write it anywhere; the app reads it from an env var or secret the user
   supplies (Bluebox Setup page). Validating configuration counts as printing: `<compose>
   config`, `env`, `printenv`, `cat` on a file that carries the token all put it in
   your recorded output. Validate with `<compose> config --quiet` (or `helm template`
   on values that hold no token) and filter header and token lines out of anything you
   must read. If a value does reach your output, say so and tell the user to rotate it.
2. **Config is external.** All transport via standard `OTEL_*` env vars — endpoint,
   headers, protocol, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`. Never hardcode
   endpoints, tokens or service names in code; never commit secrets; confirm env files
   holding real values are git-ignored.
3. **Zero-code first, and never twice.** Prefer the language's auto-instrumentation
   ([zero-code setup](https://opentelemetry.io/docs/zero-code/): Java agent, .NET
   auto-instr, `node --require` + auto-instrumentations, `opentelemetry-instrument`) and
   add code only where the runtime needs it (Go, C++, bespoke frameworks); before an SDK
   recipe, confirm in the [OTel registry](https://opentelemetry.io/ecosystem/registry/)
   that no library covers the framework, HTTP client and database driver, and name the
   reason in the recipe column. A service that already carries an SDK or agent gets
   neither a second one nor a second log bridge. When services export to an in-stack
   collector, the plan has one row for that collector — add a Bluebox `otlphttp` exporter
   (http/protobuf, the token from the environment only) to its existing pipelines with the
   `cumulativetodelta` processor on the metrics pipeline (ingest rejects cumulative series; the
   host-collection add-on below shows the processor), through the repo's
   extras/override config when it has one — and the routed services are "verification
   only" rows with no files. In the closing table the collector's row carries the state of
   the services it routes: `reporting` when they report, else `blocked` with their reason. A service exporting
   `direct:` to another backend gets an env-only change (endpoint, headers, protocol) and a
   note that the old backend stops receiving unless the user asks for dual export, which
   is a collector, not two exporters in the SDK. On Kubernetes, annotation-based injection
   is the zero-code recipe only where an `Instrumentation` resource the service can use
   **already exists** (`kubectl get instrumentations -A`; the CRD alone proves nothing, and
   the annotation silently no-ops without one) — reference it as `namespace/name` in the
   deployment entry; otherwise take the in-image recipe. Creating the `Instrumentation` or
   installing the Operator is a cluster change and never part of this run.
4. **Logs are additive.** Bridge the logger the service already uses (appender, hook,
   transport); sink, format, timestamps, timezone and levels stay byte-identical, or that
   service stays at level 2 and you say so. Before bridging, read what it logs: request or
   response bodies, credentials, tokens or personal data (names, emails, account
   identifiers) in the records keep it at level 2 — also a wrapper logger or dynamic fields
   you cannot read — even when the developer chose 3; name the service and the reason, and
   interactive, ask before bridging it so the developer can raise it knowingly. Three known
   traps, checked while wiring: .NET `ClearProviders()` discards the provider the
   auto-instrumentation injects — remove only the providers you replace; winston (v3+)
   exports nothing until `@opentelemetry/winston-transport` is installed, and the winston
   instrumentation then injects the transport itself into loggers created after it loads
   (`--require` order), so do not also attach `OpenTelemetryTransportV3` by hand; Go
   `otelhttp` (contrib v0.66+) re-applies its span-name formatter after the handler returns,
   so give the route at wrap time with `otelhttp.WithSpanNameFormatter` (or
   `otelhttp.WithRouteTag` per route) and set `http.route` there, never inside the handler.
5. **Identity attributes.** `vcs.repository.url.full` + `vcs.ref.head.revision` from
   build-time values (build-arg -> env; drop the pair when empty, never emit empties),
   `deployment.environment.name`, plus cloud resource attributes where a detector exists.
   This is what maps telemetry back to code and environment.
6. **Self-disabling.** With no `OTEL_EXPORTER_OTLP_ENDPOINT` set, every service behaves
   exactly as before instrumentation.
7. **Protocol is `http/protobuf`** (`OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`) — ingest
   rejects other OTLP transports — and **metrics use delta temporality**
   (`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta`). When code constructs an
   exporter itself the SDK picks the wire format from the package, not the variable: in
   Node, `@opentelemetry/exporter-trace-otlp-http` (and its `-metrics-` / `-logs-`
   siblings) send JSON and ingest answers **415** with nothing arriving — depend on the
   `*-otlp-proto` packages, or construct no exporter and let `@opentelemetry/sdk-node`
   choose from the variable; drop the `*-otlp-http` packages when you switch.
8. **The `Authorization` value comes from the Bluebox Setup page whole, scheme included.**
   Never compose it from a bare token: the scheme depends on the workspace's ingest-token
   kind (`Bearer` for a platform token `dt0s16…`, which is what Bluebox mints; `Api-Token`
   for a classic `dt0c01…`), and guessing it yields a 401 that reads like a bad token. The
   value contains a space, so quoting is consumer-specific: quote it in a shell or a `.env`
   the shell sources, leave it **unquoted** in a Docker `--env-file` or Compose `env_file`
   (both pass quotes into the header), and on gcloud use `--set-env-vars` with `^;^`
   delimiter syntax or a Secret Manager reference, never `--env-vars-file`.
9. **Build-verify every touched service** (compile/test with its normal command) before
   claiming it is wired; fix what you broke, then record the service before the next one.
   Never raise the service's language or runtime version — the `go` directive, `engines`,
   the target framework, the base image tag — to fit an instrumentation release: pin the
   newest instrumentation line that supports the version the repo declares, build in the
   matching image, and say in the plan which versions you pinned and why. Resolve that
   line from the package index at plan time (`npm view <pkg> version`, `pip index versions
   <pkg>`, the Maven or NuGet equivalent) and put the resolved number in the plan table;
   never pin a version from memory. Build or run in a container when the host gates its
   toolchains, and mount a named volume for the
   module or package cache so a repeated run never downloads twice (Go
   `-v bluebox-gomod:/go/pkg/mod`, Node `-v bluebox-npm:/root/.npm`, Maven
   `-v bluebox-m2:/root/.m2`, .NET `-v bluebox-nuget:/root/.nuget/packages`, Python
   `-v bluebox-pip:/root/.cache/pip`); create it if missing, never remove it.
10. **Narrate progress.** One line at each step boundary: inventory done, per-service
    wired, builds green, app started, verification started and its result. Dead air reads
    as a hang.
11. **Finish in one session.** Never end your turn while builds, traffic or verification
    are pending; poll to completion, verify, then report. In a non-interactive session,
    ending early IS the failure. Never wait through a background tool call — it ends your
    turn, and unattended there is no next turn: wait in the foreground with a bounded loop
    (`timeout 300 sh -c 'until curl -sf http://localhost:80/ >/dev/null; do sleep 5; done'`)
    and raise the tool's own timeout for a long command (`<compose> build`, a health
    wait, the batched `bluebox ask`; Claude Code's Bash `timeout`, up to 600000 ms). The
    only legitimate stops are the asks this skill mandates: the scope question, the run
    offer when the plan did not grant it, the header question of Workflow step 4, and the
    fresh-window offer after a blocked window.
12. **The host is not yours.** Change only the repository. On the host, build and start
    this repository's own services and stop what you started; never prune, delete, restart
    or reconfigure anything you did not create — docker images, containers, volumes,
    networks (no `prune`, no removal by filter, listing or age; only your own, by exact
    name), Kubernetes resources, packages, daemons, the docker VM. When the host blocks
    progress — disk full, a missing builder, the wrong architecture — say what blocks and
    what it would take, mark the affected services `blocked`, and continue with the rest.
    `blocked` is for what building revealed; what the Inventory read off the base image
    stays `skipped`. A missing or stopped container runtime is the host's state, not a
    puzzle: the Inventory probe is the only lookup you make. Never walk the filesystem,
    `/Applications` or `~/.docker` for a binary, never guess socket paths, never start a
    daemon or machine, never install one — name the command the user runs (`podman machine
    start`, open Docker Desktop, install one) and mark the services `blocked`
    (`no_runtime — …`).

## Workflow

1. Inventory, plan, and the one question (above).
2. Look at the environment first, without `env` or `printenv` (Hard rule 1): print the
   endpoint alone with `printf '%s\n' "$OTEL_EXPORTER_OTLP_ENDPOINT"` and test the header
   for presence only, always exiting 0 because absent is a supported state (a `<placeholder>` is absent):
   `case "$OTEL_EXPORTER_OTLP_HEADERS" in ""|*"<"*) echo "headers: absent";; *) echo "headers: set";; esac`. An
   endpoint already exported there (the workshop and CI path) IS the endpoint; use it
   as-is and read the CLI call below as informational only. Then open the run's journey with its first CLI call, from the
   repository root: `BLUEBOX_JOURNEY_TYPE=instrumentation bluebox otlp-endpoint` — the CLI mints one id
   for this run and every later `bluebox` call from this directory carries it; the variable
   goes on that one call only. Exit 0 printed the endpoint; exit 1 = the workspace is still
   provisioning — tell the user and continue wiring, do not poll; exit 2 = no observability
   connection yet — tell the user to connect one on the Setup page, continue wiring (the
   config is external) and treat verification as `blocked` on it unless an endpoint is
   already in the environment or the template. Then use the token-free
   `.env.otel.bluebox-template` at the repo root — `bluebox setup local-repos` generates it
   with the endpoint pre-filled (missing? put the endpoint the first call printed in the
   deployment entry; do not hand-write the template). Never rename it or write a bare
   `.env.otel` (CLI tests reject that path). The ingest token stays out of it, always.
3. Wire the selected services **one at a time**: wire, build-verify, record, then the next.
   Update the start command and deployment config (compose/Helm/process manager) with
   non-secret defaults only, the token only as a runtime env reference, and the run
   instructions the repo already has. The record write is part of finishing a service
   (recipe below), never paperwork for the end.
4. Tell the user to paste the whole `Authorization` value from the Bluebox Setup page —
   scheme included, per Hard rule 8 — into the env location you named; never ask to see it.
   Then gate the start on it. If step 2 printed `headers: absent` and that location is still
   empty — test presence without printing the value (Hard rule 1): the step-2 `case` for
   the shell,
   `grep -Eq '^OTEL_EXPORTER_OTLP_HEADERS="?Authorization=[^<"]*[^<"[:space:]]"?[[:space:]]*$' <file>`
   for an env file; empty, or a `<placeholder>` anywhere in the value, is absent on both
   paths — ask one question, "paste the whole `Authorization` value from the Setup
   page into `<location>`, then say done — or skip", and **stop and wait** under the same
   consent gate as the plan question: a dismissed or cancelled question is not an answer.
   On done, re-test before starting; still empty counts as skip. "Approve and run" granted
   the start, not a start without the header. On skip, or with no user present
   (headless), do not start the stack against Bluebox at all: take the no-token branch of
   the next section — a disposable local receiver, `blocked` (`no_token — a local receiver
   saw export`), and the exact verification command for later. Never start with an empty
   `OTEL_EXPORTER_OTLP_HEADERS` against the Bluebox endpoint: the 401 in the container logs
   reads like a bad token.
5. With the run granted (at the question, or by the offer in the next section) and the
   header present (or the endpoint pointed at the local receiver of the no-token branch):
   start the app once with its normal dev command, or `<compose> up --build` with the
   compose command the probe found — never a literal `docker` the probe did not list —
   adding for
   this verification start only the standard SDK export knobs so the first export does
   not wait a minute —
   `OTEL_METRIC_EXPORT_INTERVAL=10000 OTEL_BSP_SCHEDULE_DELAY=1000 OTEL_BLRP_SCHEDULE_DELAY=1000`
   (milliseconds; the committed run command keeps the SDK defaults). If the service's
   default port is already bound, start it on the next free `PORT` once and say so; do not
   investigate what holds the port. Drive one request per instrumented service (the repo's
   load generator or reverse-proxy routes when present) and record the window start.

## State and resume

An interrupted run must not start over. Once the question is answered, before any service
file changes, write `.bluebox/instrumentation-run.json` (`.bluebox/` git-ignored): the
revision (`git rev-parse HEAD`), the level, the scope, and one entry per planned service —
`status` (`planned`, `wired`, `blocked`, `skipped`), the files its plan row named as
repository-relative paths with the sha256 of their content after your edit, the `reason`
token of a `blocked` or `skipped` entry (the closing summary's reason set; empty
otherwise) and the detail the closing summary will carry:

```json
{"revision": "<git rev-parse HEAD>", "level": 3, "scope": "all",
 "services": [{"name": "pricing-service", "status": "planned",
               "files": [{"path": "src/pricing-service/main.go", "sha256": "..."}],
               "reason": "", "detail": ""}]}
```

Update one entry the moment that service's build-verify passes or it is marked `blocked`,
one call per service, and replace the file rather than writing over it — an interruption
inside an in-place write leaves the only record unreadable:

```bash
python3 - <<'PY'
import hashlib, json, os, pathlib
name, status = "pricing-service", "wired"
files = ["src/pricing-service/main.go", "src/pricing-service/Dockerfile"]
reason = ""   # a blocked/skipped entry: one token from the reason set, e.g. "build_failed"
detail = "zero-code Go SDK, logs bridged"
rec = pathlib.Path(".bluebox/instrumentation-run.json")
doc = json.loads(rec.read_text())
for svc in doc["services"]:
    if svc["name"] == name:
        svc["status"], svc["reason"], svc["detail"] = status, reason, detail
        svc["files"] = [{"path": f, "sha256": hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()}
                        for f in files]
tmp = rec.with_name(rec.name + ".new")          # same directory, so the replace is atomic
tmp.write_text(json.dumps(doc, indent=2))
os.replace(tmp, rec)   # a reader sees the old record or the new one, never a half-written one
PY
```

No secrets in it, ever. On start, read the file only if it parses, carries those fields and
every path is relative and inside the repository; anything else is stale — say so and start
fresh. Same revision, same scope and level, a service still `planned`: that is a resume —
say "resuming: N of M wired", print the plan table with each service's recorded status (a
`blocked`/`skipped` row as `reason — detail`), take the recorded level as the answer, and
continue from the first service not `wired` or `blocked`. Per named file of that service:
content matching the recorded hash is your finished edit; matching the revision is
untouched, wire it; anything else is the developer's own work — ask before touching it
(unattended: leave it, mark the service `blocked` with `other: edited since the plan`).
Nothing left `planned` is a finished run; a different scope, level or revision is not a
resume either: say what it records and ask whether to start over (unattended: start over
and say why). The developer removes the file when done; the closing summary names it under
next steps when anything is not `wired`.

**The readable record.** Next to the JSON, keep `.bluebox/instrumentation-run.md` for the
developer: header (repository, revision, started, a five-entry progress line Scan · Plan ·
Instrument · Verify · Handover, status); a decisions table (when, step, question, choice,
by whom — rescopes and retests included); then one section per step carrying the same
tables and lines as your step reports (inventory with telemetry today, approved plan and
prerequisites, files changed, verification table with window and attempts, handover with
run and re-verify commands, limitations, next steps), `_pending_` until reached — never
raw command output, never a header value, a token, a credential-bearing URL or customer
data (Hard rule 1 applies to this file as to your own output). Rewrite it whole at every
step boundary, temp file and rename, the last time after the final decision; plain
markdown. On "open a PR", copy it to `docs/otel-instrumentation.md` under the same
rule, commit it with the code, and use its handover section as the PR body.

## Run it, then verify — once, batched, honestly

Nothing can arrive from an app that never ran. If the question did not grant the run, offer
it after wiring and build-verify: name the start command from the inventory, say what it
will do — start the stack, send one request to each instrumented service (through the
reverse proxy where there is one), wait for the settle interval, verify once — and ask
before starting anything. One request per service is enough.

If the user declines, or no user is present and you cannot start the stack, stop there:
those services are `blocked`, their detail opening with `user_declined —` when the developer
declined, else with the one reason-set token that stopped you (`no_token`, `no_endpoint`,
`unbuildable_on_host`, …, or `other: <text>`) — never a bare sentence — followed by the
runnable command, secrets replaced by placeholders (`--env-file .env.otel`, `$DT_TOKEN`),
and next steps repeats it. Do not verify an app that is not running, and never report
`reporting` for a service you saw no signal from.

A containerised stack on a host whose probe found no usable runtime has no run and no
verification: skip this section, do not offer the run, do not go looking for a runtime
(Hard rule 12). Those services are `blocked` (`no_runtime — no docker, podman or nerdctl
daemon reachable; start or install one, then the plan's start command`), and Next steps carries
that start command plus the verification command. `build_failed` is for a build that ran.

Verification happens EXACTLY once, after all wiring and the traffic window. Build-verify
(Hard rule 9) is compile/test only; a local OTLP receiver is for the no-token case only, and
a service seen only there, or never exercised, is `blocked` (`no_token — no workspace; a
local receiver saw export`), never `reporting`.

Wait ~45 s after the traffic when the export knobs of Workflow step 5 are set and no logs
are in scope, ~90 s otherwise (the SDK exports metrics every 60 s without the knobs, and
log ingest lags spans regardless), then run ONE batched check covering every
selected service and only the signals the user selected, minus per-service drops under
Hard rule 4. The window runs from the traffic start to the moment you ask — never narrowed
to the burst: metric points are stamped at export time.

```bash
bluebox ask --env <env> "For the window <T1>..<now>: which of these services have <the
signals the user selected — e.g. spans, logs, and metrics> arriving — <service list>?
Count by OTLP service.name, not by entity. For metrics: FIRST list every metric key that
carries that service.name in the window (the catalog for that service - do not test guessed
key names or prefixes), then judge from that list; any key the app exported counts -
request, client-side (http.client.*), runtime, JVM - but list dt.* and other entity-derived
keys separately and do not count them: dt.service.request.count/failure_count/response_time
are derived from spans and exist for every service with inbound request spans. List
per-service signals, the metric keys seen, and the values of vcs.repository.url.full on
their spans."
```

Spans present but "metrics absent" is usually a verifier miss (outbound-only or batch
services have only client, runtime or JVM series). The one allowed follow-up ask, after one
more settle, names the expected keys for the missing services; what is still missing is
`blocked` (`verify_absent —` with the evidence you have); do not loop. Derived `dt.*` keys
never fill that gap: at level 2 or 3, a service with spans and only derived keys after the
follow-up is `blocked` (`verify_absent — only derived dt.service.* keys`), never
`reporting`. A `vcs.*` mismatch
is a warning when the signal arrived. No token or workspace? A disposable local receiver,
`blocked` (`no_token — a local receiver saw export`), and the exact verification command
for later.

Before finishing: scan tracked changes for secrets (`dt0c01.`/`dt0s16.` prefixes, real
`OTEL_EXPORTER_OTLP_HEADERS` values, userinfo-bearing URLs), then stop and remove what you
started. If the first window was blocked, offer the run again for a fresh one.

## Closing summary (fixed shape)

End the run with these three blocks, in this order, built from what the run actually saw —
nothing here that the run did not establish. One line first: "Time to first telemetry:
M min (expected L–H)", M from your first file change to the verification answer.

1. **One table, one row per service in the inventory** — every service you inventoried,
   in scope or not, exactly once, never grouped:

   | service | state | detail |
   |---|---|---|
   | pricing-service | reporting | traces, metrics, logs |
   | calculationservice | skipped | unbuildable_on_host — x86-only image, this host is arm64 |
   | problem-operator | skipped | out_of_scope — runs only under Kubernetes; the compose stack never deploys it |
   | cart | blocked | build_failed — `dotnet restore` NU1101 for OpenTelemetry.AutoInstrumentation; clears once the feed is in nuget.config |

   `reporting` means signals verified in-product, and the detail names which ones.
   `skipped` carries the census reason it was never in scope. `blocked` carries the
   concrete blocker and what would clear it. Those three words are the whole vocabulary:
   a service is in exactly one of them, and "configured", "done" or "partial" are not
   states — a service whose wiring you could not prove is `blocked`.

   The detail of every `skipped` or `blocked` row opens with exactly one reason token, then
   `—` and the concrete detail; a reason outside the set is written `other: <free text>`.
   Reason set:
   - `build_failed` — compile, test or image build failed after wiring; detail names the error
   - `unbuildable_on_host` — known from the base image before building (arch, platform)
   - `no_runtime` — the stack needs a container runtime and the Inventory probe found none
     usable (no docker/podman/nerdctl, or its daemon down); nothing was built or started
   - `port_busy` — the service could not bind its port and no free one was taken
   - `no_endpoint` — no OTLP endpoint was available (no template, `otlp-endpoint` exit 2)
   - `no_token` — no ingest token reachable by name; nothing could authenticate
   - `egress_blocked` — the app ran but exports could not leave the host/container network
   - `verify_absent` — the app ran and exported, the verification found nothing in the window
     (or only entity-derived `dt.*` keys)
   - `verify_unreadable` — the verification answered, but not in a form you could judge
   - `pii_withheld` — held below the chosen level because its records carry personal data
   - `already_instrumented` — exports OpenTelemetry already; nothing to add, only to route
   - `oneagent_sdk_inactive` — carries a OneAgent SDK that emits nothing without a OneAgent
   - `version_pinned` — held to an older instrumentation line by the repo's runtime version
   - `out_of_scope` — census reason (browser app, off-the-shelf image, never deployed)
   - `user_declined` — the developer kept it out at the question
   - `other: <free text>` — anything else; more than one in ten rows means a missing token
   The token is what gets counted across runs; the detail after it is for the reader. A
   `pii_withheld` or `version_pinned` hold on a `reporting` service goes in Limitations,
   opening the line with the same token.

2. **Limitations** — only what this run's facts support: a service that serves no inbound
   HTTP has no request metrics, infrastructure (databases, brokers, proxies) is not covered
   without a collector, a service kept at level 2 exports no logs and why. Do not list
   limitations you did not hit.

3. **Next steps** — what the developer does now: where to look in Bluebox, what to run to
   re-verify, and the one thing that would move a `blocked` service to `reporting`. When
   anything is blocked, this block names a command, because "blocked" without the thing to
   run is not an answer:

   > **Limitations**: `db` and `rabbitmq` are infrastructure and need a collector, which this
   > run did not add. Six services stay at level 2, so they export no logs.
   >
   > **Next steps**: open the environment view for `docker-compose`. To verify
   > problem-operator, deploy the chart to a cluster and re-run
   > `bluebox ask --env docker-compose "which services have spans arriving?"`.

Also state, once: the files you changed, the env vars the user must supply, and anything
that reached your own output that should not have — named without reproducing it ("the
ingest token was printed by `<compose> config`; rotate it"), never the value or a
fragment. Your final message is recorded and read by others.

For deeper query patterns load the **`production-query`** skill.

## Kubernetes cluster monitoring (only on request)

> **Scope: Bluebox-provisioned customer tenants only.** Applies to Kubernetes clusters in a customer workspace Bluebox provisions — no Dynatrace
> Operator, no ActiveGate. Does **not** apply to Bluebox's own EKS infrastructure (ADR-032: Dynatrace Operator + K8s-API-monitoring mode; rejects OTel
> K8s receivers there). If asked about Bluebox's own cluster, escalate.

Follow only when the user asks Bluebox to monitor a **Kubernetes cluster** (cluster/node/pod metrics and Kubernetes events), not when instrumenting a
single service. Cluster-side deployment, not repo-local SDK wiring, over the **same** OTLP endpoint and ingest token the main skill uses.

### What this gives Bluebox

- Node and pod resource metrics (CPU, memory, filesystem, network) from each node's kubelet.
- Cluster-level metrics and object state (nodes, pods, workloads, quotas).
- Kubernetes events (scheduling, restarts, OOMKills, evictions) as logs.
- `k8s.*` resource attributes on all of the above.

### Boundaries and gates

- **App instrumentation is unchanged.** Adds cluster/platform telemetry alongside per-service SDK instrumentation.
- **Cluster-scoped RBAC is privileged.** Needs a `ServiceAccount` + `ClusterRole` + `ClusterRoleBinding` with cluster-wide read on nodes, pods,
  events, workloads. Get explicit user approval before applying it; never apply cluster RBAC silently.
- **Same Bluebox ingest contract.** Hard rules 1, 7 and 8 apply unchanged; token lives in a Kubernetes `Secret` referenced by env.
- **Confirm the target.** Proceed only if the user runs Kubernetes and wants cluster monitoring; otherwise stay in the main skill.

### Prerequisites

- A running Kubernetes cluster and `kubectl` access with permission to create RBAC and workloads.
- The Bluebox OTLP endpoint — run `bluebox otlp-endpoint` if unknown (main skill: exit-code handling).
- The Bluebox `Authorization` header value, supplied by the user into a Kubernetes `Secret` (below) per Hard rules 1 and 8.
- The **OpenTelemetry Collector Contrib** distribution (or any build with the `k8s_cluster`, `kubelet_stats`, `k8s_events`, `otlp` receivers, the
  `k8sattributes`, `transform`, `filter`, `cumulativetodelta` processors, and `k8s_leader_elector`/`health_check` extensions). Prefer a
  vendor-neutral Contrib build; do not require a vendor operator.

### Topology

Deploy **one DaemonSet** of the Collector in agent mode:

- every pod runs `kubelet_stats` for **its own node** (needs `K8S_NODE_NAME` = `spec.nodeName`);
- the `k8s_leader_elector` extension elects a **single** pod to run the cluster-scoped receivers (`k8s_cluster`, `k8s_events`), avoiding duplication
  across nodes.

A split node/cluster deployment also works but adds moving parts; prefer the single DaemonSet unless the split is needed.

### Secret (user supplies the auth header)

Tell the user to create the Secret; do not create it with a real value yourself. Ask for the whole `Authorization` value the Setup page renders,
scheme included (Hard rule 8).

**Avoid `--from-literal` and `echo '<value>'` with a real credential** — both land in shell history and process arguments. Have the user type it into a hidden prompt, write it to a fresh `mktemp` file (mode 600), and delete it after:

```bash
# Hidden prompt: the value reaches neither history nor process arguments; mktemp
# creates a fresh mode-600 file (a pre-existing path could carry looser bits).
read -rs -p 'Authorization value: ' BLUEBOX_OTLP_AUTH; echo
f="$(mktemp)" && printf '%s' "$BLUEBOX_OTLP_AUTH" > "$f"
kubectl create secret generic bluebox-otlp \
  --namespace <ns> \
  --from-file=otlp-auth="$f"
rm -f "$f"; unset BLUEBOX_OTLP_AUTH f
```

### RBAC (privileged — get approval)

```yaml
apiVersion: v1
kind: ServiceAccount
metadata: { name: otelcol-bluebox, labels: { app: otelcol-bluebox } }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: otelcol-bluebox, labels: { app: otelcol-bluebox } }
rules:
  - apiGroups: [""]
    resources: [events, namespaces, namespaces/status, nodes, nodes/spec, nodes/stats,
                persistentvolumes, persistentvolumeclaims, pods, pods/status,
                replicationcontrollers, replicationcontrollers/status, resourcequotas, services]
    verbs: [get, list, watch]
  - apiGroups: [apps]
    resources: [daemonsets, deployments, replicasets, statefulsets]
    verbs: [get, list, watch]
  - apiGroups: [batch]
    resources: [jobs, cronjobs]
    verbs: [get, list, watch]
  - apiGroups: [autoscaling]
    resources: [horizontalpodautoscalers]
    verbs: [get, list, watch]
  - apiGroups: [coordination.k8s.io]
    resources: [leases]
    verbs: [get, list, watch, create, update, patch, delete]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: otelcol-bluebox, labels: { app: otelcol-bluebox } }
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: otelcol-bluebox }
subjects:
  - { kind: ServiceAccount, name: otelcol-bluebox, namespace: <ns> }
```

The `leases` write verbs are required by the leader-elector extension; the rest is cluster-wide read.

### Collector configuration

```yaml
extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  k8s_leader_elector:
    auth_type: serviceAccount
    lease_name: bluebox-k8smonitoring
    lease_namespace: ${env:POD_NAMESPACE}

receivers:
  k8sevents:
    auth_type: serviceAccount
    k8s_leader_elector: k8s_leader_elector
  kubeletstats:
    auth_type: serviceAccount
    collection_interval: 10s
    node: ${env:K8S_NODE_NAME}
    metric_groups: [node, pod, container, volume]
  k8s_cluster:
    auth_type: serviceAccount
    collection_interval: 10s
    k8s_leader_elector: k8s_leader_elector

processors:
  cumulativetodelta:
    max_staleness: 25h                    # keep above the collection/scrape interval
  filter:
    error_mode: ignore
  k8sattributes:
    extract:
      metadata: [k8s.pod.name, k8s.pod.uid, k8s.namespace.name, k8s.node.name,
                 k8s.deployment.name, k8s.replicaset.name, k8s.statefulset.name,
                 k8s.daemonset.name, k8s.job.name, k8s.cronjob.name, k8s.container.name]
  transform:
    error_mode: ignore
    metric_statements: &k8s_workload
      - context: resource
        statements:
          - set(attributes["k8s.cluster.name"], "${env:CLUSTER_NAME}")
    log_statements: *k8s_workload

exporters:
  otlphttp/bluebox:
    endpoint: ${env:BLUEBOX_OTLP_ENDPOINT}                       # from `bluebox otlp-endpoint`
    headers:
      Authorization: ${env:BLUEBOX_OTLP_AUTH}                    # whole header value incl. scheme; from the Secret, never inlined

service:
  extensions: [health_check, k8s_leader_elector]
  pipelines:
    metrics/node:
      receivers: [kubeletstats]
      processors: [filter, k8sattributes, transform, cumulativetodelta]
      exporters: [otlphttp/bluebox]
    metrics/cluster:
      receivers: [k8s_cluster]
      processors: [k8sattributes, transform, cumulativetodelta]
      exporters: [otlphttp/bluebox]
    logs/events:
      receivers: [k8sevents]
      processors: [transform]
      exporters: [otlphttp/bluebox]
```

Notes:

- Scrapes **cluster/node/pod telemetry only**, with **no `otlp` receiver and no `traces` pipeline**: app services keep exporting their own
  traces/metrics/logs **directly** to Bluebox (per the main skill); doesn't route app telemetry through the cluster collector. A shared in-cluster
  OTLP gateway is a separate decision outside this reference — do not add one here just to instrument apps.
- The exporter uses OTLP over `http/protobuf` to the Bluebox OTLP endpoint, same transport contract the app instrumentation uses.
- `k8s_events` is a maturing receiver; treat cluster events as best-effort, don't block the metrics pipelines on it.

### Required environment (Downward API + config)

Inject on the DaemonSet pod spec:

```yaml
env:
  - name: K8S_NODE_NAME
    valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
  - name: POD_NAMESPACE
    valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
  - name: CLUSTER_NAME
    value: "<a stable name for this cluster>"
  - name: BLUEBOX_OTLP_ENDPOINT
    value: "<bluebox otlp-endpoint output>"
  # Whole Authorization value, scheme included, as the Setup page renders it (Hard rule 8):
  # "Bearer <token>" for a platform token (dt0s16…), "Api-Token <token>" for a classic one (dt0c01…).
  - name: BLUEBOX_OTLP_AUTH
    valueFrom: { secretKeyRef: { name: bluebox-otlp, key: otlp-auth } }
```

Set the DaemonSet's `serviceAccountName: otelcol-bluebox`.

### Verify

- Apply RBAC (after approval), Secret, config, and the DaemonSet; confirm pods are `Running` and the `health_check` extension is healthy.
- Confirm the collector isn't erroring on export. A `401/403` is a secret/config issue, not code — the value isn't reaching the collector, or it
  carries the wrong scheme for the workspace's token kind; have the user re-copy it whole from the Setup page.
- Ask Bluebox whether cluster telemetry is arriving, e.g.:

  ```bash
  bluebox ask "are Kubernetes cluster or pod metrics and events arriving for cluster <CLUSTER_NAME> in the last 15 minutes?"
  ```

- Report per the closing summary's three states: no answer from `bluebox ask` means `blocked` (`verify_unreadable`), never verified.

### Declared criticality (Bluebox critical-components ranking)

Bluebox reads a service's declared criticality from the `primary_tags.criticality` span resource attribute (`high`/`medium`/`low`) — the OTel-native
signal for the `critical_components` enricher; without it a service ranks on derived fragility alone (replica deficit, resource pressure, restarts).

**How to set it — SDK-side (the only supported path with direct export):**

Set the resource attribute in the service's environment:

```bash
OTEL_RESOURCE_ATTRIBUTES="primary_tags.criticality=high"
```

Or in code (example: Go SDK):

```go
res := resource.NewWithAttributes(
    semconv.SchemaURL,
    attribute.String("primary_tags.criticality", "high"),
)
```

Bluebox queries `primary_tags.criticality` on **app spans**, not collector-scraped K8s metrics. Since app services here export directly to Bluebox,
not through the cluster collector, a `k8sattributes` processor there can't set this attribute — SDK-side is the only path that works.
`OTEL_RESOURCE_ATTRIBUTES` on each service is sufficient; Bluebox reads it from the first matching span.

### Report

Summarize: cluster targeted, that cluster-scoped RBAC was applied with the user's approval, signals configured (node metrics, cluster metrics,
events), that the ingest token stayed in a Kubernetes Secret and was never committed, and verification status (verified vs blocked).

## Host/Prometheus/log/datastore collection (only on request)

Follow only when the user wants Bluebox to ingest telemetry a service's own SDK doesn't emit — host metrics, an existing Prometheus `/metrics`
endpoint, log files, or datastore/middleware metrics (PostgreSQL, MySQL, Redis, …). A **Collector deployment**, not repo-local SDK wiring, shipped
over the **same** OTLP endpoint and ingest token the main skill already uses.

For Kubernetes cluster/node/pod telemetry, use the "Kubernetes cluster monitoring" section above — this is for host-level and app-adjacent collection
(a VM/host agent, a sidecar, or a small standalone collector), not cluster monitoring.

### What this gives Bluebox

- **`hostmetrics`** — host CPU, memory, disk, filesystem, network, and load from the collector's machine; the OTel path to host metrics without
  OneAgent.
- **`prometheus`** — scrape a service's existing Prometheus `/metrics` endpoint and forward it.
- **`filelog`** — tail app/container log files and ship them as OTLP logs, for services that write to files instead of emitting OTel logs.
- **datastore receivers** (`postgresql`, `mysql`, `redis`, …) — metrics from managed or self-hosted datastores and middleware.

### Boundaries and gates

- **App instrumentation is unchanged.** Adds host/scrape/log/datastore telemetry alongside per-service SDK instrumentation; app services keep
  exporting their own traces/metrics/logs directly to Bluebox.
- **Same Bluebox ingest contract.** Export to the Bluebox OTLP endpoint with the Bluebox ingest token — no separate credential, no extra scope. Token
  from env/secret store; never inline or commit it.
- **Cumulative metric series need delta conversion.** Bluebox rejects cumulative metrics. `prometheus` and datastore receivers are predominantly
  cumulative counters, so their pipelines **must** include `cumulativetodelta`. `hostmetrics` is a **mix**: gauges (e.g. memory/filesystem
  utilization) need no conversion; cumulative sums (e.g. `system.cpu.time`, `system.disk.io`, `system.network.io`) do. `cumulativetodelta` converts
  only cumulative sums and passes gauges through unchanged, so keep it on any pipeline with a cumulative source — don't call host metrics "all
  cumulative." Logs (`filelog`) need no conversion.
- **Datastore credentials are privileged.** `postgresql`/`mysql`/`redis` receivers need a monitoring user/password. Use a least-privilege monitoring
  account; source credentials from secret/env — never inline or commit them.
- **Confirm the target.** Only configure a receiver for a signal the user asked for and a source that actually exists (a real `/metrics` endpoint,
  real log paths, a reachable datastore). Do not speculatively enable receivers.

### Prerequisites

- A place to run the Collector: the host/VM being monitored (for `hostmetrics`/`filelog`), a sidecar, or a small standalone collector that can reach
  the scrape/datastore targets.
- The **OpenTelemetry Collector Contrib** distribution (or any build with the `hostmetrics`, `prometheus`, `filelog`, and datastore receivers plus the
  `cumulativetodelta` processor).
- The Bluebox OTLP endpoint — run `bluebox otlp-endpoint` if unknown (main skill: exit-code handling).
- The Bluebox ingest token, supplied by the user via env or a secret store. You never fetch, print, or commit it.

### Collector configuration

Enable only the receivers the user asked for; this example shows all four — drop the ones you don't need (and their pipeline entries).

```yaml
extensions:
  health_check:
    endpoint: 0.0.0.0:13133

receivers:
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu: {}
      memory: {}
      disk: {}
      filesystem: {}
      network: {}
      load: {}
  prometheus:
    config:
      scrape_configs:
        - job_name: app
          scrape_interval: 30s
          static_configs:
            - targets: ["127.0.0.1:9464"]         # the app's existing /metrics endpoint
  filelog:
    include: ["/var/log/app/*.log"]               # real log paths only; confirm no credentials or PII before enabling
    include_file_path: true
    # add operators here only if you must parse structured fields; preserve event timestamps
    # IMPORTANT: before enabling, confirm log content does not include credentials, tokens, or PII —
    # log files are shipped verbatim. If sensitive content may appear, disable this receiver for
    # that log path and use SDK-side log export (Hard rule 4) instead.
  postgresql:
    endpoint: ${env:POSTGRES_ENDPOINT}            # host:port
    username: ${env:POSTGRES_MONITOR_USER}
    password: ${env:POSTGRES_MONITOR_PASSWORD}
    tls:
      insecure: false

processors:
  resourcedetection:
    detectors: [env, system]                      # adds host.name and OS attributes
  cumulativetodelta:
    max_staleness: 25h                            # keep above the collection/scrape interval

exporters:
  otlphttp/bluebox:
    endpoint: ${env:BLUEBOX_OTLP_ENDPOINT}                     # from `bluebox otlp-endpoint`
    headers:
      Authorization: ${env:BLUEBOX_OTLP_AUTH}                 # whole header value incl. scheme; from env/secret, never inlined

service:
  extensions: [health_check]
  pipelines:
    metrics:
      receivers: [hostmetrics, prometheus, postgresql]
      processors: [resourcedetection, cumulativetodelta]
      exporters: [otlphttp/bluebox]
    logs:
      receivers: [filelog]
      processors: [resourcedetection]
      exporters: [otlphttp/bluebox]
```

Notes:

- The exporter uses OTLP over `http/protobuf` to the Bluebox OTLP endpoint, same transport contract app instrumentation already uses.
- Keep `cumulativetodelta` on any metrics pipeline carrying a cumulative source (`prometheus`, datastore receivers, the cumulative-sum series from
  `hostmetrics`). Without it Bluebox rejects those series and they silently don't appear; gauges are unaffected either way.
- Set a stable `service.name`/host identity so this telemetry lines up with instrumented services — e.g. via `resourcedetection` plus
  `OTEL_RESOURCE_ATTRIBUTES` on the collector, or a `transform` processor. Don't invent a name that conflicts with an existing service identity.
- Add datastore receivers (`mysql`, `redis`, …) the same way: a least-privilege monitoring credential from env/secret, routed through the
  `cumulativetodelta` metrics pipeline.

### Required environment

Provide the endpoint, auth header, and any datastore credentials via env/secret store — never inline:

```bash
export BLUEBOX_OTLP_ENDPOINT="<bluebox otlp-endpoint output>"
# The WHOLE Authorization value, scheme included, copied from the Bluebox Setup page (Hard rule 8):
# "Bearer <token>" for a platform token (dt0s16…), "Api-Token <token>" for a classic one (dt0c01…).
export BLUEBOX_OTLP_AUTH="<supplied by the user; keep out of tracked files>"
# only if a datastore receiver is enabled:
export POSTGRES_ENDPOINT="db-host:5432"
export POSTGRES_MONITOR_USER="<least-privilege monitoring user>"
export POSTGRES_MONITOR_PASSWORD="<from secret store>"
```

In Kubernetes, mount these from a `Secret` (as in the Kubernetes section above) rather than env literals.

### Verify

- Start the collector; confirm `health_check` is healthy and the collector isn't erroring on export (a `401/403` means the ingest token isn't reaching
  the collector — secret/config issue, not code).
- Ask Bluebox whether the new telemetry is arriving, e.g.:

  ```bash
  bluebox ask "are host CPU/memory metrics arriving for host <host> in the last 15 minutes?"
  bluebox ask "are metrics from the app /metrics scrape arriving in the last 15 minutes?"
  ```

- Report per the closing summary's three states: no answer from `bluebox ask` means `blocked` (`verify_unreadable`), never verified. Missing metrics:
  check `cumulativetodelta` first.

### Report

Summarize: which receivers were enabled and why, the sources they target (host, `/metrics` endpoint, log paths, datastore), that metrics pipelines
include `cumulativetodelta`, that credentials stayed in env/secret and were never committed, and verification status (verified vs blocked).

## AWS Lambda instrumentation (only on request)

Follow only when the user asks Bluebox to instrument an **AWS Lambda function**, not a normal long-running service. Still app-code instrumentation,
but its freeze/thaw lifecycle changes how telemetry must be exported, so the main skill's default SDK setup isn't enough alone. Ships to the **same**
Bluebox OTLP endpoint and ingest token the main skill already uses.

### Why Lambda is different

- **The runtime freezes between invocations.** The execution environment freezes almost immediately after the handler returns. A `BatchSpanProcessor`
  that flushes on a timer or on process exit will lose buffered spans, because the process is frozen, not exited.
- **Cold starts matter.** Instrumentation must be ready before the first invocation; export must not add unbounded response latency.
- **You usually do not control process shutdown.** "Flush on exit" isn't a reliable delivery mechanism here.

The fix is one of the two paths below — both guarantee spans flush before the environment freezes.

### Path A (recommended): AWS-managed OpenTelemetry Lambda layer

Add the AWS-managed OpenTelemetry Lambda layer (the `opentelemetry-lambda` / ADOT layer for the function's runtime). It provides auto-instrumentation
**and** an in-process Collector extension, and hooks the Lambda Telemetry API to flush on `runtimeDone` — the freeze-safe flush point.

Wiring:

- Attach the correct layer ARN for the function's runtime/region (pick the version from `open-telemetry/opentelemetry-lambda` releases; don't hardcode
  a stale ARN — look up the current one for the runtime/arch/region).
- Set the handler wrapper the layer documents (for example `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument` for Node.js/Python).
- By default the SDK exports to the layer's in-process Collector extension at `http://localhost:4318`, which forwards to the backend. To send to
  Bluebox, give the extension a Collector config exporting to the Bluebox OTLP endpoint:
  - Provide a custom Collector config file and point the layer at it with `OPENTELEMETRY_COLLECTOR_CONFIG_URI` (newer layers; local path such as
    `/var/task/collector.yaml` or a remote URI) or `OPENTELEMETRY_COLLECTOR_CONFIG_FILE` (older layers).
  - The exporter block uses the Bluebox OTLP endpoint and ingest token in the `Authorization` header (export contract below).

Minimal Collector config for the extension (ship to Bluebox):

```yaml
receivers:
  otlp:
    protocols:
      http:
      grpc:
processors:
  batch:
exporters:
  otlphttp:
    endpoint: ${env:BLUEBOX_OTLP_ENDPOINT}
    headers:
      Authorization: ${env:BLUEBOX_OTLP_AUTH}   # whole header value incl. scheme, from a secret-backed env var
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
```

### Path B: SDK exports directly to Bluebox (no bundled Collector)

If not using the layer's Collector extension (or wiring the SDK by hand), point the SDK exporter directly at Bluebox and make export freeze-safe:

- Set `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, `OTEL_EXPORTER_OTLP_ENDPOINT=<Bluebox OTLP endpoint>`, and
  `OTEL_EXPORTER_OTLP_HEADERS="Authorization=<value from the Bluebox Setup page>"` (secret-backed env var — never inlined). The scheme is part of that
  value and depends on the ingest-token kind; do not compose it here.
- Node.js: depend on `@opentelemetry/exporter-trace-otlp-proto` (and `-metrics-`/`-logs-` siblings), or let `@opentelemetry/sdk-node` pick an exporter
  from `OTEL_EXPORTER_OTLP_PROTOCOL`. A self-constructed `*-otlp-http` exporter ignores that env var and sends `Content-Type: application/json`, which
  ingest rejects with **415**.
- Do **not** rely on `BatchSpanProcessor` flush-on-exit. Call an explicit `forceFlush()` on the tracer/span processor before the handler returns, or
  use a Lambda-aware instrumentation wrapper that flushes on `runtimeDone`.
- Keep the exporter timeout well under the function timeout so a slow export can't hang the invocation.

Prefer Path A when the user just wants it to work; Path B is for functions with their own SDK bootstrap or that can't add a layer.

### Bluebox export contract (same as the main skill)

- Hard rules 1, 7 and 8 apply unchanged: `http/protobuf` to the Bluebox OTLP endpoint, delta temporality for metrics, the `Authorization` value whole
  as the Setup page shows it, held in a Lambda environment variable backed by a secret and never committed anywhere.

### Resource attributes for Lambda

Set service identity plus Lambda/cloud resource attributes so Bluebox lines the function up with the rest of your services:

- `service.name` — the logical service (via `OTEL_SERVICE_NAME`).
- `cloud.provider=aws`
- `cloud.platform=aws_lambda`
- `cloud.resource_id=<function ARN>` — the full `arn:aws:lambda:<region>:<account>:function:<name>`.
- `faas.name=<function name>` and `faas.version=<version or alias>`.

The layer sets several of these automatically; add any missing via `OTEL_RESOURCE_ATTRIBUTES`. Don't overwrite a correct auto-detected value with a
guessed one.

### Verify

Invoke the function to generate at least one known request, note the wall-clock time and `OTEL_SERVICE_NAME`, then verify through Bluebox:

```bash
bluebox ask --service <OTEL_SERVICE_NAME> --env <env> "are spans arriving for <function> around <recorded-test-time>?"
```

Report per the closing summary's three states: no token, no workspace, or no answer from `bluebox ask` means `blocked`
(`no_token`/`verify_unreadable`), never verified.

### Boundaries

- Does not set up cloud-provider managed-service monitoring, Lambda platform metrics from the provider, RUM, AppSec, or dashboards/alerts — it
  instruments the function's own traces (and, optionally and carefully, metrics/logs) to Bluebox.
- No observability-backend configuration is involved; everything flows through the Bluebox OTLP endpoint.