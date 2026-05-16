import cloudinary from "./cloudinary";

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const base64 = buffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    transformation: [{ width: 1200, crop: "limit", quality: "auto:good" }],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}
