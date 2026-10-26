# Kolo, in plain words

One page. Read it before recording.

---

## The sentence to say first

> **Kolo runs a rotating savings circle without ever touching the money. It checks the blockchain to
> see who actually paid, and it remembers — so a good record follows you from circle to circle.**

If you only get one sentence out, that's the one.

---

## The problem

Rotating savings — called *esusu* in Nigeria, *ajo*, *susu*, *tanda*, *chit fund* elsewhere — is how
most of the world saves without a bank. Everyone puts in the same amount each round. One person takes
the whole pot. Then the next person. It rotates until everyone has had a turn.

It works on trust, and it breaks in two places:

1. **Whoever holds the money can leave with it.** That is usually the collector.
2. **Your record dies with the circle.** Two years of paying on time is worth nothing in the next
   circle, because nobody can prove it.

---

## The decision everything follows from

**Kolo never holds the money.** Members pay each other directly, wallet to wallet, on Sui.

Take custody away and Kolo has no pot to guard — so the only job left is the one that actually
matters: **knowing what happened, and remembering it.**

That is why the product is verification plus memory. Everything else is detail.

---

## The demo, five screens, in this order

### 1. Home — the circle
Who's in it, who has paid this round, whose turn it is to collect, and **why** the order is what it
is. A rotating circle that cannot explain its order is just a list of names.

### 2. Check a contribution — "Did the money actually arrive?"
You paste a Sui transaction digest. Kolo reads Sui Mainnet through Tatum and gives a verdict,
checked against this round's amount, time window and collector.

Say this: *"This is not a screenshot and not a promise. It is the transfer itself."*

When it fails, it explains itself, e.g. *"the transfer did not reach this round's collector"* or
*"the transfer happened outside this round."*

### 3. Memory inspector — the record
Every fact the circle wrote to Walrus Memory on Mainnet, each with a blob ID you can look up.
This is the answer to "prove it."

### 4. One member's record — nothing is deleted
Their payments, the times they slipped, and the objection they raised. When the circle rules, the
original stays, the objection stays, and an upheld ruling writes a **correction that supersedes** the
old memory. You can always see the argument and its outcome.

Say this: *"We never edit history. We add to it."*

### 5. Portability — the record travels
The same history is visible in a second circle. This is the thing paper can't do: a track record
that belongs to the person, not to the circle they happened to be in.

---

## Why these two, in one line each

- **Tatum** — how Kolo sees the chain. Because Kolo holds no money, checking the chain *is* the
  product. The read is load-bearing, not decoration.
- **Walrus Memory** — where the record lives. On Mainnet, with blob IDs. It outlives the app, the
  circle, and whoever built it.

---

## The bit that stops it being a diary

Memory has to **change a decision**, or it is just a log.

In the demo, it changes the payout order. Emeka has paid on time and covered two shortfalls, so he
collects first. Tunde was late twice and has not repaid, so he collects last. **The record is the
reason the queue is in that order.**

---

## Do not say these

| Don't say | Say instead |
|---|---|
| "It lifts completion rates" | "We think a visible record makes saving together easier — that's a hypothesis, we haven't measured it" |
| "The permanent record stops a collector running off" | "It **records** the loss. What reduces the risk is the published rotation order and the visible track record" |
| "This all really happened" | "Cycles 1 and 2 are seeded history. The memories are real Mainnet writes — the events they describe were composed for the demo" |
| "It's a bank / it holds your money" | "It never holds your money — that's the entire point" |

---

## Questions you'll get, and short answers

**"So it's just a notebook?"**
No. The notebook doesn't change who gets paid first. Here, the record decides the order.

**"What if I lie about a payment?"**
You don't get to assert it. You hand over a transaction digest and the chain is checked. A false
claim comes back contested, and the objection stays on your record.

**"Who can read my history?"**
Your circle, through your account's delegate key. Walrus Memory scopes recall per account and
namespace.

**"What happens if Kolo disappears?"**
The memories are on Walrus Mainnet with blob IDs, and the money was never with us. That's the point
of no custody: the failure mode is a lost app, not lost money.

---

## The honest state of it

- **23 memories** on Walrus Mainnet, with blob IDs in `evidence/seed-mainnet.json`
- **Live** at <https://kolo-inky.vercel.app>, reading real Mainnet records
- **Code** at <https://github.com/Arinzaay007/kolo>
- **Has not been used by a real circle yet.** It has been built and tested, and the demo is a demo.
  Say that plainly if asked — a judge will respect it more than a hedge.
