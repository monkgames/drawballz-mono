---

# PATCH — Reduced Number Alphabet (Reachability Rebalance)

> **This patch reduces the number range used in ball definitions in order to make higher prize tiers practically reachable at human time scales, while explicitly requiring rebalancing to preserve RTP, volatility, and bankroll safety.**

All rules not explicitly modified below remain **unchanged and authoritative**.

---

## 1. What Changed (Summary)

### Modified

-   **Base number alphabet size** used in all ball definitions

### Purpose

-   Increase practical reachability of higher prize tiers (Tier 3+)
-   Reduce exponential sparsity caused by large number ranges
-   Improve player-perceived fairness without forcing outcomes

---

## 2. Section Modified

### ❌ Modifies:

-   **Base Mathematical Space**
-   **Ball Definition** (globally)

No other sections are directly altered by this patch.

---

## 3. Updated Ball Definition (Authoritative)

Each ball is uniquely defined as:

(number, color)

Where:

-   `number ∈ {0 … 9}`
-   `color ∈ {C1, C2, C3, C4, C5}`

This replaces the previous number range `{01 … 99}`.

All color-uniqueness constraints remain unchanged.

---

## 4. Mathematical Impact (Normative)

Reducing the number range from `0–99` to `0–9` reduces the number alphabet size from `99` to `10`.

### Exact Match Probability (Per Ball)

| Number Range | P(exact match) |
| ------------ | -------------- |
| 0–99         | `1 / 99`       |
| 0–9          | `1 / 10`       |

### Multi-Ball Impact

Exact multi-ball match probabilities scale as:

\[
P(m\ \text{matches}) \propto \left(\frac{1}{N}\right)^m
\]

Where `N` is the number alphabet size.

This change increases practical reachability by approximately:

| Matches (m) | Increase Factor |
| ----------- | --------------- |
| 1           | ~10×            |
| 2           | ~100×           |
| 3           | ~1,000×         |
| 4           | ~10,000×        |
| 5           | ~100,000×       |

This effect is intentional and necessary to prevent higher tiers from being effectively unreachable.

---

## 5. Mandatory Rebalancing Constraints (Critical)

Reducing the number alphabet **does not by itself guarantee fairness**.  
The following constraints MUST be enforced for any epoch using the reduced range.

---

### 5.1 EMS Weight Rebalancing (If Combinational Wins Are Enabled)

If **Effective Match Scoring (EMS)** is in effect:

-   Exact Match score remains **1.0**
-   Bonus Match scores MUST be reduced to prevent score inflation

Recommended bounds:

Number Bonus Match ∈ [0.15 … 0.20]
Color Bonus Match ∈ [0.15 … 0.20]

Exact matches always override bonus matches.

---

### 5.2 EMS Tier Threshold Recalibration (Mandatory)

All **EMS-to-Tier thresholds** MUST be recalibrated upward to reflect the denser match space.

Example (illustrative only):

| Tier   | Old Threshold | New Threshold |
| ------ | ------------- | ------------- |
| Tier 3 | ≥ 2.5         | ≥ 3.2         |
| Tier 4 | ≥ 3.5         | ≥ 4.1         |
| Tier 5 | ≥ 4.5         | ≥ 4.8         |

Thresholds must be validated via simulation before epoch launch.

---

### 5.3 Winning Mask Distribution Caps (Still Enforced)

Even with a reduced number range, the following caps remain mandatory:

-   `p₄` and `p₅` MUST remain tightly bounded
-   Jackpot-tier frequency must not increase materially without prize reduction

Reducing the number range does **not** relax distribution safety rules.

---

## 6. RTP & Volatility Implications (Clarified)

-   Reduced number range increases hit frequency across all tiers
-   RTP will increase **unless** prizes and/or thresholds are rebalanced
-   Volatility may increase if high tiers contribute excessive RTP

Therefore:

> **Any change to the number range requires a full simulation pass and RTP validation before epoch activation.**

---

## 7. Design Guarantees Preserved

This patch preserves:

-   Deterministic resolution
-   Auditability
-   No adaptive odds
-   No forced wins
-   Player-independent outcomes
-   Bounded epoch liability

Only the **density of the match space** is altered.

---

## 8. Player-Facing Clarification (Recommended)

> “The game uses a compact number range so that higher prizes are realistically attainable, while prize values and thresholds are balanced to keep play fair.”

---

## 9. Canonical Patch Summary

> **This patch reduces the number alphabet used in ball definitions to increase practical reachability of higher prize tiers, while mandating rebalancing of scoring weights, tier thresholds, and distribution caps to preserve fairness, RTP stability, and bankroll safety.**

---

**END OF PATCH**

---
