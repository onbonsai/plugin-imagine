import type { Plugin } from "@elizaos/core";

export * from "./services/generation";
export * from "./services/lens/createPost";
export * from "./services/lens/authentication";
export * from "./services/smartMedia";
export * from "./constants";

export { toEvmAddress } from "@lens-protocol/metadata";

export const bonsaiPlugin: Plugin = {
    name: "bonsai",
    description: "Plugin to enable smart media generations on Bonsai",
    actions: [],
    evaluators: [],
    providers: [],
};
export default bonsaiPlugin;
