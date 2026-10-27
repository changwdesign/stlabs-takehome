# IT Ticket Management — Prototype

A mockup-only React prototype of an IT service-management ticket page, built around two
stories: **Grant, a 1Password admin, resolving `tkt-1` end to end** — and then **applying that
proven fix to the rest of the SSO rollout cohort in one run.**

**There is no backend and none is planned.** Everything renders from typed fixtures in
`src/data/`; execution state lives in memory in `src/state/` and resets on reload.

```bash
npm install
npm run dev      # http://localhost:5173
npm run typecheck
```

| Route        | What it is |
|--------------|------------|
| `/`          | Inbox shell — icon rail, filter bar, ticket list, ticket detail, SLA/workflow/cohort/Slack rail, chat dock |
| `/t/:id`     | The same shell deep-linked to a ticket |
| `/workflows` | Runs index (live + one seeded past run), workflows saved from resolutions, catalogue stub |
| `/workflows/runs/:id` | A bulk run: preflight → execution → exceptions → verification → close-out |
| `/kit`       | Component gallery — every primitive in every state plus the full token palette |

## Demo control

A hazard-yellow **DEMO** pill floats bottom-left on every page. It is presenter chrome, not
product UI — styled off-palette (`demo` tokens) so it can't be mistaken for either. It opens two
entries, and both reset all in-memory state (sessions, runs, arrivals, pending timers) and
remount the page first, so each walkthrough starts clean without a reload:

- **Resolve one ticket** → `/t/tkt-1`, unstarted. The click path below.
- **Bulk ticket processing** → `/bulk`: tkt-1 is fast-forwarded to Resolved through the real
  reducer, and the cohort panel opens. The bulk click path below, from step 13.

## The click path

1. `/` opens on `tkt-1`. One primary action: **Start resolving**. The rail's collapsed
   **Related tickets** header already says this is one of **8 tickets** from the SSO
   enforcement rollout; open it (or the **Show similar SSO tickets** chip) for the list and a
   **locked** "Resolve 7 together" that explains what unlocks it. Hover the **Requested by** pill
   for who filed it — reporting line, groups, devices — and click to pin the card open.
2. Before he takes it, the start card carries an **SLA review**: the policy row the targets
   came from, the clock as it reads now, and the agent's **suggested 4h resolution** with its
   reason. Changing a target needs a reason from a closed list, and Start stays disabled until
   he picks one. Until then the rail's SLA section points to the start card rather than
   repeating it; the same control reappears there under **Review targets** once the ticket is
   moving.
3. The plan is the agent's suggestion, so the chip row leads with **Modify plan**: drop a step
   you do not want, or tick **Require my approval** on one the agent would otherwise run
   unattended. Both are logged, and a pulled-back grant changes the primary action from *Run
   step 1* to *Review and run*.
4. **Start** → the targets commit with the acceptance (one activity entry, with the reason),
   and the header *and* the left list row flip to In progress; the plan goes live.
5. **Run step 1** (agent, auto — the Auto tag says it runs without approval) → the diagnosis
   comes back from the agent, not from reading prose: the profile email is `.io`, not `.com`.
6. Click another ticket and come back. Step 1 is still done. Sessions are keyed by ticket and
   nothing resets on navigation.
7. Step 2 is Grant's own — a checkbox, no Run button, because a person has to do it.
8. Step 3 is `confirm`: an inline gate naming the blast radius before the agent enrolls the
   account. No workflows exist for this fix yet — tkt-1 is solved step by step, and the
   workflow is saved from it later.
9. Step 4 drafts a public reply into the composer at the top of the **Activity** block. It is
   not finished until **Post**, which adds it to the log directly underneath.
10. Step 5 watches for a real IdP sign-in. Take the fallback instead and the ticket goes **On
   hold** with the resolution SLA shown as **Paused** and the nudge cadence spelled out.
