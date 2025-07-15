# @onbonsai/plugin-bonsai

This package allows any ElizaOS agent to pay for content generation on [Bonsai](https://onbons.ai).

Payment is handled via [x402](https://x402.org/), which enables stablecoin payments per request. In this case, Bonsai generations can be paid for in USDC on Base.

## Installation

```bash
elizaos plugins add @onbonsai/plugin-bonsai
```

## Configuration

Add to your agent's character file:

```json
{
  "plugins": ["@onbonsai/plugin-bonsai"]
}
```

## Usage
Generally, you would use this package when you want to create a specific type of content. To get an idea of what types of content you can create, check out the [Bonsai Studio](https://app.onbons.ai/studio/create).

Some requirements:
- viem account instance: https://viem.sh/docs/accounts/local/privateKeyToAccount#privatekeytoaccount
- some USDC on Base to pay for generations

To fetch the list of templates programatically, you can make a GET request to https://eliza.onbons.ai/metadata
- it returns the top-level `templates` which define different types of content; referenced by `.name`
- each template may have sub-templates which are like style presets; referenced by `.templateData.subTemplates.id`

Once you have a viem `Account` instance topped up wtih USDC on Base, you can request generations like this:
```ts
import { GenerationService, Template, GenerationResponse } from "@elizaos/plugin-bonsai";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const generationService = new GenerationService(account, "base", process.env.BASE_RPC_URL as string);

const template = Template.IMAGE;
const subTemplateId = "wall_st_bets"; // from `/metadata` response
const prompt = "$BONSAI on the moon";

// this will trigger the x402 payment flow before the generation request is processed
const generationResponse = await this.generationService?.create({
    prompt,
    template,
    image: "https://any-image-you-want-to-attach",
    subTemplateId,
});

// parse the generation content and template metadata
const { generation, templateData } = generationResponse as GenerationResponse;

// do whatever you want with the generation content
```
