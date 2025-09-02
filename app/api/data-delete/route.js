import { collection, addDoc} from "firebase/firestore"
import { db } from "../../../lib/firebase"

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { email} = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      await addDoc(collection(db, "dataDeletionRequests"), {
        email,
        requestedAt: new Date().toISOString(),
      });

      return res.status(200).json({ message: "Request submitted" });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Failed to submit request" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}