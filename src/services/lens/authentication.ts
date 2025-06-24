import { type SessionClient, evmAddress } from "@lens-protocol/client";
import { currentSession } from "@lens-protocol/client/actions";
import { LENS_BONSAI_APP } from "../../constants";
import { getWalletClient, lensClient } from "./client";
import type { Account } from "viem";

export const login = async (account: Account, accountAddress: string, managedAccountAddress?: string): Promise<SessionClient | undefined> => {
  const walletClient = getWalletClient(account);
  const [owner] = await walletClient.getAddresses();
  const params = managedAccountAddress
    ? {
        accountManager: {
          app: LENS_BONSAI_APP,
          manager: evmAddress(owner),
          account: evmAddress(managedAccountAddress),
        },
    } : {
        accountOwner: {
          app: LENS_BONSAI_APP,
          owner: evmAddress(owner),
          account: evmAddress(accountAddress),
        }
      }
  const result = await lensClient.login({
    ...params,
    signMessage: (message) => walletClient.signMessage({ account, message }),
  });

  if (result.isOk()) return result.value as SessionClient;
  console.log(result.error);
}

export const resumeSession = async (refreshTokens = false) => {
  const resumed = await lensClient.resumeSession();
  if (resumed.isErr()) {
    return;
  }
  const sessionClient = resumed.value;

  if (refreshTokens) await currentSession(sessionClient);

  return sessionClient;
};