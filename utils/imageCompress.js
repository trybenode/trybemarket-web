import imageCompression from 'browser-image-compression';

export async function compressImage(file) {
  const options = {
    maxSizeMB: 0.5, // compress to 500KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  };

  try {
    const compressed = await imageCompression(file, options);
    return compressed;
  } catch (error) {
    console.error("Image compression error:", error);
    throw error;
  }
}