11. Once step 5 verifies, the **resolve capture opens on its own** in the action card — no
   Resolve click, since the fix is already confirmed (**Not yet** closes it; **Resolve ticket**
   brings it back): cause pre-selected to the agent's diagnosis,
   actual-vs-target read-only — scored against the target in force, so the
   4h override shows up there — preventive-notice checkbox.
12. The card collapses to the resolution summary, the plan collapses to "5 of 5 complete", and
    the rail's bulk action **unlocks**: the workflow **built from this ticket's resolution** is
    pinned under the **Related tickets** header (visible even while the list is collapsed), with
    **Apply to 7 tickets** as the page's primary action. It opens the cohort panel. Cohort tickets
    show the same card ("Built from TKT-2583", "Running in run-1"), matching the provenance line
    in the panel and run page.

## The bulk click path (pass 2)

13. From resolved `tkt-1`, **Apply to 7 tickets** in the rail opens the cohort
    panel over the detail column — the same list, more columns. Escape or a click outside closes it.
14. The **pattern audit** comes first: step 2 was done by hand on tkt-1, so at scale it *needs
    input per ticket*. Below it: 4 ready and pre-checked (≥ 0.80), tkt-19 **owned by Sam**
    (request takeover → logged on tkt-19, still not in the set), tkt-20 and tkt-22 **excluded
    with reasons** (tkt-20 offers **Reply instead**, which opens it with the answer drafted), and
    tkt-23 collapsed under **Not included**.
    The workflow column opens with one line of provenance — **From TKT-2583 — resolved in 1h 12m,
    within the 2h target. Cause: …** — so it reads as one workflow run, not seven repeats. The
    run page opens the same way: cohort eyebrow, workflow name, the same provenance sentence,
    then the phase ("Dry run on 4 tickets", "Running on 4 tickets") and, once confirmed, a progress bar.
    The audit is a **proposed workflow**: **Modify workflow** lets you rename it, drop a step,
    or tick **Approve on each ticket** on an agent step (the batch confirm then stops covering
    it, and the run pauses for you on each ticket). The sparkle box at the bottom takes
    free-text **instructions for the agent**, which it follows and logs on every ticket in the run.
