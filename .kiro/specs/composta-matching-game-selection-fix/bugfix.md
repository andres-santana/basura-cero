# Bugfix Requirements Document

## Introduction

The week-5 experiment mini-game "Composta si o no" is a tap-to-pair matching game
(`type: "relacionar"`) rendered on the public student challenge page `/alumno/reto`
through the `MiniGame` component (`src/components/students/mini-game.tsx`). The student
taps a card on the left and then its pair on the right; correct pairs are "matched" and
locked.

Students report that the game's visual state is confusing: after a left card is selected
and a correct right pair is matched, the already-matched pairs and the currently-selected
card all appear with the same green highlight. The screens look as if several answers stay
"selected" at the same time, because the component does not visually distinguish between
(a) the currently selected left card awaiting its pair, (b) correctly matched/locked pairs,
and (c) unselected cards.

The root cause is in the card styling logic in `MiniGame`: the "selected" state and the
"matched" state both resolve to colors from the same `emerald` green family
(`emerald-100`/`emerald-500` for selected vs `emerald-50`/`emerald-300` for matched), which
are too similar to read apart at a glance. The underlying selection/match data flow is
correct — `selectedLeft` is cleared on a successful match — but the states are not visually
separable, so matched and transient-selected cards look alike.

This fix targets only the visual state representation of the matching game. It does not
change the matching logic, scoring, or game data/seeds.

## Bug Analysis

### Current Behavior (Defect)

When playing the "relacionar" matching game, the visual highlight does not distinguish the
transient selection from locked matches.

1.1 WHEN a left card is selected and one or more pairs are already matched THEN the system renders the selected card and the matched cards in the same green highlight family, so multiple cards appear "selected" at once
1.2 WHEN a correct pair is matched THEN the system highlights the matched left and right cards with a green style that is visually indistinguishable from the active selection style
1.3 WHEN cards are matched versus merely selected THEN the system provides no clear visual difference (color, emphasis, or state treatment) between a locked/matched pair, the currently selected card, and an unselected card

### Expected Behavior (Correct)

2.1 WHEN a left card is selected and one or more pairs are already matched THEN the system SHALL visually present only the currently selected card as "active/selected" and present matched cards in a distinct "matched/locked" treatment
2.2 WHEN a correct pair is matched THEN the system SHALL display the matched left and right cards in a treatment that is clearly distinguishable from the active selection treatment
2.3 WHEN cards are in different states THEN the system SHALL make unselected, currently-selected, and matched/locked cards visually distinct from one another at a glance

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a left card is tapped THEN the system SHALL CONTINUE TO set it as the selected card and enable the right-side options for pairing
3.2 WHEN the selected left card is paired with its correct right option THEN the system SHALL CONTINUE TO lock that pair as matched and clear the current selection
3.3 WHEN the selected left card is paired with an incorrect right option THEN the system SHALL CONTINUE TO show the transient "wrong" feedback (red) and leave the pair unmatched
3.4 WHEN all pairs are matched THEN the system SHALL CONTINUE TO enable the "Terminar" action and award the game points on completion
3.5 WHEN "Reiniciar" is tapped THEN the system SHALL CONTINUE TO clear all matched pairs, the current selection, and any wrong-feedback state
3.6 WHEN interacting with cards via keyboard THEN the system SHALL CONTINUE TO be operable through the existing button-based controls

## Bug Condition and Properties

**Key definitions**
- **F**: the original `MiniGame` render/styling logic (before the fix)
- **F'**: the fixed `MiniGame` render/styling logic (after the fix)
- **Input X**: the game render state `{ pairs, selectedLeft, matched, wrong }`

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type GameRenderState   // { pairs, selectedLeft, matched, wrong }
  OUTPUT: boolean

  // Bug is observable whenever a card is actively selected while other pairs are
  // already matched, or whenever any pair is matched — because matched and selected
  // cards resolve to visually indistinguishable highlight styles.
  RETURN (X.selectedLeft != null AND count(X.matched) >= 1)
         OR count(X.matched) >= 1
END FUNCTION
```

### Property: Fix Checking

```pascal
// For every state that triggers the bug, matched cards and the selected card must be
// rendered with visually distinct treatments.
FOR ALL X WHERE isBugCondition(X) DO
  styles <- F'(X)
  ASSERT styleOf(selectedCard, styles) != styleOf(matchedCard, styles)
  ASSERT styleOf(matchedCard, styles) != styleOf(unselectedCard, styles)
  ASSERT styleOf(selectedCard, styles) != styleOf(unselectedCard, styles)
END FOR
```

### Property: Preservation Checking

```pascal
// For every state that does NOT trigger the bug (no matches yet, or no active selection
// with matches), the interactive behavior and outcomes are unchanged.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT behaviorOf(F(X)) = behaviorOf(F'(X))   // selection, matching, wrong feedback,
                                                // reset, finish, and points unchanged
END FOR
```
