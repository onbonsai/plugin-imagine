import { createWalletClient, http, type Account } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { pollForGenerationResult } from '../utils';

const BONSA_API_URL_STAGING = "https://eliza-staging.onbons.ai";
const BONSAI_API_URL = "https://eliza.onbons.ai";

interface PaymentResponse {
  success: boolean;
  transaction: `0x${string}`;
  network: string;
  payer: `0x${string}`;
};

export interface GenerationResponse {
  generation: {
    text?: string;
    image?: string; // base64
    video?: {
      buffer: number[],
      mimeType: string,
      size: number
    }
  }
  templateData: any;
  paymentResponse: PaymentResponse | null;
};

export interface EnhancePromptResponse {
  enhanced: string;
  paymentResponse: PaymentResponse | null;
};

/**
 * SmartMedia templates
 */
export enum Template {
  STORY = "story",
  IMAGE = "image",
  VIDEO = "video",
  INFO_AGENT = "info_agent",
  ALIEN_BANGERS = "alien_bangers",
}

/**
 * SmartMedia sub-templates
 */
export enum SubTemplateId {
  ANIMAL_FRUIT = "animal_fruit",
  ANIMAL_BRAND = "animal_brand",
  TABLETOP_MINIATURE = "tabletop_miniature",
  WALL_ST_BETS = "wall_st_bets",
}

/**
 * SmartMedia categories
 */
export enum TemplateCategory {
  EVOLVING_POST = "evolving_post",
  EVOLVING_ART = "evolving_art",
  CAMPFIRE = "campfire",
}

/**
 * Service for handling generation requests to the Bonsai API.
 * Provides functionality for enhancing prompts and creating various types of media generations.
 */
export class GenerationService {
  private apiUrl: string;
  private fetchWithPayment: typeof fetch;

  /**
   * Creates a new instance of GenerationService.
   *
   * @param {Account} account - The wallet account to use for payments
   * @param {"base-sepolia" | "base"} [chain] - The blockchain network to use (defaults to base)
   * @param {string} [rpc] - Optional RPC URL for the blockchain network
   */
  constructor(account: Account, chain?: "base-sepolia" | "base", rpc?: string) {
    const client = createWalletClient({
      account,
      transport: http(rpc),
      chain: chain === "base-sepolia" ? baseSepolia : base,
    });
    this.apiUrl = chain === "base-sepolia" ? BONSA_API_URL_STAGING : BONSAI_API_URL;
    // @ts-expect-error SignerWallet vs Account?
    this.fetchWithPayment = wrapFetchWithPayment(fetch, client, BigInt(5 * 10 ** 6)); // $5 max payment
  }

  /**
   * Enhances a given prompt using the Bonsai API, with payment handled via x402
   *
   * @param {Object} params - The parameters for prompt enhancement
   * @param {string} params.prompt - The original prompt to enhance
   * @param {string} params.template - The template to use for enhancement
   * @returns {Promise<EnhancePromptResponse>} The enhanced prompt + payment response
   * @throws {Error} If the API request fails
   */
  public async enhancePrompt({ prompt, template }: { prompt: string, template: string }): Promise<EnhancePromptResponse> {
    try {
      // Make the API request with automatic payment handling
      const response = await this.fetchWithPayment(`${this.apiUrl}/generation/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, template }),
      });

      if (!response.ok) {
        throw new Error(`Failed to enhance prompt: ${response.statusText}`);
      }

      const data = await response.json() as { enhancedPrompt: string };
      const paymentResponse = response.headers.get("x-payment-response");

      return {
        enhanced: data.enhancedPrompt,
        paymentResponse: paymentResponse ? decodeXPaymentResponse(paymentResponse) : null,
      };
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      throw error;
    }
  }

  /**
   * Creates a new generation using the Bonsai API, with payment handled via x402
   *
   * @param {Object} params - The parameters for generation
   * @param {string} params.prompt - The prompt to use for generation
   * @param {Template} params.template - The template type to use
   * @param {string | File} [params.image] - Optional image input (base64 string, File object, or URL)
   * @param {string} [params.subTemplateId] - Optional sub-template identifier
   * @param {Record<string, unknown>} [params.templateData] - Optional additional template data
   * @returns {Promise<GenerationResponse>} The generation response containing the generated content + payment response
   * @throws {Error} If the API request fails or if the image format is invalid
   */
  public async create({
    prompt,
    template,
    image,
    subTemplateId,
    templateData
  }: {
    prompt: string,
    template: Template,
    image?: string | File,
    subTemplateId?: string,
    templateData?: Record<string, unknown>,
  }): Promise<GenerationResponse> {
    try {
      // Create FormData for multer to parse
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('template', template);
      if (subTemplateId || templateData) {
        const _templateData = JSON.stringify({ ...(templateData || {}), subTemplateId, prompt });
        formData.append('templateData', _templateData);
      }

      // If image is provided, process and append it to formData
      if (image) {
        const processedImage = await this.handleImage(image);
        formData.append('image', processedImage);
      }

      // Make the API request with automatic payment handling
      const createResponse = await this.fetchWithPayment(`${this.apiUrl}/generation/create`, {
        method: 'POST',
        body: formData
      });
      if (!createResponse.ok) throw new Error(`Failed to create generation: ${createResponse.statusText}`);

      const { taskId } = await createResponse.json() as { taskId?: string };
      if (!taskId) throw new Error('Task ID not found in response.');

      // Poll for the result
      const data = await pollForGenerationResult(this.apiUrl, taskId);
      const paymentResponse = createResponse.headers.get("x-payment-response");

      return {
        ...data,
        paymentResponse: paymentResponse ? decodeXPaymentResponse(paymentResponse) : null,
      };
    } catch (error) {
      console.log('Error creating generation:', error);
      throw error;
    }
  }

  private async urlToFile(url: string): Promise<File> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = url.split('/').pop() || 'image.png';
      // @ts-ignore blob
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.log('Error converting URL to File:', error);
      throw error;
    }
  }

  private async handleImage(image: string | File): Promise<File> {
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // Handle base64 string
        const base64Data = image.split(',')[1]; // Remove data URL prefix if present
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: 'image/png' });
        return new File([blob], 'image.png', { type: 'image/png' });
      } else if (image.startsWith('http')) {
        // Handle URL
        return await this.urlToFile(image);
      } else {
        throw new Error('Invalid image format. Must be base64 string, File object, or URL');
      }
    }
    // It's already a File object
    return image;
  }
}