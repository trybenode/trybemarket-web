import vision from "@google-cloud/vision";
import path from "path";

const keyPath = path.join(process.cwd(), "markettrybe-cfed7-aeb679b5c606.json");

const client = new vision.ImageAnnotatorClient({
  keyFilename: keyPath,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const [result] = await client.textDetection({
      image: { content: imageBase64 },
    });

    const detections = result.textAnnotations;
    const text = detections.length ? detections[0].description : "";

    return res.status(200).json({ text });
  } catch (error) {
    console.error("OCR Error:", error);
    return res.status(500).json({ error: "OCR failed" });
  }
}
