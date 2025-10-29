# @onbonsai/plugin-imagine

This package allows any agent (ie ElizaOS agents) to pay for AI video generations via Imagine.

Payments are handled via [x402](https://x402.org/) using USDC on Base (per-request micropayments).

## Installation
```bash
yarn add @onbonsai/plugin-imagine
```

## Requirements
- A viem `Account` instance: https://viem.sh/docs/accounts/local/privateKeyToAccount#privatekeytoaccount
- Some USDC on Base to pay for generations

## Usage
The only required field is `prompt`. Optional `templateData` supports video options (defaults are sensible), and you may pass an image as a URL, base64 data URL, or File.

```ts
import { privateKeyToAccount } from "viem/accounts";
import { GenerationService, type GenerationResponse } from "@onbonsai/plugin-imagine";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const generationService = new GenerationService(account, "base", process.env.BASE_RPC_URL as string);

const prompt = "A futuristic character waves in a neon cyberpunk city";

// Triggers x402 payment before the generation request is processed
const generationResponse = await generationService.create({
  prompt,
  // Optional image input (URL | base64 data URL | File)
  image: "https://example.com/pfp.jpg",
  // Optional video parameters (all optional; defaults apply)
  templateData: {
    videoModel: "sora", // default
    duration: 8,
    soraVideoId: "vid_abc123", // if remixing a previously
  },
});

const { id, generation, templateData } = generationResponse as GenerationResponse;

// Use:
// - generation.video for the video
// - generation.image for the cover image
// - templateData.soraVideoId to remix in a future request
```
