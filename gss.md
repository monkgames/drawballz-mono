# BALL CUT

### Deterministic Multiplayer Instant-Prize Game

**Authoritative Rules, Math, and Implementation Spec**

---

## 0. Executive Summary

**Ball Cut** is a deterministic, multiplayer comparison game inspired by FLAMES-style cancellation.  
It delivers **instant wins**, **pre-announced prizes**, and **fixed prize-per-epoch economics**, while replacing system RNG with **player interaction as the entropy source (“human RNG”)**.

-   No hidden draws
-   No per-ticket RNG
-   No uncapped liability
-   No double wins
-   No ambiguous states

All outcomes are derived from:

-   A fixed combinatorial space (**99 numbers × 5 colors**)
-   Deterministic cancellation rules
-   Exact matching against **pre-announced prize sets**

---

## 1. Core Design Goals

1. **Instant settlement**
2. **Pre-announced prizes**
3. **Certain, capped prizes per epoch**
4. **No KYC, Web3-friendly**
5. **Bankroller-safe**
6. **Human-driven randomness**
7. **Simple mental model (FLAMES-like)**

---

## 2. Base Mathematical Space (Unchanged Throughout)

-   Numbers: **01–99**
-   Colors: **5**
-   Total unique balls:  
    99 × 5 = 495
-   Each player configures **exactly 5 distinct balls**
-   Order never matters (unordered sets)

Total possible configurations per player:
C(495, 5)

This space defines:

-   Entropy
-   Difficulty
-   Rarity
-   Odds foundation

---

## 3. Epoch Model

An **Epoch** is a fixed operational window controlled by the house.

Each epoch pre-announces:

-   ✅ **Prize sets** (unordered ball sets)
-   ✅ **Prize tier mapping**
-   ✅ **Total prize pool**
-   ✅ **Max payouts**
-   ✅ **Rollover rules**

Players **see prizes in advance**, but cannot force outcomes.

---

## 4. Prize Sets (Critical Rule)

> **A prize is awarded ONLY if the remaining balls EXACTLY match one of the announced prize sets.**

-   Matching is **unordered**
-   Matching requires **number + color**
-   Remaining count alone **never guarantees a win**

This is the **final prize gate**.

---

## 5. Match Structure

-   Format: **1v1 (PvP)**
-   PvE (AI) may be used for liquidity but obeys the same rules.
-   Only **one payout source** per match is allowed.

---

## 6. Game Flow (Deterministic)

### Step 1 — Player Configuration

Each player selects:

-   5 distinct balls  
    `(number, color)`

---

### Step 2 — Exact Ball Cancellation (Primary Cut)

If Player A and Player B share a ball with:

-   Same number
-   Same color

➡ That ball is **cancelled from both players**

Let:
RA = remaining balls of Player A
RB = remaining balls of Player B

---

### Step 3 — Number-Only Conflict Resolution (Secondary Cut)

Triggered if both players have the **same number** remaining (color ignored).

Resolution order (repeat until stable):

1. Player with **higher remaining count** loses that number
2. If equal count → player with **higher sum of numbers** loses it
3. If still equal → **deterministic RNG tie-break**

This step always terminates because total remaining balls strictly decreases.

---

### Step 4 — Shared Prize Evaluation (Highest Priority)

Compute:
TOTAL = RA + RB

If:
TOTAL ∈ {3, 5}
AND remaining balls EXACTLY match a shared prize set

➡ **Shared Prize**
➡ Prize is split
➡ Match ends immediately

Shared prize always overrides all other outcomes.

---

### Step 5 — Blooper Evaluation

#### Ultra Blooper

RA == 0 AND RB == 0
➡ No prize

#### Close Blooper

RA == RB
AND RA ∈ {3, 5}
AND shared prize NOT triggered
➡ No prize (optional cosmetic feedback)

---

### Step 6 — Individual Prize Evaluation (Asymmetric Only)

A player may win **individually** if and only if:

Remaining ∈ {1, 2, 4}
AND Remaining < Opponent Remaining
AND Remaining set EXACTLY matches an individual prize set

-   Only **one player** can win individually
-   Ties never pay

---

### Step 7 — No Result

If none of the above conditions are met:
➡ No prize

---

## 7. Outcome Exclusivity Invariants (Non-Negotiable)

1. All cancellations must fully resolve before evaluation
2. Shared prize has absolute priority
3. Individual prize requires strict asymmetry
4. Ties never produce individual wins
5. Only one shared tier may trigger
6. Only one payout source per match

These rules eliminate:

-   Double wins
-   Double payouts
-   Ambiguity
-   Race conditions

---

## 8. Winning Odds (Correct Definition)

### Important Clarification

There are **no per-match “1 in X” odds**.

Instead, odds are defined as **rarity of prize sets in the combinatorial space**.

