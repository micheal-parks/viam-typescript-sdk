// @vitest-environment happy-dom

import type { Transport } from '@connectrpc/connect';
import { describe, expect, it, vi } from 'vitest';
import { dialDirect } from '../rpc';
import { createViamTransport } from './viam-transport';

vi.mock('../rpc', () => ({ dialDirect: vi.fn() }));

const createMockTransport = () => ({
  unary: vi.fn().mockResolvedValue({}),
  stream: vi.fn().mockResolvedValue({}),
});

/** The headers argument is fifth in both `unary` and `stream`. */
const sentHeaders = (call: unknown[] | undefined) => new Headers(call?.[4] as HeadersInit);

type UnaryArgs = Parameters<Transport['unary']>;
type StreamArgs = Parameters<Transport['stream']>;

describe('createViamTransport with an access token provider', () => {
  it('sends the token the provider returns at call time, not at creation', async () => {
    const inner = createMockTransport();
    vi.mocked(dialDirect).mockResolvedValue(inner);

    let token = 'first';
    const transport = await createViamTransport('https://app.viam.com', {
      type: 'access-token-provider',
      payload: async () => Promise.resolve(token),
    });

    await transport.unary(...([{}, {}, undefined, undefined, {}, {}] as unknown as UnaryArgs));
    token = 'refreshed';
    await transport.unary(...([{}, {}, undefined, undefined, {}, {}] as unknown as UnaryArgs));

    expect(sentHeaders(inner.unary.mock.calls[0]).get('authorization')).toBe('Bearer first');
    expect(sentHeaders(inner.unary.mock.calls[1]).get('authorization')).toBe('Bearer refreshed');
  });

  it('adds the token to a stream without dropping the call headers', async () => {
    const inner = createMockTransport();
    vi.mocked(dialDirect).mockResolvedValue(inner);

    const transport = await createViamTransport('https://app.viam.com', {
      type: 'access-token-provider',
      payload: () => 'token',
    });

    await transport.stream(
      ...([{}, {}, undefined, undefined, { 'x-call': 'kept' }, []] as unknown as StreamArgs),
    );

    const headers = sentHeaders(inner.stream.mock.calls[0]);
    expect(headers.get('authorization')).toBe('Bearer token');
    expect(headers.get('x-call')).toBe('kept');
  });
});
