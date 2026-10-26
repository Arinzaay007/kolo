# Demo script — 3 minutes

Record this on the deployed URL, not the sandbox preview. The preview dies on session reset.

**Before you hit record**

- [ ] `npm run spike` green twice in a row
- [ ] `npm run seed` has run → `evidence/seed-mainnet.json` exists
- [ ] Badge on screen reads **"Walrus Memory · Sui Mainnet"**, not "Demo data"
- [ ] One real digest ready to paste (your own transfer, or any real Mainnet transfer)
- [ ] Browser zoom at 110%, one window, no other tabs, notifications off
- [ ] A second, unedited run recorded as backup — the relayer has no SLA

**Say the constraint early.** Kolo holds no money. That is the whole argument, and if the viewer
doesn't know it by 0:30 the rest looks like an escrow product.

---

## 0:00 – 0:25 · The circle

**On screen:** `/` — member cards, reliability, learned notes, rotation.

> "Rotating savings circles are how a lot of the world does finance — esusu, susu, tanda, chit
> funds. Everyone pays in, one person collects each round. They run on trust and somebody's memory.
> This one has a memory of its own — and it never holds the money."

Point at Ada's card: **"pays around the 5th, ±0.4 days, from 3 observed payments."**

> "Nobody typed that. It was written from three verified payments, which is why the app stopped
> reminding her on the 2nd."

## 0:25 – 0:50 · The rotation, and its reasons

**On screen:** the rotation list, Emeka → Ada → Tunde.

> "Round 3 pays out in this order. Not computed when the page loaded — decided, stored, with reasons."

Hover each reason, then click **"Show the 4 memories behind this order"**.

**On screen:** `/memory?evidence=…` — the cited memories highlighted.

> "Emeka collects first because he covered two shortfalls and has never been late. Those are the
> memories. Each one says which verified payment or settled dispute produced it, and names the blob
> it lives in."

*Why this beat matters:* most entries say "our AI learns." This is the receipt.

## 0:50 – 1:45 · The disputed claim — the centrepiece

**On screen:** `/claim`. Pick **Ada**. Paste the digest.

> "Someone says they paid. This is the awkward moment in every circle. Kolo asks Sui Mainnet through
> Tatum whether it's true."

Submit. Wait for the verdict.

**On screen:** `CONTESTED`, with reasons.

> "The transaction is real. It's just not this round — it's from the last cycle. So Kolo records a
> contested claim: what Ada said, and what the chain shows. Not an accusation, a disagreement with
> two sides on it."

Point at the blob ids at the bottom.

> "And it wrote that to Walrus Memory before telling us the answer."

*If asked what Tatum is doing:* it reads the transaction, the recipient, the amount, and the
timestamp, and filters to the contribution coin so a transfer of something else can't pass. JSON-RPC
is gone on Sui Mainnet — this is gRPC on 443 with the key as metadata.

## 1:45 – 2:15 · The money, and the record

**On screen:** the payout transfer on an explorer (or Ada's record after a verified claim).

> "The contribution that *did* arrive is here — real address, real transfer, on Sui Mainnet."

Then open **`/record/Ada`**.

> "This is Ada's own view. Everything held about her, by circle, each line naming its blob. And any
> line can be disputed by her, without anyone's permission."

## 2:15 – 2:40 · The right of reply

**On screen:** `/record/Ada`, the open dispute → **Uphold — the member was right**.

> "Someone rules. Upholding doesn't edit the memory — it writes a correction that supersedes it.
> Original, objection, correction, all readable. A record you can silently edit isn't a record."

Show the standing change and the **"corrected 1×"** badge.

## 2:40 – 3:00 · Portability — the closing claim

**On screen:** `/portable`.

> "Emeka joins a second circle where nobody has met him. Day one, zero events here — and his standing
> is already there. Same namespace, different circle, no operator deciding whether to share it. The
> record is his."

> "Walrus Memory on Sui Mainnet. Tatum for every chain read. Kolo holds no money — it knows what
> happened to it."

---

## Questions to have answers ready for

**"Why does this need Walrus and not a database?"**
Three reasons, in order: a member's record follows them across circles without an operator brokering
it; it's verifiable — you can check what's held about you; and corrections supersede rather than
overwrite, so history stays auditable.

**"Isn't a portable trust score dangerous?"**
Yes, which is why every member can see and contest everything held about them, and why an upheld
objection produces a correction rather than a deletion. I'd rather build the brake than pretend the
risk isn't there.

**"Is this real Mainnet?"**
The memories are — every write went to the production relayer, and `evidence/seed-mainnet.json` lists
them with blob ids. Cycles 1–2 are scripted history; cycle 3 is live. The README states that plainly.

**"What would you do with more time?"**
Delegate access — an auditor who can read the circle's record but not rewrite it, enforced onchain —
and an x402 fee for the collector agent, released per round it reconciles.

**"What doesn't work?"**
Auth is stubbed to three seeded identities with real delegate keys. Only one circle is live at a
time. And the relayer is a public good with no SLA, which is why we record a backup run.

## Do not claim

- That completion rates improved. Unmeasured.
- That the AI Builder award applies, unless it was genuinely built there.
- That the demo transfers are yours if they aren't.