### Correct Formula (Per Tier)

Let:

-   `Pk` = number of prize sets of size `k`

Then:
Odds(k) = Pk / C(495, k)

This is:

-   Mathematically correct
-   Audit-safe
-   Independent of player behavior

Player interaction only affects **which subsets are sampled**, not the space itself.

---

## 9. Human RNG Model

-   Players act as the entropy source
-   The system does NOT generate randomness
-   Deterministic rules + human unpredictability = stochastic outcomes

This is equivalent (mathematically) to:

-   Poker
-   Rock–Paper–Scissors
-   Competitive puzzles

---

## 10. Bankroller Safety

-   Fixed prize sets
-   Fixed payouts
-   No jackpot multiplication
-   No count farming
-   No EV loops
-   Bounded liability per epoch

Worst-case loss is **known in advance**.

---

## 11. Identified Risks & Hardened Fixes

### NOT Math Bugs (but must be handled)

1. **Collusion**

    - Fix: matchmaking randomization, rematch limits

2. **Cold Prize Sets**

    - Fix: generate prize sets from reachable simulations

3. **Player Herding**

    - Fix: multiple prize sets, decoy visuals

4. **Bots**

    - Fix: rate limits, PvE injection

5. **Miscommunication**
    - Fix: never state per-match odds publicly

---

## 12. What Is Explicitly NOT Broken

-   ❌ Odds manipulation
-   ❌ Double payouts
-   ❌ Infinite loops
-   ❌ Count exploitation
-   ❌ RNG trust issues
-   ❌ Bankroll leakage

---

## 13. Player-Facing One-Liner

> “We cancel matching balls.  
> If what remains exactly matches a listed prize set, you win — alone or together.”

---

## 14. Final Mathematical Verdict

✅ Combinatorially sound  
✅ Deterministic and auditable  
✅ Bankroller-safe  
✅ No hidden edge cases  
✅ Production-ready

---

## 15. Canonical Summary Sentence

> **Ball Cut uses player interaction to sample a fixed combinatorial space, awarding prizes only for exact matches against pre-announced sets, with all outcomes deterministic and capped.**

---

**END OF SPEC — SINGLE SOURCE OF TRUTH**

**PATCH**

## Color Uniqueness & Configuration Constraint

-   Each player **must configure exactly five balls**, one from **each of the five available colors**.
-   **Duplicate colors are not allowed** within a player’s configuration.
-   Each ball is uniquely defined as `(number, color)`, where:
    -   `number ∈ {01 … 99}`
    -   `color ∈ {C1, C2, C3, C4, C5}`

### Mathematical Implications

-   Player configurations are drawn from the space:
    99^5

(one number choice per color)

-   Remaining-ball outcome spaces of size `k` are drawn from:
    C(5, k) × 99^k

-   All prize sets **must obey the same color-uniqueness rule**.
-   Any configuration or remaining set that violates color uniqueness is **invalid by definition** and cannot win.

> This rule is invariant and applies globally across all epochs, matches, prize sets, and evaluations.

---

# PATCH — Post-Resolution Winning Mask & Fixed-Prize Model

> **This patch introduces a controlled post-resolution winning mechanism while preserving all existing cancellation logic, color-uniqueness constraints, determinism of game flow, and bankroller safety guarantees.**

---

## 1. What Changed (High-Level)

### Replaced

-   **Pre-announced exact prize sets**

### Introduced

-   **Post-resolution Winning Mask**
-   **Winning Mask Distribution Table**
-   **Fixed Prize Table (non-multiplier-based)**

All other sections of the original specification remain **unchanged and authoritative** unless explicitly overridden below.

---

## 2. Section Replaced

### ❌ Replaces:

**Section 4 — Prize Sets (Critical Rule)**  
**Sections 4–6 prize evaluation logic that relies on pre-announced prize sets**

---

## 3. New Rule: Winning Mask Generation (Authoritative)

### Definition

After all cancellation steps are fully resolved (Steps 2 and 3), and the remaining ball set `R` is finalized, the system generates a **Winning Mask `W`**.

The Winning Mask is a color-unique unordered set of balls defined as:

-   Each ball is `(number, color)`
-   `number ∈ {01 … 99}`
-   `color ∈ {C1 … C5}`
-   No duplicate colors are allowed

---

### Winning Mask Size

Let `|W| = k`, where:

k ∈ {0, 1, 2, 3, 4, 5}

The value of `k` is selected according to a **Winning Mask Distribution Table** defined and published **before the epoch starts**.

---

### Winning Mask Sampling Rule (Deterministic Constraints)

Once `k` is selected:

1. Select `k` distinct colors uniformly from `{C1 … C5}`
2. For each selected color, choose one number uniformly from `{01 … 99}`
3. Construct `W` as the unordered set of these `(number, color)` balls

