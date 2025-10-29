import { createWalletClient, http, type Account } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { pollForGenerationResult } from '../utils';

import { GENERATION_API_URL } from '../constants';

interface PaymentResponse {
  success: boolean;
  transaction: `0x${string}`;
  network: string;
  payer: `0x${string}`;
};

export interface GenerationResponse {
  id: string; // taskId, should be set to agentId / agentMessageId for createSmartMedia
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
  paymentResponse: PaymentResponse;
};


/**
 * Service for handling generation requests to the Imagine API.
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
    // Use configured generation API base URL
    this.apiUrl = GENERATION_API_URL;
    // @ts-expect-error SignerWallet vs Account?
    this.fetchWithPayment = wrapFetchWithPayment(fetch, client, BigInt(5 * 10 ** 6)); // $5 max payment
  }

  /**
   * Creates a new generation using the Bonsai API, with payment handled via x402
   *
   * @param {Object} params - The parameters for generation
   * @param {string} params.prompt - The prompt to use for generation
   * @param {string | File} [params.image] - Optional image input (base64 string, File object, or URL)
   * @param {Record<string, unknown>} [params.templateData] - Optional additional template data (videoModel?: 'sora'; soraVideoId?: string; duration?: number)
   * @param {string} [params.remixPostId] - Optional remix post id
   * @param {string} [params.rootRemixPostId] - Optional root remix post id
   * @param {string} [params.remixToken] - Optional remix token
   * @param {string} [params.soraVideoId] - Optional sora video id (also in templateData)
   * @returns {Promise<GenerationResponse>} The generation response containing the generated content + payment response
   * @throws {Error} If the API request fails or if the image format is invalid
   */
  public async create({
    prompt,
    image,
    templateData,
    seed,
    remixPostId,
    rootRemixPostId,
    remixToken,
    soraVideoId,
  }: {
    prompt: string,
    image?: string | File,
    templateData?: Record<string, unknown>,
    seed?: string,
    remixPostId?: string,
    rootRemixPostId?: string,
    remixToken?: string,
    soraVideoId?: string,
  }): Promise<GenerationResponse> {
    try {
      // Create FormData for multer to parse
      const formData = new FormData();
      formData.append('prompt', prompt);
      if (templateData) formData.append('templateData', JSON.stringify(templateData));
      if (seed) formData.append('seed', seed);
      if (remixPostId) formData.append('remixPostId', remixPostId);
      if (rootRemixPostId) formData.append('rootRemixPostId', rootRemixPostId);
      if (remixToken) formData.append('remixToken', remixToken);
      if (soraVideoId) formData.append('soraVideoId', soraVideoId);

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

      const { taskId } = (await createResponse.json()) as { taskId?: string };
      if (!taskId) throw new Error('Task ID not found in response.');

      // Poll for the result
      const data = await pollForGenerationResult(this.apiUrl, taskId);

      return {
        id: taskId,
        ...data,
        paymentResponse: decodeXPaymentResponse(createResponse.headers.get("x-payment-response") ?? ""),
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

      const arrayBuffer = await response.arrayBuffer();
      const filename = url.split('/').pop() || 'image.png';
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      return new File([new Uint8Array(arrayBuffer)], filename, { type: contentType });
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
        return new File(byteArrays, 'image.png', { type: 'image/png' });
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