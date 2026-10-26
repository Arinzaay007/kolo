/**
 * Tatum Sui Mainnet reads — over gRPC, not JSON-RPC.
 *
 * Sui Foundation disabled JSON-RPC on Mainnet full nodes in the week of 27 Jul 2026
 * and removed it from the node code in mid-October 2026. A lot of material still
 * prints https://sui-mainnet.gateway.tatum.io (the JSON-RPC gateway); it will not
 * connect. This file uses the gRPC gateway on :443 with x-api-key as gRPC metadata.
 *
 * Kolo holds no money, so these reads ARE the verification engine: a member's claim
 * about a contribution is settled against Sui Mainnet, not against our database.
 */
import { credentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';

export const TATUM_SUI_MAINNET_GRPC = 'sui-mainnet-grpc.gateway.tatum.io';

export interface TransferObservation {
  /** Did the node return a transaction for this digest at all? */
  found: boolean;
  digest: string;
  sender: string | null;
  recipients: Array<{ address: string; amountBase: string; coinType: string }>;
  /** Every distinct coin that moved, so a wrong-coin transfer can be named rather than mis-read. */
  coinTypes: string[];
  timestampMs: number | null;
  /** Execution status name, e.g. "success". null when we could not read it. */
  status: string | null;
  error: string | null;
}

export function createTatumSui(options?: { apiKey?: string; host?: string }): SuiGrpcClient {
  const apiKey = options?.apiKey ?? process.env.TATUM_API_KEY;
  // `||` not `??`: an empty value in .env is present but useless.
  const host = options?.host || process.env.TATUM_SUI_GRPC_HOST || TATUM_SUI_MAINNET_GRPC;

  // One transport for every call; the key rides along as gRPC metadata.
  // Tatum also answers keyless on a rate-limited "anonymous" plan, which is
  // enough for the day-0 spike but not for a demo.
  const transport = new GrpcTransport({
    host,
    channelCredentials: credentials.createSsl(),
    ...(apiKey ? { meta: { 'x-api-key': apiKey } } : {}),
  });

  return new SuiGrpcClient({ network: 'mainnet', transport });
}

/** Read one transaction and normalise it into "who sent what to whom". */
export async function observeTransfer(
  client: SuiGrpcClient,
  digest: string,
  /** When set, only this coin's movements count — a transfer of the wrong coin must not
   *  silently satisfy a contribution. */
  onlyCoinType?: string,
): Promise<TransferObservation> {
  try {
    const result = await client.getTransaction({ digest, include: { balanceChanges: true } });
    const tx = result.$kind === 'Transaction' ? result.Transaction : result.FailedTransaction;
    const all = tx.balanceChanges ?? [];
    const changes = onlyCoinType ? all.filter((c) => sameCoin(c.coinType, onlyCoinType)) : all;

    const recipients: Array<{ address: string; amountBase: string; coinType: string }> = [];
    let sender: string | null = null;
    for (const c of changes) {
      const amount = BigInt(c.amount);
      if (amount > 0n) recipients.push({ address: c.address, amountBase: amount.toString(), coinType: c.coinType });
      // The largest net negative change is the payer (gas can make small ones negative).
      if (amount < 0n) {
        const net = senderAmount(c.address, changes);
        if (sender === null || BigInt(net) > BigInt(senderAmount(sender, changes))) sender = c.address;
      }
    }

    return {
      found: true,
      digest: tx.digest,
      sender,
      recipients,
      coinTypes: [...new Set(all.map((c) => c.coinType))],
      timestampMs: tx.timestampMs,
      status: statusName(tx.status),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // "not found" is a real answer ("that digest is not on chain"), not a failure of
    // the pipe. Anything else is reported so the caller can tell the two apart —
    // an auth rejection must never be read as "the member did not pay".
    const notFound = /not[ _-]?found|NOT_FOUND/i.test(message);
    return {
      found: false,
      digest,
      sender: null,
      recipients: [],
      coinTypes: [],
      timestampMs: null,
      status: null,
      error: notFound ? null : message,
    };
  }
}

/** Coin types arrive abbreviated (`0x2::sui::SUI`) or fully normalised; compare the tail. */
export function sameCoin(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/^0x0*/, '0x');
  return norm(a) === norm(b) || a.toLowerCase().endsWith(b.toLowerCase().split('::').slice(-2).join('::'));
}

function senderAmount(address: string, changes: Array<{ address: string; amount: string }>): string {
  let total = 0n;
  for (const c of changes) if (c.address === address) total += BigInt(c.amount);
  return (-total).toString();
}

function statusName(status: unknown): string | null {
  if (!status || typeof status !== 'object') return null;
  const s = status as Record<string, unknown>;
  if (typeof s.success === 'boolean') return s.success ? 'success' : 'failure';
  const kind = s.$kind ?? s.kind;
  return typeof kind === 'string' ? kind : null;
}

/** The pot's real balance, as the chain has it — not as our database remembers it. */
export async function observeBalance(
  client: SuiGrpcClient,
  owner: string,
  coinType?: string,
): Promise<{ coinType: string; totalBase: string }> {
  const { balance } = await client.getBalance({ owner, ...(coinType ? { coinType } : {}) });
  return { coinType: balance.coinType, totalBase: balance.balance };
}
