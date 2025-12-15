# BALL CUT — SIMPLE HIGH-RTP RULESET

### Deterministic Multiplayer Instant-Prize Game

**Status:** Canonical Minimal Ruleset  
**Goal:** High RTP (≈90–96%), Deterministic, Bank-Safe, Player-Simple

---

## 0. Core Principle

> **Score first. Cut later.**  
> Prizes are determined by **overlap with winning numbers**, not by survival after deletions.

All outcomes are deterministic. No system RNG is used after epoch publication.

---

## 1. Base Game Space (Invariant)

-   Numbers: **01–99**
-   Colors: **5** (`C1–C5`)
-   A ball is defined as `(number, color)`

---

## 2. Player Configuration (Invariant)

-   Each player selects **exactly 5 balls**
-   **One ball per color**
-   Duplicate colors are not allowed

Configuration format:
{ (n1,C1), (n2,C2), (n3,C3), (n4,C4), (n5,C5) }

Total configuration space:
99⁵

---

## 3. Epoch Setup (House)

For each epoch, the house pre-announces:

1. **Winning Number per Color**
2. **Prize Table**
3. **Epoch Budget**
4. **Optional Shared Bonus Rules**

Example winning set:
C1 → 17
C2 → 42
C3 → 09
C4 → 66
C5 → 88

All epoch parameters are fixed and public before play begins.

---

## 4. Match Structure

-   Format: **1v1 (PvP)**
-   PvE (AI) may be used for liquidity
-   Player stakes are fixed per match
-   No more than one payout per rule path

---

## 5. Primary Scoring (Prize-Relevant)

### Match Count Calculation

For each player:

m = number of colors where
player's chosen number == epoch winning number

Where:
0 ≤ m ≤ 5

This calculation is performed **before any PvP interaction**.

---

## 6. Individual Prize Table (Example)

| Matches (m) | Payout (× Bet) |
| ----------- | -------------- |
| 0           | 0×             |
| 1           | 0.2×           |
| 2           | 0.8×           |
| 3           | 2×             |
| 4           | 10×            |
| 5           | 50×            |

-   Exact multipliers are epoch-configurable
-   Table is tuned to achieve target RTP

---

## 7. PvP Ball Cut (Secondary, Non-Destructive)

After scoring is computed:

### Cancellation Rule

If both players selected the **same number in the same color**:

-   That color is **neutralized**
-   It does **not** count for either player

This rule:

-   Prevents collusion
-   Adds PvP tension
-   Does **not** reduce base RTP

---

## 8. Shared Bonus (Optional)

If **both players** achieve:
m ≥ 3

Then:

-   A **shared bonus pool** is unlocked
-   Bonus is split equally
-   Paid independently of individual prizes

Shared bonuses are capped per epoch.

---

## 9. Outcome Rules

-   Individual prizes are always evaluated first
-   PvP cancellations apply only to scoring, not eligibility
-   Shared bonuses are optional and additive
-   No double payouts within the same prize path

---

## 10. What Is Explicitly NOT Used

-   No secondary deletion loops
-   No remainder-based gating
-   No exact set equality checks
-   No blooper states
-   No hidden RNG
-   No uncapped jackpots

---

## 11. Determinism & Auditability

-   Same inputs always produce the same outputs
-   All winning numbers are pre-announced
-   Player choice is the only entropy source
-   Epoch budget caps worst-case liability

---

## 12. Player-Facing Explanation

> “Pick one number per color.  
> Match more winning numbers to win more.”

---

## 13. Final Verdict

✅ High and tunable RTP  
✅ Deterministic and auditable  
✅ Bank-safe  
✅ Simple to understand  
✅ Production-ready

---

**END OF RULESET — SIMPLE HIGH-RTP BALL CUT**
