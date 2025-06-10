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