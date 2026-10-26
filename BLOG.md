# Kolo: a savings circle that remembers

*Published for the Tatum × Walrus "Total Recall" hackathon, Track 3 — Consumer Finance.*

---

Rotating savings circles are one of the oldest financial instruments on earth and still one of the
largest. You know them as **esusu** or **ajo** in Nigeria, **susu** in Ghana and the Caribbean,
**tanda** in Mexico, **cundina** in Latino communities, **chit funds** in India. Everyone pays in on
a schedule; one member takes the whole pot each round; it turns until everyone has collected.

They run on trust, a WhatsApp group, and somebody's memory.

And that's the problem. The money usually works. What fails is the **record**. Who actually paid on
time. Who needed reminding, and which reminder worked. Who covered a shortfall for whom, and whether
it was ever repaid. Whose turn it is — and why. In a circle of five people that lives in someone's
head, a reputation is only as durable as that person's patience, and it doesn't survive the circle.

**Kolo is a savings circle with a memory.** It holds no money and never asks you to send it any. It
does one thing: it knows what happened, and it gets better at predicting what will happen next.

## What it refuses to do

Kolo does not custody funds. Members pay the person whose turn it is, exactly as they always have,
wallet to wallet. That constraint is the whole design.

If Kolo held the pot in a contract, the contract would settle every question and the blockchain read
would be decoration. With no custody, **the chain read *is* the verification engine** — which is what
makes the Tatum integration load-bearing rather than ornamental, and what makes the product a memory
system rather than an escrow product.

## How it works

**A member says they paid.** Kolo asks Sui Mainnet, through Tatum's gRPC gateway, whether that's
true — the transaction, the recipient, the amount, and whether it landed inside this round. Then it
writes down what it found.

**Either answer becomes a memory.** That's the property I care most about: nobody has to "use the
memory feature." Verification produces memory as a byproduct.

```
claim  →  Tatum reads Sui Mainnet  →  verdict  →  memory  →  the rotation changes
  ↑                                                              │
  └──────────────── next cycle starts differently ────────────────┘
```

**And the memory changes a decision.** The next round's payout order is not re-derived when the page
renders. It was decided, stored, and the reasons are cited by id. Click a member's slot and you land
on the memories that put them there.

## What a circle learns

Eight things, each of which is a screen element rather than a claim:

- **Pay rhythm** — Ada pays around the 5th, ±0.4 days, from three observed payments. So the app
  stops dunning her on the 2nd.
- **Nudge efficacy** — WhatsApp at 19:00 worked in 3 hours. SMS at 09:00 has never worked. It
  remembers the difference.
- **Shortfalls** — who fell short, who covered it, whether they were repaid, how late.
- **Verified contributions** — with the digest, so the claim is checkable.
- **Reliability** — a score, plus the ids of the memories that produced it.
- **Circle rules** — including ones written *because* of a dispute, versioned.
- **Rotation decisions** — the order, the reasons, and the memories behind them.
- **Disputes and rulings** — a member's objection, and what someone decided about it.

## Portable reputation, and the right of reply

This is where Walrus Memory stops being convenient and starts being necessary.

A member's record is theirs. It isn't the circle's property, and no operator of ours sits in the
middle to decide whether the next circle can see it. One Walrus Memory namespace, many circles: the
circle is named *inside* each memory, not in the namespace, so **recall is scoped per member account
and follows them.**

In the demo, Emeka joins a second circle where nobody has met him. Day one, zero events in that
circle — and Kolo still knows his standing, because it was earned somewhere else. That second
circle's rotation put him first and cited memories written in the first one.

Portable reputation is also a good way to build a tool that ruins people's lives, so there's a
brake. **Every member can see everything held about them, and can object.** An objection does not
delete or edit the memory: it writes a `member_dispute` that references it, so the original and the
objection both stay readable. Someone then rules — and here is the discipline that matters:

> An upheld objection writes a **correction that supersedes** the earlier record. Nothing is erased.
> A reader sees the original memory, the objection, and the correction, in that order, forever.

A rejected objection changes nothing at all, and the objection stays on the record anyway. A record
you can silently edit isn't a record.

## Why Tatum, and why gRPC

Sui Foundation disabled JSON-RPC on Mainnet full nodes in the week of 27 July 2026 and removed it
from the node code in mid-October. A lot of material — including some published around this
hackathon — still prints `https://sui-mainnet.gateway.tatum.io`, the JSON-RPC gateway. **It does not
connect.** Kolo reads through Tatum's Sui **gRPC** endpoint on port 443, with the API key passed as
gRPC metadata.

Two things we learned by running it rather than reading about it:

1. **The keyless plan allows roughly one call**, then HTTP 429. The client reports a 429 as *"set an
   API key"* rather than as a broken pipe — because an auth failure must never be read as "the member
   didn't pay."
2. **Balance changes must be filtered by coin type.** A transaction moving three coins must not
   satisfy a contribution by accident. We filter to the contribution coin and report what else moved,
   so a wrong-coin transfer can be named rather than mis-read.

The negative path is the one that matters. A verifier that only ever says yes proves nothing:

```
read 4ETyDNa5bhLXzTQsvVyR8LziWiEivrM15oZThd9jxndn
  status        success
  at            2026-10-11T10:18:53.088Z
  coins moved   0x00…02::sui::SUI
verdict: CONTESTED  (expecting 0.001 SUI)
  · the transfer did not reach this round's collector
  · the transfer happened outside this round
```

A real Mainnet transaction, read through Tatum, rejected for the right two reasons.

## How it learned over time

The honest version, because the demo would otherwise be a lie:

- **Cycles 1 and 2 are seeded history.** They exist so there is something to have learned from on day
  one. Every one of those memories is a real write to Walrus Memory on Mainnet — the *history* is
  scripted, the *writes* are not, and the README says so.
- **Cycle 3 is live.** A claim, a chain read, a verdict, a memory, a reordered rotation.

The comparison that matters is on one screen: the circle's board in cycle 1 versus cycle 3. Same
layout, different ordering — and every ordering change is traceable to a memory that names a
verified payment or a settled dispute.

What I will *not* claim is that completion rates went up. Kolo is a mechanism for making a track
record visible and portable; whether that changes anyone's behaviour is a hypothesis I have not
measured. The claim I can defend is narrower and, I think, more interesting: **a circle without a
record is a spreadsheet, and a circle with one can reward the people who deserve it.**

## What's the same as before, and what's new

Rotating circles work because everyone can see the schedule and everyone knows everyone. Kolo doesn't
replace that. It keeps the receipt — and lets the receipt travel with the person instead of dying
with the group.

---

*Built with Walrus Memory (Sui Mainnet) and Tatum's Sui gRPC API. Kolo holds no funds and makes no
claims about yield, safety, or returns. Every fact shown in the app names the blob it lives in, and
the repository links each test to what it proves.*
