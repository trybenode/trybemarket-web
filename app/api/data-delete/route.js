// import { collection, addDoc } from "firebase/firestore";
// import { db } from "@/lib/firebase";

// export async function POST(request) {
//   try {
//     const body = await request.json();
//     const { email } = body;

//     if (!email) {
//       return new Response(
//         JSON.stringify({ error: "Email is required" }),
//         { status: 400 }
//       );
//     }

//     await addDoc(collection(db, "dataDeletionRequests"), {
//       email,
//       requestedAt: new Date().toISOString(),
//     });

//     return new Response(
//       JSON.stringify({ message: "Request submitted" }),
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error:", error);
//     return new Response(
//       JSON.stringify({ error: "Failed to submit request" }),
//       { status: 500 }
//     );
//   }
// }

import { adminDB } from "@/lib/firebaseAdmin";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    await adminDB.collection("dataDeletionRequests").add({
      email,
      requestedAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ message: "Request submitted" }), { status: 200 });
  } catch (error) {
    // console.error("Error writing to Firestore:", error);
    return new Response(JSON.stringify({ success: false, error: "Failed to submit request" }), { status: 500 ,headers: { "Content-Type": "application/json" } });
  }
}