15. **Review & run** → `/workflows/runs/run-1` in **preflight**: the read-only dry run per ticket
    (Kai's profile email is `.io` — the run will pause there), the exact message each requester
    receives, and **one batch confirm** naming every account and device count it touches.
16. **Confirm** → items start as a staggered wave. **Open any ticket from the list** — it shows In
    progress, "Driven by run-1", and the same step rows advancing. Bulk is not a parallel
    universe: the run hands each ticket a `BULK_START` and then only *reads* its session.
17. Exceptions get the loud surface: **tkt-18 fails** (pending device approval). Retry fails
    again and says why; **Hand back to the ticket** returns it to the single-ticket flow, where
    Retry on the ticket itself succeeds. **tkt-17 pauses** at the manual email fix — tick it in
    the run (or on the ticket) and it carries on.
18. Nothing goes straight to Resolved. tkt-21 and tkt-17 verify by watching for a sign-in; tkt-16
    is a CI runner with nothing to watch, so it goes **on hold** asking Nora, SLA paused, with
    the nudge cadence — **Nora confirmed** closes it.
19. **Close-out**: actual vs. target per ticket, then two separate, separately confirmed
    outcomes — **notify the 34 not yet affected**, and **run this workflow on new matches**
    (named as a standing approval, enrollment included).
20. A few seconds after turning it on, **tkt-24** is filed, matched to the saved workflow, and run by
    the agent end to end — open it to watch. Nobody touches it.

## The three rules

**1. Never hardcode a color in a component.** Every color lives in the `@theme static` block in
`src/index.css` and is consumed as a Tailwind utility (`bg-canvas`, `text-step-done`,
`ring-p2/25`).

```bash
# Should return nothing but the Slack brand mark:
grep -rn "#[0-9a-fA-F]\{6\}" src/ --include=*.tsx
```

The `static` keyword matters — without it Tailwind v4 prunes any token not referenced by a
generated utility class, which silently breaks tokens read via `var(--color-*)`. A few step
tokens deliberately duplicate a status hex rather than referencing it: `var()` indirection
inside `@theme static` is fragile under that same pruning, so the value is repeated with the
source named in a comment.

**`KitPage.tsx`'s `tokenGroups` is a hand-maintained mirror of `index.css`.** Every new token
must be added there in the same commit. This is the easiest thing in the project to forget.

**2. Fixtures define the plan; session state owns the execution.** A step's actor, tool,
automation class and dependencies live in `src/data/`. Whether it has *run* lives in
`src/state/` and never touches `Ticket`. Blocked-ness is derived from `dependsOn` on every
read, never stored.

**3. Exactly one primary action per state.** `selectors.nextAction()` is a single pure function
returning the one descriptor the next-action card renders. If a second primary is ever needed,
the signature makes that visible instead of letting it creep in as JSX.

## Layout

```
src/
  index.css                  design tokens — the contract
  data/                      fixtures: the plan, not its execution
    types.ts                 Ticket, SuggestionStep, Automation, VerificationCheck, HoldSpec…
    tickets.ts               21 tickets; tkt-1 is the showcase, tkt-16…22 its cohort,
                             tkt-23 the deliberate near-miss; tkt-24 in `lateTickets`,
                             filed only once the resolution is saved as a workflow
    ssoPlan.ts               tkt-1's five-step plan stamped out per cohort ticket — same
                             step ids, so the run and the single-ticket flow are one machine
    patterns.ts              the resolution as a pattern: per-step scale verdict, exclusions
    runs.ts                  one seeded past run for the index
    users.ts                 10 people + the Agent pseudo-user
    workflows.ts             39 workflows, stable authored ids
    cohorts.ts               shared-cause groups + match threshold
    resolutions.ts           the closed vocabulary the resolve form captures against
  state/                     execution: useReducer + context, provider above the router
    types.ts                 PhaseKey, StepRunState, TicketSession, the action union
    reducer.ts               pure; takes the ticket as an argument
    selectors.ts             nextAction, blocked-ness, cohort view, merged activity
    runs.ts                  root state: sessions + runs; candidates; derived item/run status
    SessionProvider.tsx      the fake-async timer engine (steps, checks, run stagger, arrival)
    viewer.ts                ViewerRole, CURRENT_USER, roleFor
    config.ts                DEMO_SPEED — slow every agent run down for a walkthrough
  components/
    ui/                      Avatar, badges, Button, Pill, Collapsible, SearchInput, RichText,
                             Segmented, TextArea, Checkbox, Spinner, StepProgress, Field, Note
    layout/                  IconSidebar, FilterBar, TicketList, ChatDock
    rail/                    RightRail, CohortSection (related rows + bulk lock)
    cohort/                  CohortPanel (the repo's one overlay), PatternAudit, CandidateRow
    run/                     PreflightPanel, RunProgressList, ExceptionsList,
                             VerificationWatchList, RunCloseout, RunBadges
    ticket/                  TicketHeader, NextActionRegion, SummaryBlock, ResolutionPlan,
                             StepRow, StepActorTag, panels, ResolveForm, WorkflowSection,
                             RequesterCard (header hover/pin card), ActivitySection
                             (composer + log), UpdateComposer, ActivityTimeline, TicketDetail
  pages/                     InboxPage, WorkflowsPage, RunPage, KitPage
```

### Composition order in the detail

```
TicketHeader         ← status, priority, queue, assignee, requester (hover/click card)
SummaryBlock         ← what happened, always on top
driver note          ← only while a run or saved workflow is driving the ticket
NextActionRegion     ← one window:  step in hand
                     ├─ divider ──────────────────
                     └─ ResolutionPlan (the whole path) + agent chips
ActivitySection      ← one block:   UpdateComposer
                     ├─ divider ──────────────────
                     └─ ActivityTimeline

RightRail (sticky, scrolls on its own when taller than the viewport)
  SLA                ← points to the start card until the ticket is started
  Workflow           ← catalogue search
  Related tickets    ← built-workflow card pinned under the header; list collapsed
  Slack thread                       (collapsed)
  Followers
```

The main column holds the work; the rail holds context. Workflow moved to the rail so the
action path sits higher, and the composer and log became one block so an update is written
directly above where it lands.

The summary sits above the action: you read what happened before you are told what to do about
it. The step in hand and the path it belongs to are **one window split by a divider** — two
cards asked twice for the same attention, and the top half's tint is what separates "now" from
"the rest". The plan is passed to `NextActionRegion` as `plan` and rendered with
`embedded`, which drops its own card chrome so the window's border is the only one.

The resolve form expands *inside* `NextActionRegion`, so capture happens where the primary
action already was — no modal, no scroll hunt. Once all five steps are done, the lower half
collapses in place to a `5 of 5 complete` band.

### Fake async

`RUN_STEP` sets a step to `running`; the **Provider** owns a keyed `Map` of timers and a single
effect that starts one `setTimeout` per running step. `COMPLETE_STEP` and `VERIFICATION_PASSED`
are **no-ops unless** the state is still `running` / `watching`, so a timeout that outlived its
step cannot advance anything. Timers live in the provider, which never unmounts — a run started
before a ticket switch finishes in the background, which is the honest behavior for an agent
executing server-side.

### Bulk runs

A run stores almost nothing: which tickets, whether each has been started or handed back, and
its preflight/confirmed/cancelled phase. Item state (`queued · running · needs_input · failed ·
awaiting_verification · resolved · skipped`) and run status (`running · awaiting_verification ·
completed · completed_with_exceptions`) are **derived from the ticket sessions** in
`state/runs.ts`, the same way blocked-ness is derived from `dependsOn`. The batch confirm becomes
`preApproved` gates on each session: a pre-approved confirm step starts like an Auto one, and a
pre-approved draft posts as written because it was read at preflight. A ticket a run is driving
resolves itself once every step — verification included — has settled.

Failures are authored (`SuggestionStep.fault`), not random, so the demo is repeatable.

### Adding things

- **A priority or status:** one entry in the semantic map in `src/components/ui/badges.tsx`,
  one token pair in `src/index.css`, one line in `KitPage`'s `tokenGroups`. No new component.
- **A workflow:** one row in `src/data/workflows.ts` with an authored id. The "N available"
  counter derives from the list.
- **A plan step:** one object in the ticket's `suggestion.steps` with an `id`, an `actor`, a
  `tool` and an `automation`. Dependencies reference other step ids. Nothing in `src/state/`
  needs to change.
- **Rich text:** fixtures describe text as segments (`text`, `strong`, `code`, `link`) rendered
  by `RichText`, so fixture authors never touch JSX.

## Known scope limits

- **In-memory only.** Reload resets every session. Sessions survive ticket switching, not a
  refresh.
- **There are no clocks.** `age: '1d'`, `'2d ago'`, `'1h 12m'` are all authored strings.
  Time-to-resolve and actual-vs-SLA are fixture values, not computations, and a paused SLA is
  *depicted* — there is nothing counting down to stop.
- **Bulk is one cohort, one pattern.** Candidate thresholds (0.80 pre-checked, 0.50 list floor)
  live on the cohort; readiness reasons and exclusions are authored on the pattern. Takeover
  requests are logged but never granted — there is no Sam to say yes.
- **Saved workflows can't be revoked or edited** from the UI, despite the copy saying so.
- Reloading on `/workflows/runs/:id` loses the run, like every other session.
- **`closed` and `cancelled` are typed and in `/kit` but have no entry point.** Same for
  Reopened and escalation. The only failure paths are the authored ones in the bulk run (a
  failed step, a step that needs a person, a requester who has to confirm).
- **Role-awareness is by construction, not by screen.** `roleFor()` decides whether an
  affordance renders; no requester page is designed this pass.
- Sidebar destinations other than Tickets, Workflows and the kit redirect to `/`.
- Dropdown pills, Regenerate, attachments and the chat dock remain visual only.
- `Unassigned` filters on P1 as a stand-in, since fixtures have no unassigned state.
