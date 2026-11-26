import { dialDirect } from '../rpc';

import type { Transport } from '@connectrpc/connect';
import { clientHeaders } from '../utils';
import { AccessTokenProviderTransport } from './access-token-provider-transport';

/** Credentials are either used to obtain an access token or provide an existing one */
export type Credentials = Credential | AccessToken;

/** A credential that can be exchanged to obtain an access token */
export interface Credential {
  authEntity: string;
  type: 'api-key';
  payload: string;
}

/** An access token used to access protected resources. */
export interface AccessToken {
  type: 'access-token';
  payload: string;
}

/**
 * Supplies the access token for each request to Viam app. Use it in place of {@link AccessToken}
 * when the token is short-lived: the client calls `payload` before every request, so a token the
 * caller refreshes after the client was created is still the one sent.
 *
 * Accepted by {@link createViamClient} only. Machine connections dial with a fixed token, so
 * `ViamClient.connectToMachine` resolves the provider once and passes the result as an
 * {@link AccessToken}.
 */
export interface AccessTokenProvider {
  type: 'access-token-provider';
  payload: () => string | Promise<string>;
}

export const isCredential = (object: Credentials | undefined): object is Credential => {
  return object !== undefined && 'authEntity' in object;
};

/** Initialize an authenticated transport that can access protected resources. */
export const createViamTransport = async (
  serviceHost: string,
  credential: Credentials | AccessTokenProvider,
): Promise<Transport> => {
  if (credential.type === 'access-token-provider') {
    const transport = await dialDirect(serviceHost, { extraHeaders: clientHeaders });
    return new AccessTokenProviderTransport(transport, credential.payload);
  }
  if (credential.type === 'access-token') {
    return dialDirect(serviceHost, {
      accessToken: credential.payload,
      extraHeaders: clientHeaders,
    });
  }
  return dialDirect(serviceHost, {
    credentials: credential,
    extraHeaders: clientHeaders,
  });
};
