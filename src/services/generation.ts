import { createWalletClient, http, type Account } from 'viem';
import { elizaLogger } from "@elizaos/core";
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { base, baseSepolia } from 'viem/chains';

const BONSA_API_URL_STAGING = "https://eliza-staging.onbons.ai/generation";
const BONSAI_API_URL = "https://eliza.onbons.ai/generation"

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
}

/**
 * SmartMedia templates
 */
export enum Template {
  STORY = "story",
  IMAGE = "image",
  INFO_AGENT = "info_agent",
  VIDEO = "video",
  ADVENTURE_TIME_VIDEO = "adventure_time_video",
  NFT_DOT_FUN = "nft_dot_fun",
  ALIEN_BANGERS = "alien_bangers",
  EVOLVING_ART = "evolving_art",
}

/**
 * SmartMedia categories and templates
 */
export enum TemplateCategory {
  EVOLVING_POST = "evolving_post",
  EVOLVING_ART = "evolving_art",
  CAMPFIRE = "campfire",
}

export class GenerationService {
  private apiUrl: string;
  private fetchWithPayment: typeof fetch;

  constructor(account: Account, chain?: "base-sepolia" | "base", rpc?: string) {
    const client = createWalletClient({
      account,
      transport: http(rpc),
      chain: chain === "base-sepolia" ? baseSepolia : base,
    });
    this.apiUrl = chain === "base-sepolia" ? BONSA_API_URL_STAGING : BONSAI_API_URL;
    this.fetchWithPayment = wrapFetchWithPayment(fetch, client, BigInt(1 * 10 ** 6)); // $1 max payment
  }

  public async enhancePrompt({ prompt, template }: { prompt: string, template: string }): Promise<string> {
    try {
      // Make the API request with automatic payment handling
      const response = await this.fetchWithPayment(`${this.apiUrl}/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, template }),
      });

      if (!response.ok) {
        throw new Error(`Failed to enhance prompt: ${response.statusText}`);
      }

      elizaLogger.info(`paymentResponse: ${response.headers.get("x-payment-response") }`);

      const data = await response.json();
      return data.enhancedPrompt;
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      throw error;
    }
  }

  public async create({
    prompt,
    template,
    image,
    subTemplateId,
    templateData
  }: {
    prompt: string,
    template: Template,
    image?: string | File // base64 string, File object, or URL
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
      const response = await this.fetchWithPayment(`${this.apiUrl}/create`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to create generation: ${response.statusText}`);
      }

      const data = await response.json();

      elizaLogger.info(`paymentResponse: ${JSON.stringify(decodeXPaymentResponse(response.headers.get("x-payment-response")),null,2)}`);

      return data;
    } catch (error) {
      elizaLogger.error('Error creating generation:', error);
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
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      elizaLogger.error('Error converting URL to File:', error);
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