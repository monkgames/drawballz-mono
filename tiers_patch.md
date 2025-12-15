---

# PATCH — Combinational Wins (Exact + Bonus Matching)

> **This patch modifies the prize-determination logic to make higher prize tiers practically reachable while preserving determinism, auditability, and capped liability.**

All rules not explicitly modified below remain **unchanged and authoritative**.

---

## 1. What Changed (Summary)

### Replaced

-   Prize determination based **only** on the count of exact matches `m = |R ∩ W|`

### Introduced

-   **Combinational Win Scoring**
-   **Bonus Matches** (partial alignment credit)
-   **Effective Match Score (EMS)**

Exact matching remains primary; bonus matching augments reachability.

---

## 2. Section Modified

### ❌ Modifies:

-   **Section 5 — Prize Determination Rule**
-   **Section 8 — RTP Definition (Updated, Clarified)**

No other sections are affected.

---

## 3. New Definitions (Authoritative)

Let:

-   `R` = remaining ball set after all cancellations
-   `W` = generated Winning Mask

Each ball in `R` is compared against balls in `W`.

---

### 3.1 Match Types

For any ball `b ∈ R` and any ball `w ∈ W`:

-   **Exact Match**

    -   Same number **and** same color
    -   Score = **1.0**

-   **Number Bonus Match**

    -   Same number, different color
    -   Score = **0.25**

-   **Color Bonus Match**

    -   Same color, different number
    -   Score = **0.25**

-   **No Match**
    -   Score = **0**

---

### 3.2 Match Resolution Constraint (Critical)

-   Each ball in `R` may contribute **at most once**
-   For each ball, the **highest applicable score** is used
-   Exact Match always overrides bonus matches

This prevents score inflation and double counting.

---

## 4. Effective Match Score (EMS)

The **Effective Match Score (EMS)** is defined as:

\[
\text{EMS} = \sum\_{b \in R} \max(\text{match score of } b)
\]

EMS is a deterministic scalar value derived solely from `R` and `W`.

---

## 5. Updated Prize Determination Rule

### Replacement Rule

The match outcome is determined **only** by the Effective Match Score (EMS), not by raw exact-match count.

### Tier Mapping

Each epoch MUST publish an **EMS-to-Prize Tier Mapping**.

Example structure:

| EMS Threshold | Prize Tier |
| ------------- | ---------- |
| EMS < 0.5     | No Prize   |
| EMS ≥ 0.5     | Tier 1     |
| EMS ≥ 1.5     | Tier 2     |
| EMS ≥ 2.5     | Tier 3     |
| EMS ≥ 3.5     | Tier 4     |
| EMS ≥ 4.5     | Tier 5     |

-   Thresholds are **monotonic**
-   Only the **highest satisfied tier** is awarded
-   Exactly **one prize** may be awarded per match

---

## 6. Fixed Prize Table (Unchanged, Reinterpreted)

The **Fixed Prize Table** remains unchanged in structure.

However:

-   Fixed prizes are now indexed by **Prize Tier**, not by raw exact-match count
-   Each Prize Tier maps to exactly one fixed prize value

---

## 7. Outcome Exclusivity (Still Enforced)

All prior outcome exclusivity invariants remain in force:

1. All cancellations complete before Winning Mask generation
2. Winning Mask is generated before scoring
3. EMS is computed deterministically
4. Only one prize tier may be awarded
5. No aggregation across matches
6. Maximum liability per epoch remains bounded and knowable

---

## 8. RTP Definition (Updated)

The expected RTP for an epoch is now defined as:

\[
\text{RTP} = \sum\_{t} \left[ P(t) \times \text{FixedPrize}(t) \right]
\]

Where:

-   `t` is a Prize Tier
-   `P(t)` is the probability that EMS falls within tier `t`
-   `FixedPrize(t)` is the published prize for that tier

`P(t)` emerges deterministically from:

-   the Winning Mask Distribution Table
-   combinatorial alignment of `R` and `W`
-   EMS threshold definitions

The operator does **not** directly set `P(t)`.

---

## 9. Design Guarantees Preserved

This patch preserves:

-   Deterministic resolution
-   No adaptive odds
-   No forced wins
-   No per-player bias
-   Bankroller safety
-   Auditability
-   Player-verifiable rules

The only change is **how alignment is scored**, not **how randomness or payouts are controlled**.

---

## 10. Player-Facing Summary (Updated)

> “After the cuts, the system reveals a winning pattern.  
> Exact matches matter most, but partial alignments also count.  
> The total alignment score decides which fixed prize you win.”

---

## 11. Canonical Patch Summary

> **This patch introduces combinational win scoring by allowing limited bonus credit for partial alignment (same number or same color), computing a deterministic Effective Match Score that maps to fixed prize tiers, making higher tiers practically reachable without compromising fairness or capped liability.**

---

**END OF PATCH**

---
