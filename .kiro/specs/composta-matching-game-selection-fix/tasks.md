# Implementation Plan

- [x] 1. Observe the ambiguous card states on the UNFIXED code (bug condition check)
  - **Property 1: Bug Condition** - Matched, Selected, and Unselected Cards Are Visually Distinct
  - **CRITICAL**: This observation MUST surface the defect on the unfixed code - seeing the ambiguity confirms the bug exists
  - **DO NOT fix anything yet** - the goal is only to understand and document the root cause
  - **NOTE**: No test runner is configured, so this is a manual/visual observation that encodes the expected post-fix behavior
  - **GOAL**: Surface counterexamples that demonstrate matched vs selected vs unselected are not visually separable
  - **Scoped approach**: Reproduce the concrete bug-condition states on the week-5 "Composta si o no" game at `/alumno/reto`
  - In `src/components/students/mini-game.tsx`, inspect the left-column `className` ternary and confirm the selected branch (`border-emerald-500 bg-emerald-100 text-emerald-900`) and matched branch (`border-emerald-300 bg-emerald-50 text-emerald-700`) are both emerald and too close to distinguish (from Bug Condition in design)
  - Reproduce: match one pair, then select a different left card -> observe both read as "selected" (counterexample)
  - Reproduce: match two pairs with nothing selected -> observe they still look active rather than done (counterexample)
  - Reproduce: inspect the matched right option -> observe `isUsed` reuses the same emerald `*-50/*-300` as the left matched branch (counterexample)
  - Confirm the wrong-answer branch (`border-red-400 bg-red-50 text-red-700`) is already distinct and bounds the fix
  - **EXPECTED OUTCOME**: The three states are NOT pairwise-distinct on unfixed code (this is correct - it proves the bug exists)
  - Document counterexamples found to confirm the root cause is the styling branches, not the data flow
  - Mark complete when the ambiguous states are reproduced and documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Record baseline interactive behavior on the UNFIXED code (preservation check)
  - **Property 2: Preservation** - Interactive Behavior and API Unchanged
  - **IMPORTANT**: Follow observation-first methodology - record real behavior before changing anything
  - Observe: tapping a left card sets `selectedLeft` and enables the right options
  - Observe: a correct pair locks into `matched` and clears `selectedLeft`
  - Observe: a wrong pair flashes the transient red feedback and stays unmatched
  - Observe: "Terminar" is enabled only when all pairs are matched and awards points on completion
  - Observe: "Reiniciar" clears `matched`, `selectedLeft`, and `wrong`
  - Observe: cards remain keyboard-operable `<button>` elements with their existing `disabled` states
  - **EXPECTED OUTCOME**: All behaviors work as described (this confirms the baseline to preserve)
  - Mark complete when the full flow is exercised and the baseline behavior is recorded
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix the ambiguous card styling in MiniGame

  - [x] 3.1 Rework the conditional className strings for the card buttons
    - Edit only the left-column and right-column `className` ternaries in `src/components/students/mini-game.tsx`; leave state, handlers, markup, and `CheckCircle2` placement untouched
    - Left column - matched/locked: apply a muted "done" treatment using the neutral slate family, e.g. `border-slate-200 bg-slate-100 text-slate-500`, keeping the existing `CheckCircle2` icon
    - Left column - selected/active: apply one strong eco-green treatment with a ring, e.g. `border-eco-500 bg-eco-100 text-eco-700 ring-2 ring-eco-500`, so only the live card stands out
    - Left column - unselected: keep neutral, e.g. `border-slate-200 bg-white text-slate-700 hover:border-eco-500`
    - Right column - used (`isUsed`): apply the same muted/locked slate treatment as the left matched state so locked pairs read consistently across both columns
    - Preserve the wrong-answer branch exactly: `isWrong` -> `border-red-400 bg-red-50 text-red-700`
    - Prefer the project `eco-*` palette (`tailwind.config.ts`) for the active treatment and reserve slate for the locked/done state
    - _Bug_Condition: isBugCondition(X) = (X.selectedLeft != null AND count(X.matched) >= 1) OR count(X.matched) >= 1_
    - _Expected_Behavior: styleOf(selected) != styleOf(matched) != styleOf(unselected), pairwise-distinct in both columns_
    - _Preservation: no edits to disabled conditions, onClick handlers, tryMatch, finish, reset, allMatched, or the component API_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify the three card states are now visually distinct
    - **Property 1: Expected Behavior** - Matched, Selected, and Unselected Cards Are Visually Distinct
    - **IMPORTANT**: Re-check the SAME bug-condition states from task 1 - do NOT introduce new scenarios
    - Match one pair, then select a different left card -> only the active card shows the eco-green ring; the matched card reads as muted/done
    - Confirm matched, selected, and unselected cards use pairwise-distinct border/background/text in both the left and right columns
    - Confirm the matched branch still renders the `CheckCircle2` icon
    - **EXPECTED OUTCOME**: The three states are now distinguishable at a glance (confirms the bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify interactive behavior is unchanged
    - **Property 2: Preservation** - Interactive Behavior and API Unchanged
    - **IMPORTANT**: Re-exercise the SAME flow recorded in task 2 - do NOT change behavior
    - Confirm selection, matching + clear, wrong-answer red feedback, Reiniciar, Terminar gating, point awarding, and keyboard operability all behave as the recorded baseline
    - Confirm the diff touches only `className` strings (no logic, handler, markup, seed, or API changes)
    - **EXPECTED OUTCOME**: All behaviors match the baseline (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Verify the build and lint pass
  - Run `npm run lint` and confirm it passes with no new issues
  - Run `npm run build` and confirm a successful production build
  - Ask the user if any questions arise
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