All valid masks of size `k` are equiprobable.

---

## 4. Winning Mask Distribution Table (New Epoch Parameter)

### Definition

Each epoch MUST publish a **Winning Mask Distribution Table** defining the probability of each possible mask size.

Example structure:

```json
{
  "maskSizeDistribution": {
    "0": p0,
    "1": p1,
    "2": p2,
    "3": p3,
    "4": p4,
    "5": p5
  }
}


---

## Winning Mask Distribution Table — Constraints

The Winning Mask Distribution Table MUST satisfy the following constraints:

-   **Normalization**
    \[
    \sum_{k=0}^{5} p_k = 1
    \]

-   **Non-negativity**
    \[
    p_k \ge 0 \quad \forall \; k \in \{0,1,2,3,4,5\}
    \]

-   **Immutability**
    The table is immutable for the entire duration of the epoch.

-   **Independence**
    The table is independent of:
    -   player identity
    -   match history
    -   individual outcomes
    -   remaining ball sets

This table defines **how often winning opportunities of each size may exist**,
**not who wins** any given match.

---

## 5. Prize Determination Rule (New)

Let:

-   `R` = remaining ball set after all cancellations are fully resolved
-   `W` = generated Winning Mask
-   `m = |R ∩ W|` = number of **exact matches** (same number **and** same color)

### Outcome Rule

The match outcome is determined **only** by the value of `m`.

-   No partial credit
-   No aggregation across matches
-   No multiple payouts

Exactly **one** outcome is evaluated per match.

---

## 6. Fixed Prize Table (New Epoch Parameter)

Each epoch MUST publish a **Fixed Prize Table** mapping exact match counts to **absolute prize values**.

### Example Structure

| Exact Matches (m) | Fixed Prize |
|------------------|-------------|
| 0 | 0 |
| 1 | Prize₁ |
| 2 | Prize₂ |
| 3 | Prize₃ |
| 4 | Prize₄ |
| 5 | Prize₅ |

### Fixed Prize Table Constraints

-   Prizes are **absolute values**, not multipliers
-   Prizes are **independent of stake size**
-   Only **one prize** may be awarded per match
-   The prize table is **immutable** for the duration of the epoch

---

## 7. Outcome Exclusivity (Unchanged and Enforced)

The following invariants remain fully enforced:

1.  All cancellations must complete **before** Winning Mask generation
2.  Only **one outcome** is evaluated per match
3.  Exact matching is required (number **and** color)
4.  No ties or overlaps produce multiple payouts
5.  Maximum liability per epoch is **bounded and knowable in advance**

---

## 8. RTP Definition (Updated and Clarified)

The expected Return to Player (RTP) for an epoch is defined as:

\[
\text{RTP} = \sum_{m=0}^{5} P(m) \times \text{FixedPrize}(m)
\]

Where:

-   `P(m)` is the probability of achieving exactly `m` matches
-   `FixedPrize(m)` is the published fixed prize for `m` matches

The probability `P(m)` **emerges deterministically** from:

-   the Winning Mask Distribution Table
-   the combinatorics of exact matching
-   the distribution of remaining ball set sizes

The operator does **not** directly set `P(m)`; it is implied by the published epoch parameters.

---
---

## 8. RTP Definition (Updated and Clarified)

The expected **Return to Player (RTP)** for an epoch is defined as:

\[
\text{RTP} = \sum_{m=0}^{5} \left[ P(m) \times \text{FixedPrize}(m) \right]
\]

Where:

-   `P(m)` is the probability of achieving exactly `m` exact matches
-   `FixedPrize(m)` is the published fixed prize for `m` matches

The probability `P(m)` is **not set directly** by the operator.
It emerges deterministically from:

-   the published **Winning Mask Distribution Table**
-   the combinatorics of exact number + color matching
-   the empirical distribution of remaining ball set sizes `R`

---

## 9. New Epoch Configuration Checklist (Mandatory)

Before an epoch starts, the operator **MUST** define and publish:

-   ✅ Winning Mask Distribution Table
-   ✅ Fixed Prize Table
-   ✅ Total prize pool cap
-   ✅ Maximum payouts per epoch
-   ✅ Epoch identifier or cryptographic commitment hash *(recommended)*

Once the epoch starts, **none of the above parameters may be altered**.

---

## 10. Player-Facing Summary (Updated)

> “After all matching balls are cut, the system reveals a winning pattern.
> The number of exact matches you have decides which fixed prize you win.”

---

## 11. Canonical Patch Summary

> **This patch replaces pre-announced exact prize sets with a post-resolution Winning Mask generated from a published distribution, awarding fixed prizes based solely on the number of exact matches, while preserving determinism, auditability, and capped liability.**

---

**END OF PATCH**

---
```
