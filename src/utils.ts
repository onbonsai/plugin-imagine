import { decodeXPaymentResponse } from "x402-fetch";

export const parseBase64Image = (imageBase64: string): File | undefined => {
  try {
    // Extract image type from base64 string
    const matches = imageBase64.match(/^data:image\/(\w+);base64,/);
    if (!matches) {
      throw new Error("parseBase64Image:: failed to infer image type");
    }

    const imageType = matches[1];
    const mimeType = `image/${imageType}`;

    // Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Create a file object that can be used with FormData
    const blob = new File([imageBuffer], `bonsai_generated_${Date.now()}.${imageType}`, {
      type: mimeType,
    });

    return Object.assign(blob, {
      preview: URL.createObjectURL(blob),
    });
  } catch (error) {
    console.log(error);
  }
};

const DEFAULT_POLLING_INTERVAL = 10000; // 10 seconds
const DEFAULT_POLLING_TIMEOUT = 300000; // 5 minutes

export async function pollForGenerationResult(
  apiUrl: string,
  taskId: string
): Promise<any> {
  const pollingUrl = `${apiUrl}/generation/${taskId}/status`
  const startTime = Date.now();

  while (Date.now() - startTime < DEFAULT_POLLING_TIMEOUT) {
    const statusResponse = await fetch(pollingUrl);

    if (statusResponse.ok) {
        const data = await statusResponse.json();
        switch (data.status) {
            case 'completed':
                return data.result;
            case 'failed':
                throw new Error(data.error || 'Generation task failed.');
            case 'processing':
            case 'queued':
                await new Promise(resolve => setTimeout(resolve, DEFAULT_POLLING_INTERVAL));
                break;
            default:
                throw new Error(`Unknown status: ${data.status}`);
        }
    } else if (statusResponse.status === 404) {
        throw new Error('Generation task not found.');
    } else {
      await new Promise(resolve => setTimeout(resolve, DEFAULT_POLLING_INTERVAL));
    }
  }

  throw new Error('Polling for generation result timed out.');
}