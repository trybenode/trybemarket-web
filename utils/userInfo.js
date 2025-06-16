import { getDoc, doc  } from "firebase/firestore";
import {db} from "@/lib/firebase";

export const getUserInfo = async (userId) => {
    try {
        if (!userId) {
        throw new Error("User ID is required");
        }
        
        const userDoc = await getDoc(doc(db, "users", userId));
        
        if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
        } else {
        console.error("No user found with ID:", userId);
        return null;
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
        return null;
    }
}