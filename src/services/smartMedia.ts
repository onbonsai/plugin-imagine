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