import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';
import { open, seal } from '../../src/share/crypto';

const origin = 'https://nuthanreddy.github.io';
function store() {
  const blobs = new Map<string, ArrayBuffer>();
  const env: Env = {
    ALLOWED_ORIGINS: origin,
    LINKS: {
      async put(id, bytes) {
        blobs.set(id, bytes);
      },
      async get(id) {
        return blobs.get(id) ?? null;
      },
    },
    WRITE_LIMIT: {
      async limit() {
        return { success: true };
      },
    },
  };
  return { env, blobs };
}
const request = (body: ArrayBuffer, from: string | null = origin) =>
  new Request('https://links.example.test/v1', {
    method: 'POST',
    body,
    headers: from ? { origin: from } : {},
  });

describe('personal encrypted link service', () => {
  it('stores only ciphertext and opens a shared link with the browser key', async () => {
    const { env, blobs } = store();
    const plaintext = new TextEncoder().encode('private diagram for a test');
    const encrypted = await seal(plaintext);
    const created = await worker.fetch(request(encrypted.blob.buffer), env);
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    expect([...blobs.keys()]).toEqual([id]);
    expect(new TextDecoder().decode(blobs.get(id))).not.toContain('private diagram');
    const response = await worker.fetch(
      new Request(`https://links.example.test/v1/${id}`, { headers: { origin } }),
      env,
    );
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(
      await open(new Uint8Array(await response.arrayBuffer()), encrypted.key),
    ).toEqual(plaintext);
    expect(
      await open(encrypted.blob, crypto.getRandomValues(new Uint8Array(32))),
    ).toBeNull();
    expect(
      (await worker.fetch(new Request('https://links.example.test/v1/invalid'), env))
        .status,
    ).toBe(404);
  });

  it('rejects unconfigured, missing and foreign write origins and rate-limited writes', async () => {
    const { env, blobs } = store();
    const body = new ArrayBuffer(40);
    for (const from of [null, 'https://breakscale.tech']) {
      expect((await worker.fetch(request(body, from), env)).status).toBe(403);
    }
    env.ALLOWED_ORIGINS = '';
    expect((await worker.fetch(request(body), env)).status).toBe(403);
    env.ALLOWED_ORIGINS = origin;
    env.WRITE_LIMIT = {
      async limit() {
        return { success: false };
      },
    };
    expect((await worker.fetch(request(body), env)).status).toBe(429);
    expect(blobs.size).toBe(0);
  });

  it('bounds chunked and declared oversized uploads before storage', async () => {
    const { env, blobs } = store();
    expect((await worker.fetch(request(new ArrayBuffer(27)), env)).status).toBe(400);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(128 * 1024));
        controller.enqueue(new Uint8Array(128 * 1024 + 1));
        controller.close();
      },
    });
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { origin },
      body,
      duplex: 'half',
    };
    const streamed = new Request('https://links.example.test/v1', init);
    expect((await worker.fetch(streamed, env)).status).toBe(413);
    const declared = request(new ArrayBuffer(40));
    declared.headers.set('content-length', String(256 * 1024 + 1));
    expect((await worker.fetch(declared, env)).status).toBe(413);
    expect(blobs.size).toBe(0);
  });
});
