# Composta Matching Game Selection Fix Bugfix Design

## Overview

The week-5 "Composta si o no" matching mini-game (`type: "relacionar"`) renders its cards
through the `MiniGame` component (`src/components/students/mini-game.tsx`). Students tap a
left card to select it, then tap its pair on the right to lock a match. Today the
currently-selected card and the already-matched/locked cards are both painted in nearly
identical shades of the emerald family, so several cards look "selected" at once and the
screen reads as confusing.

The data flow is already correct: `selectedLeft` is cleared on a successful match, matched
pairs are tracked in `matched`, and wrong answers flash red. The only defect is that the
*visual* state does not separate the three card states apart from one another.

The fix is intentionally small and confined to the Tailwind class logic in `MiniGame`. We
introduce three visually distinct treatments:

- **Unselected** — neutral (white / slate border), unchanged from today.
- **Active / selected** — one strong, saturated eco-green treatment (the only "live" card).
- **Matched / locked** — a clearly different "done" treatment: muted/greyed with the
  existing check icon, so it reads as completed rather than active.

No matching logic, scoring, game data/seeds, or component API changes.

## Glossary

- **Bug_Condition (C)**: The render state where at least one pair is matched (optionally
  with an active left selection), so matched cards and the selected card resolve to
  visually indistinguishable emerald highlights.
- **Property (P)**: In any bug-condition state the three card states — unselected,
  selected, matched — SHALL render with pairwise-distinct visual treatments.
- **Preservation**: All interactive behavior (selection, matching, wrong-answer feedback,
  Reiniciar, Terminar, points) and the component API remain unchanged.
- **MiniGame**: The React component in `src/components/students/mini-game.tsx` that renders
  the tap-to-pair game and holds `selectedLeft`, `matched`, and `wrong` state.
- **GameRenderState**: `{ pairs, selectedLeft, matched, wrong }` — the inputs that
  determine how each card is styled on a render.
- **Left card state**: Derived per left item as `isMatched` (`matched[p.left] !== undefined`)
  or `isSelected` (`selectedLeft === p.left`) or neither (unselected).
- **Right card state**: Derived per right option as `isUsed` (consumed by a match),
  `isWrong` (transient red feedback), or neither (available/disabled).

## Bug Details

### Bug Condition

The bug manifests whenever one or more pairs are matched (and especially while a left card
is also actively selected). In those states the "selected" classes
(`border-emerald-500 bg-emerald-100 text-emerald-900`) and the "matched" classes
(`border-emerald-300 bg-emerald-50 text-emerald-700`) are both emerald and too close in
value to tell apart at a glance, so matched cards look like they are still selected.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type GameRenderState   // { pairs, selectedLeft, matched, wrong }
  OUTPUT: boolean

  // Observable whenever any pair is matched, because matched cards and the
  // selected card resolve to visually indistinguishable emerald highlight styles;
  // most acute when a card is actively selected alongside existing matches.
  RETURN (X.selectedLeft != null AND count(X.matched) >= 1)
         OR count(X.matched) >= 1
