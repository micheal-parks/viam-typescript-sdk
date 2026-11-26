import type {
  AnyMessage,
  Message,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import type { ContextValues, StreamResponse, Transport, UnaryResponse } from '@connectrpc/connect';
import { cloneHeaders } from '../rpc/dial';

/**
 * Wraps a transport so every call carries the token the provider returns at call time, not the
 * token that was current when the transport was created. This is what lets a long-lived client keep
 * working after its caller refreshes a short-lived token.
 */
export class AccessTokenProviderTransport implements Transport {
  protected readonly transport: Transport;
  protected readonly getAccessToken: () => string | Promise<string>;

  constructor(transport: Transport, getAccessToken: () => string | Promise<string>) {
    this.transport = transport;
    this.getAccessToken = getAccessToken;
  }

  public unary = async <I extends Message<I> = AnyMessage, O extends Message<O> = AnyMessage>(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    message: PartialMessage<I>,
    contextValues?: ContextValues,
  ): Promise<UnaryResponse<I, O>> =>
    this.transport.unary(
      service,
      method,
      signal,
      timeoutMs,
      await this.withAuthorization(header),
      message,
      contextValues,
    );

  public stream = async <I extends Message<I> = AnyMessage, O extends Message<O> = AnyMessage>(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    input: AsyncIterable<PartialMessage<I>>,
    contextValues?: ContextValues,
  ): Promise<StreamResponse<I, O>> =>
    this.transport.stream(
      service,
      method,
      signal,
      timeoutMs,
      await this.withAuthorization(header),
      input,
      contextValues,
    );

  private async withAuthorization(header: HeadersInit | undefined): Promise<Headers> {
    const headers = cloneHeaders(header);
    headers.set('authorization', `Bearer ${await this.getAccessToken()}`);
    return headers;
  }
}
