/**
 * Walrus Memory client, scoped to Kolo.
 *
 * One namespace for every circle (MEMWAL_NAMESPACE, default "kolo"). That is
 * deliberate: recall is scoped per account + namespace, so keeping circles in one
 * namespace is what lets a member's reliability follow them from circle A to
 * circle B — the portability claim the submission rests on. The circle is named
 * inside each memory, not in the namespace.
 */
import { MemWal } from '@mysten-incubation/memwal';
import { type MemoryEntity, decode, encode } from './schema';

/** The slice of MemWal the app uses — so tests can inject a fake. */
export interface MemoryClient {
  health(): Promise<{ ok: boolean; writes?: string; detail?: string }>;
  rememberAndWait(
    text: string,
    opts?: { idempotencyKey?: string },
  ): Promise<{ blob_id: string; id: string; job_id?: string }>;
  recall(args: { query: string; limit?: number }): Promise<{ results: Array<{ blob_id: string; text: string }> }>;
}

export interface Written {
  entity: MemoryEntity;
  blobId: string;
  id: string;
}

export class KoloMemory {
  constructor(
    private readonly client: MemoryClient,
    private readonly namespace: string = process.env.MEMWAL_NAMESPACE || 'kolo',
  ) {}

  /** Real client. Throws loudly if the relayer is not the production one. */
  static async fromEnv(): Promise<KoloMemory> {
    const key = process.env.MEMWAL_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;
    const serverUrl = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz';
    if (!key || !accountId) throw new Error('MEMWAL_KEY and MEMWAL_ACCOUNT_ID must be set (.env.example)');
    if (serverUrl.includes('staging') || serverUrl.includes('testnet')) {
      throw new Error(
        `refusing to write to ${serverUrl}: submissions must write Walrus Memory on Mainnet (production relayer)`,
      );
    }
    const namespace = process.env.MEMWAL_NAMESPACE || 'kolo';
    const memwal = MemWal.create({ key, accountId, serverUrl, namespace });
    return new KoloMemory(memwal as unknown as MemoryClient, namespace);
  }

  async health() {
    return this.client.health();
  }

  /** Write one memory. Awaits the job so the blob id is real, not pending. */
  async remember(entity: MemoryEntity): Promise<Written> {
    const got = await this.client.rememberAndWait(encode(entity));
    return { entity, blobId: got.blob_id, id: got.id };
  }

  /** Semantic recall: by meaning, over the sentence half. */
  async recall(query: string, limit = 5): Promise<Array<{ entity: MemoryEntity; blobId: string; text: string }>> {
    const { results } = await this.client.recall({ query, limit });
    const out: Array<{ entity: MemoryEntity; blobId: string; text: string }> = [];
    for (const r of results) {
      const entity = decode(r.text);
      if (entity) out.push({ entity, blobId: r.blob_id, text: r.text });
    }
    return out;
  }

  /** Recall, then keep only one entity type — the UI's "show me the nudges" path. */
  async recallType<T extends MemoryEntity['type']>(
    query: string,
    type: T,
    limit = 10,
  ): Promise<Array<Extract<MemoryEntity, { type: T }>>> {
    const hits = await this.recall(query, limit * 3);
    return hits
      .map((h) => h.entity)
      .filter((e): e is Extract<MemoryEntity, { type: T }> => e.type === type)
      .slice(0, limit);
  }
}
