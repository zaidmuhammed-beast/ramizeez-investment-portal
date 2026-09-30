# 4. Investor portal & idea protection

## 4.1 What investors see: budget-based matching

An investor sees a pitch only when **all** of these are true:
- The pitch's **minimum ticket ≤ the investor's verified budget** (not the declared budget)
- The pitch's sector, stage, city and deal type match the investor's preferences (the investor can widen these)
- If the investor requires Shariah-compliant deals, the deal structure is Shariah-compliant
- The investor has no conflict of interest with the founder (for example, a competitor in the same business)

Pitches are ranked by fit score and by RamiZeeZ's screening score.

## 4.2 Staged disclosure (the main anti-copy mechanism)

An investor never sees the full idea at once. Each level requires more commitment:

| Level | What the investor sees | Requirement |
|-------|------------------------|-------------|
| **L1: Blind teaser** | Sector, city, stage, amount asked, minimum ticket, deal type, a short **non-revealing** summary, key metrics (revenue band, growth band), RamiZeeZ score. **No business name, founder name or "secret sauce".** | Investor at Tier 3 |
| **L2: Summary** | Problem, general solution, market, team background (anonymised), high-level financials | Investor e-signs a **deal-specific NDA** + non-circumvention agreement |
| **L3: Full data room** | The full proposal, costing, roadmap, financials, documents, founder identity | Tier 4 investor, **founder or RamiZeeZ approves** the request, and the investor shows serious intent (for example a written expression of interest or a refundable commitment deposit) |
| **L4: Live Tank** | A live pitch session and Q&A with the founder, moderated by RamiZeeZ | Invited by RamiZeeZ |

Founders can mark specific fields as **"L3 only"** or **"reveal in live session only"**. Examples: a recipe, a supplier, a proprietary process.

## 4.3 Technical protections

- **No downloads**: documents open only in a secure in-browser viewer.
- **Dynamic watermark** on every page and video frame, showing the investor's name, ID and timestamp. A leaked screenshot can be traced back to the investor.
- Copy, paste, right-click and print are disabled in the viewer.
- **Full access logging**: which investor opened which pitch and page, when, and for how long. Founders can see an anonymised version ("3 investors viewed your financials").
- **Unlock limits**: each investor has a monthly quota of L2/L3 unlocks, based on their tier.
- **Behaviour flags**: an investor who unlocks many pitches in one sector but never makes an offer is flagged for review.
- **Proof of authorship**: at submission, the system stores a cryptographic hash and timestamp of the full pitch. This is evidence of who had the idea first if there is ever a dispute.
- **No direct contact** before a signed agreement. All messages go through the platform. Phone numbers, emails and links are detected and blocked in messages.

> **Being honest:** software cannot fully stop someone from remembering an idea or photographing a screen. So protection combines **deterrence** (watermarks, logging, limits), **legal force** (NDA, non-circumvention, penalties in the platform terms) and **selection** (only verified, committed investors reach L3). An investor caught copying an idea is banned, and RamiZeeZ supports the founder's legal action.

## 4.4 Investor features

- A dashboard of matched opportunities, a watchlist and alerts for new matches
- Q&A threads per pitch, moderated by RamiZeeZ
- Offers: amount, terms and conditions, a counter-offer flow
- A portfolio view of their investments, milestone progress, reports and documents
- Budget tracking: committed, deployed and remaining, all within the verified budget
- Tank session calendar and registration