END FUNCTION
```

### Examples

- **Selected + one match (left column)**: A student matches "Cáscara de plátano", then taps
  "Papel de aluminio" to select it. Expected: the matched card looks done/greyed and only
  "Papel de aluminio" looks active. Actual: both glow emerald and read as selected.
- **Two matches, nothing selected**: Two left cards are locked. Expected: both read as
  completed (muted + check). Actual: they still look like active emerald selections.
- **Right column after a match**: The matched right option shows emerald `bg-emerald-50`
  identical in feel to the active left card. Expected: it reads as locked/done, distinct
  from the active treatment.
- **Edge case — wrong answer during matches (unchanged)**: Tapping an incorrect right card
  flashes red (`border-red-400 bg-red-50 text-red-700`). This must remain visually
  distinct from both matched and selected and is not altered by the fix.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Tapping a left card SHALL continue to set `selectedLeft` and enable the right options.
- A correct pair SHALL continue to lock into `matched` and clear `selectedLeft`.
- A wrong pair SHALL continue to flash the transient red feedback and stay unmatched.
- "Terminar" SHALL continue to be enabled only when all pairs are matched and award points.
- "Reiniciar" SHALL continue to clear `matched`, `selectedLeft`, and `wrong`.
- Controls SHALL remain `<button>` elements with their existing `disabled` states, keeping
  keyboard operability intact.

**Scope:**
All inputs that do NOT involve the matched/selected card styling are completely unaffected
by this fix. This includes:
- The matching, scoring, and completion logic (`tryMatch`, `finish`, `reset`, `allMatched`).
- Game data, seeds, and the `MiniGameData` / `onComplete` component API.
- The transient wrong-answer red feedback and the "done"/celebration view.
- The disabled behavior of right options when no left card is selected.

## Hypothesized Root Cause

Based on the bug description and the code in `MiniGame`, the cause is purely in the
conditional `className` strings for the card buttons:

1. **Same color family for two different states**: The "selected" branch
   (`border-emerald-500 bg-emerald-100 text-emerald-900`) and the "matched" branch
   (`border-emerald-300 bg-emerald-50 text-emerald-700`) are both emerald and differ by
   only one or two shade steps — not enough contrast to distinguish active vs locked.

2. **Matched state lacks a "done" visual language**: Matched cards reuse an active-looking
   highlight instead of a muted/completed treatment, so "locked" never reads as finished
   despite the check icon already being present on the left column.

3. **Right column mirrors the same ambiguity**: The right option's `isUsed` branch uses the
   same emerald `*-50/*-300` as the left matched branch, so the ambiguity appears in both
   columns.

The data flow (`setSelectedLeft(null)` on match) is confirmed correct, so no state logic
change is required — only the styling branches.

## Correctness Properties

Property 1: Bug Condition - Matched, Selected, and Unselected Cards Are Visually Distinct

_For any_ render state where the bug condition holds (one or more pairs matched, with or
without an active left selection), the fixed `MiniGame` SHALL render the matched/locked
cards, the currently-selected card, and the unselected cards with pairwise-distinct visual
treatments (distinct border, background, and/or text styling) in both the left and right
columns, so each state is identifiable at a glance.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Interactive Behavior and API Unchanged

_For any_ render state where the bug condition does NOT hold (no pairs matched yet, or any
state reached through the unchanged interaction flow), the fixed `MiniGame` SHALL produce
the same behavior as the original — selection, matching, wrong-answer feedback, Reiniciar,
Terminar, point awarding, keyboard operability, and the `MiniGameData` / `onComplete` API
all unchanged.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix only edits the conditional
`className` strings for the two card buttons. State, handlers, and markup structure are
untouched.

**File**: `src/components/students/mini-game.tsx`

**Function**: `MiniGame` (the left-column `button` and right-column `button` class logic)

**Specific Changes**:

1. **Left column — three distinct treatments**: Replace the current left-card class ternary
   so each state is clearly separable:
   - **Matched/locked** → muted "done" treatment, e.g.
     `border-slate-200 bg-slate-100 text-slate-500` with reduced emphasis
     (`line-through`/`opacity` optional) alongside the already-rendered `CheckCircle2`.
   - **Selected/active** → one strong eco treatment, e.g.
     `border-eco-500 bg-eco-100 text-eco-700 ring-2 ring-eco-500` so the single live card
     stands out from everything else.
   - **Unselected** → neutral, unchanged:
     `border-slate-200 bg-white text-slate-700 hover:border-eco-500`.

2. **Right column — matched (used) gets the same "done" treatment**: Replace the `isUsed`
   branch to use the muted/greyed locked treatment
   (`border-slate-200 bg-slate-100 text-slate-500`), matching the left matched style so
   locked pairs look consistent across both columns and distinct from the active card.

3. **Preserve the wrong-answer branch**: Keep `isWrong` →
   `border-red-400 bg-red-50 text-red-700` exactly as-is; it already contrasts with the new
   matched/selected treatments.

4. **Use the project `eco` palette for the active treatment**: Prefer `eco-*` utilities
   (defined in `tailwind.config.ts`: `eco-50/100/500/700`) for the brand-green active state,
   consistent with the project's styling conventions, and reserve the neutral slate family
   for the locked/done state.

5. **No structural or logic edits**: Do not change `disabled` conditions, `onClick`
   handlers, the `CheckCircle2` placement, `tryMatch`, `finish`, `reset`, or `allMatched`.
   The check icon continues to signal matched state and now pairs with the muted treatment.

## Testing Strategy

### Validation Approach

Because there is no test suite configured (verify with `npm run lint` and `npm run build`),
validation is primarily visual/manual plus static checks. The approach still follows the
two phases: first observe the ambiguous states on the unfixed code, then confirm the three
states are distinct after the fix while interactive behavior is unchanged.

### Exploratory Bug Condition Checking

**Goal**: Surface the ambiguity on the UNFIXED code and confirm the root cause is the
styling branches (not the data flow). If selection/match state were actually wrong, we
would re-hypothesize.

**Test Plan**: Run the week-5 game on `/alumno/reto`, match one pair, then select another
left card, and inspect the rendered classes/colors in the three states.

**Test Cases**:
1. **Selected-with-match (left)**: Match one pair, select a different left card; observe
   both appear emerald and read as selected (will fail to distinguish on unfixed code).
2. **Multiple matches (left)**: Match two pairs with nothing selected; observe they still
   look active rather than done (will fail on unfixed code).
3. **Used option (right)**: Observe a matched right option uses emerald identical to active
   feel (will fail on unfixed code).
4. **Edge — wrong feedback coexisting with matches**: Tap a wrong right option while a pair
   is matched; confirm red feedback is already distinct (should pass; bounds the fix).

**Expected Counterexamples**:
- Selected and matched cards share emerald `*-100/*-500` vs `*-50/*-300` and are not
  separable at a glance.
- Possible causes: same color family for two states, no "done" language for matched, right
  column mirrors the same ambiguity.

### Fix Checking

**Goal**: Verify that for all bug-condition states the three card states render with
pairwise-distinct treatments.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  styles := MiniGame_fixed(X)
  ASSERT styleOf(selectedCard, styles)   != styleOf(matchedCard, styles)
  ASSERT styleOf(matchedCard, styles)    != styleOf(unselectedCard, styles)
  ASSERT styleOf(selectedCard, styles)   != styleOf(unselectedCard, styles)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all non-bug states (and all behavior generally) the fixed
component behaves exactly like the original.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT behaviorOf(MiniGame_original(X)) = behaviorOf(MiniGame_fixed(X))
END FOR
```

**Testing Approach**: Property-based testing would be the ideal mechanism (it generates
many render states across the input domain and catches edge cases a few manual checks
miss), and it is listed below as the recommended shape. Given no test runner is configured,
preservation is validated manually by exercising the full flow and by confirming the diff
only touches `className` strings.

**Test Plan**: Observe selection, matching, wrong feedback, Reiniciar, and Terminar on the
UNFIXED code, then confirm each still behaves identically after the fix.

**Test Cases**:
1. **Selection preservation**: Tapping a left card still selects it and enables right
   options — unchanged after fix.
2. **Match + clear preservation**: A correct pair still locks and clears `selectedLeft` —
   unchanged after fix.
3. **Wrong feedback preservation**: An incorrect pair still flashes red and stays unmatched
   — unchanged after fix.
4. **Reset/Finish preservation**: Reiniciar clears all state; Terminar enables only when
   all matched and awards points — unchanged after fix.

### Unit Tests

- Given a render state with one match and one active selection, assert the resolved class
  strings for selected vs matched vs unselected are mutually different (left column).
- Given a used right option, assert its class string differs from the active-selection
  treatment and from the wrong-feedback treatment (right column).
- Assert the matched branch still renders the `CheckCircle2` icon.

### Property-Based Tests

- Generate random `{ pairs, selectedLeft, matched }` states satisfying `isBugCondition` and
  assert pairwise-distinct treatments across the three left-column states and the
  used/available right-column states.
- Generate random non-bug states and assert the interactive outcomes (selection enabled,
  match locks + clears, wrong flashes, allMatched gating) are unchanged.

### Integration Tests

- Full week-5 flow on `/alumno/reto`: select → match → select-again, confirming only the
  active card stands out while matched pairs read as done, in both columns.
- Context flow: match all pairs, confirm "Terminar" enables and awards points; then
  Reiniciar and confirm all three visual states reset correctly.
- Confirm keyboard operation (tab/enter) through the buttons still drives the same
  selection and matching, with disabled matched/used cards skipped as before.
