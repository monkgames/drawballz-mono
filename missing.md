## 0. Summary

It consolidates:

-   Core game concept
-   Mathematical foundations
-   Cancellation mechanics
-   Multiplayer resolution
-   Prize logic
-   Odds interpretation
-   Bankroller safety
-   Edge cases
-   Anti-exploit safeguards
-   Operational constraints

## 2. Base Mathematical Space (Invariant)

These parameters NEVER change.

### 2.1 Ball Universe

-   Numbers: `01` to `99` (inclusive)
-   Colors: `5`
-   Each ball is uniquely identified by `(number, color)`

Total unique balls:
99 × 5 = 495

---

### 2.2 Player Configuration Space

-   Each player must select **exactly 5 distinct balls**
-   No duplicates allowed
-   Order is irrelevant (unordered set)

Total possible configurations:
C(495, 5)

This space defines:

-   Entropy
-   Difficulty
-   Rarity
-   Odds foundation

---

## 3. Epoch Model (Critical for Economics)

An **Epoch** is a fixed operational window.

### 3.1 Epoch Responsibilities

Before an epoch begins, the system MUST announce:

1. Prize sets (exact unordered ball sets)
2. Prize tiers (shared vs individual)
3. Maximum payout per tier
4. Total prize pool
5. Epoch end conditions
6. Rollover rules (if applicable)

### 3.2 Certainty Principle

> **All prizes payable in an epoch are known and bounded before the epoch starts.**

This guarantees:

-   Zero uncapped liability
-   Predictable bankroll exposure

---

## 4. Prize Sets (Final Prize Gate)

### 4.1 Absolute Rule

> **A prize is awarded ONLY if the remaining balls EXACTLY match one of the announced prize sets.**

This applies to:

-   Shared prizes
-   Individual prizes

### 4.2 Matching Rules

-   Matching is **unordered**
-   Matching requires **exact number + exact color**
-   Matching requires **exact set equality**
-   Ball count alone NEVER guarantees a prize

If a remaining set:

-   Has the right count
-   But is not on the prize list

➡ **No prize**

---

## 5. Match Structure

-   Match type: **1v1**
-   PvP is default
-   PvE (AI) may be used only to maintain liquidity
-   PvE obeys all the same rules
-   Only ONE payout source per match is allowed

---

## 6. Deterministic Match Flow

### Step 1 — Player Configuration

Each player submits:

-   A set of 5 distinct balls `(number, color)`

---

### Step 2 — Exact Ball Cancellation (Primary Cut)

Compare Player A and Player B:

If both players selected the **same ball**:

-   Same number
-   Same color

➡ That ball is cancelled from BOTH players.

Let:
RA = remaining balls of Player A
RB = remaining balls of Player B

---

### Step 3 — Number-Only Conflict Resolution (Secondary Cut)

Triggered when both players have remaining balls with the **same number**, regardless of color.

#### Resolution Order (strict, repeat until stable):

1. Player with the **higher remaining ball count** loses one instance of that number
2. If counts are equal:
    - Player with the **higher sum of remaining numbers** loses one instance
3. If still equal:
    - Use **deterministic RNG tie-breaker** (commit–reveal or hash-based)

Properties:

-   Each resolution strictly reduces `RA + RB`
-   Infinite loops are impossible
-   Final state is always reached

---

## 7. Outcome Evaluation (Strict Priority Order)

Evaluation happens ONLY after all cancellations fully resolve.

### 7.1 Shared Prize Evaluation (Highest Priority)

Compute:
TOTAL = RA + RB

If:
TOTAL ∈ {3, 5}
AND remaining balls EXACTLY match a shared prize set

➡ **Shared Prize**
➡ Prize is split according to epoch rules
➡ Match ends immediately

Shared prize ALWAYS overrides all other outcomes.

---

### 7.2 Blooper Evaluation

#### Ultra Blooper

RA == 0 AND RB == 0
➡ No prize

#### Close Blooper

RA == RB
AND RA ∈ {3, 5}
AND shared prize NOT triggered
➡ No prize
➡ Optional cosmetic / feedback only

Bloopers never pay.

---

### 7.3 Individual Prize Evaluation (Asymmetry Required)

A player wins individually if and ONLY if:

Remaining ∈ {1, 2, 4}
AND Remaining < Opponent Remaining
AND Remaining set EXACTLY matches an individual prize set

Rules:

-   Exactly ONE player may win
-   Ties NEVER result in individual payouts

---

### 7.4 No Result

If none of the above conditions are satisfied:
➡ No prize

---

## 8. Outcome Exclusivity Invariants (Non-Negotiable)

The system MUST enforce:

1. All cancellations complete before evaluation
2. Shared prize overrides all other outcomes
3. Individual prize requires strict asymmetry
4. Ties never pay individually
5. Only one shared tier may trigger
6. Only one payout source per match

These eliminate:

-   Double wins
-   Double payouts
-   Ambiguous states
-   Race conditions

---

## 9. Odds Definition (Correct Interpretation)

### 9.1 What Odds Are NOT

-   Not per-match probability
-   Not “1 in X chance to win this round”
-   Not RNG-based odds

---

### 9.2 What Odds ARE

> **Odds are defined by the rarity of prize sets inside the base combinatorial space.**

Let:

-   `Pk` = number of prize sets of size `k`

Then:
Odds(k) = Pk / C(495, k)

This formula:

-   Is mathematically correct
-   Is audit-safe
-   Is invariant to player behavior

Player interaction only changes **sampling bias**, not rarity.

---

## 10. Human RNG Model

-   System introduces NO randomness into outcomes
-   Players generate entropy through choices
-   Deterministic rules map interaction → terminal state

This is equivalent to:

-   Poker
-   Rock–Paper–Scissors
-   Competitive puzzle games

---

## 11. Bankroller Safety Guarantees

-   Fixed prize sets
-   Fixed prize caps
-   No progressive jackpots
-   No EV loops
-   No count farming
-   No multiplicative exposure

Worst-case loss per epoch is **known in advance**.

---

## 12. Identified Non-Math Risks & Mandatory Safeguards

### 12.1 Collusion Risk

Mitigation:

-   Randomized matchmaking
-   Rematch limits
-   Identical configuration caps

### 12.2 Prize-Set Reachability

Mitigation:

-   Generate prize sets from reachable simulations
-   Rotate cold prize sets

### 12.3 Player Herding

Mitigation:

-   Multiple prize sets per tier
-   Visual decoys

### 12.4 Bots

Mitigation:

-   Rate limiting
-   PvE insertion
-   Behavior monitoring

### 12.5 Communication Risk

Mitigation:

-   Never publish per-match odds
-   Always describe rarity & epoch-level frequency

---

## 13. What Is Explicitly NOT Broken

-   Odds manipulation
-   Double payouts
-   Infinite loops
-   Dominant strategies
-   RNG trust issues
-   Bankroll leakage
-   State ambiguity

---

## 14. Player-Facing One-Liner

> “We cancel matching balls. If what remains exactly matches a listed prize set, you win — alone or together.”

---

## 15. Final Mathematical Verdict

-   Combinatorially sound
-   Deterministic and auditable
-   Bankroller-safe
-   Exploit-resistant
-   Production-ready

---

## 16. Canonical Summary Sentence

> **Ball Cut uses player interaction to sample a fixed combinatorial space, awarding prizes only for exact matches against pre-announced sets, with all outcomes deterministic, exclusive, and capped.**

---

**END OF DOCUMENT — AUTHORITATIVE, COMPLETE, AND FINAL**
