import { PublicClient, mainnet, testnet } from "@lens-protocol/client";
import { StorageClient } from "@lens-chain/storage-client";
import { IS_PRODUCTION } from "./../../constants"
import { type Account, createWalletClient, http, type WalletClient } from "viem";
import { chains } from "@lens-chain/sdk/viem";
export const LENS_ENVIRONMENT = IS_PRODUCTION ? mainnet : testnet;

export const lensClient = PublicClient.create({
  environment: LENS_ENVIRONMENT,
  origin: process.env.DOMAIN,
});

export const storageClient = StorageClient.create();

export const getWalletClient = (account: Account): WalletClient => {
  return createWalletClient({
    account,
    transport: http(IS_PRODUCTION ? process.env.LENS_RPC_URL as string : undefined),
    chain: IS_PRODUCTION ? chains.mainnet : chains.testnet,
  }) as WalletClient;
}