---

# PATCH — Asymmetric Cancellation (Position-Aware)

> This patch introduces a two-step asymmetric cancellation process after symmetric exact cancellations and before Winning Mask evaluation. It is position-aware: comparisons are made per slot index on both sides.

---

## 1. Ordering

1. Symmetric exact cancellation (same number and same color) — both sides
2. Asymmetric color cancellation (position-aware) — one side
3. Asymmetric number cancellation (position-aware) — one side
4. Winning Mask generation and outcome evaluation

---

## 2. Asymmetric Color Cancellation (Step 1)

For each slot index `i` where both players have a ball:

- If the colors at index `i` are the same on both sides, cancel one side’s ball at that index.
- Side selection is deterministic and guided by the following color weights:
  - GREEN: 0.25
  - PINK: 0.50
  - ORANGE: 1.00
  - YELLOW: 1.25
  - BLUE: 1.50
- If weights are equal (same color), the side to cancel is chosen deterministically from the match seed.

This step is executed before any number-based asymmetric cancellations.

---

## 3. Asymmetric Number Cancellation (Step 2)

After Step 1:

- Identify all slot indices `i` where both sides still have a ball and the numbers at index `i` are equal.
- Among these, select the pair with the highest number value and cancel one side’s ball at that index.
- Side selection is deterministic from the match seed.

Exactly one cancellation is applied in this step if any qualifying pairs exist.

---

## 4. Determinism

- All side selections use deterministic pseudo-randomness derived from the epoch seed and match salt.
- Given the same inputs, outcomes are repeatable.

---

## 5. UI

- The client animates symmetric cancellations first.
- It then animates asymmetric color cancellation followed by asymmetric number cancellation.
- Animations use the same visual style as symmetric cancellations, with single-sided fades where applicable.

---

## 6. Invariants

- No additional deletions beyond the defined steps.
- Winning Mask is generated only after all cancellations complete.
- Outcome exclusivity and prize evaluation rules remain unchanged.

---
