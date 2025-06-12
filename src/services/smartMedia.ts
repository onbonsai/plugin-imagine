interface SmartMediaPostParams {
  postId: string
  uri: string
  token: {
    chain: "base" | "lens"
    address: `0x${string}`
    metadata?: {
      name?: string;
      symbol?: string;
      image?: string;
    }
  }
  params: {
    templateName: string
    category: string
    templateData: any
  }
  skipGeneration?: boolean
};

/**
 * Creates a smart media post by sending a request to the specified API endpoint.
 *
 * @param {string} url - The base URL of the API endpoint
 * @param {string} idToken - The authentication token to be used in the Authorization header
 * @param {SmartMediaPostParams} body - The parameters for creating the smart media post
 * @param {string} body.postId - The unique identifier for the post
 * @param {string} body.uri - The URI associated with the post
 * @param {Object} body.token - Token information for the post
 * @param {"base" | "lens"} body.token.chain - The blockchain network (base or lens)
 * @param {`0x${string}`} body.token.address - The token contract address
 * @param {Object} [body.token.metadata] - Optional token metadata
 * @param {string} [body.token.metadata.name] - Optional token name
 * @param {string} [body.token.metadata.symbol] - Optional token symbol
 * @param {string} [body.token.metadata.image] - Optional token image URL
 * @param {Object} body.params - Template parameters for the post
 * @param {string} body.params.templateName - Name of the template to use
 * @param {string} body.params.category - Category of the post
 * @param {any} body.params.templateData - Template-specific data
 * @param {boolean} [body.skipGeneration] - Optional flag to skip generation
 *
 * @returns {Promise<any | undefined>} The response from the API containing the created smart media post data
 *
 * @throws {Error} If the API request fails, including specific error for insufficient credits
 * @throws {Error} If the response status is not OK
 */
export const createSmartMedia = async (
  url: string,
  idToken: string,
  body: SmartMediaPostParams
): Promise<any | undefined> => {
  try {
    const response = await fetch(`${url}/post/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 403) {
        const errorText = await response.text();
        if (errorText.includes("not enough credits")) {
          throw new Error("not enough credits");
        }
      }
      throw new Error(`Create failed ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating:", error);
    throw error;
  }
};