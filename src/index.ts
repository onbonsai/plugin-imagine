import type { Plugin } from "@elizaos/core";

export * from "./services/generation";
export * from "./constants";

export const imaginePlugin: Plugin = {
    name: "imagine",
    description: "Plugin to enable media generation using Imagine infra",
    actions: [],
    evaluators: [],
    providers: [],
};
export default imaginePlugin;
