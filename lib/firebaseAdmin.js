// import admin from "firebase-admin";
// // import path from "path";

// // const serviceAccount = require(
// //   path.join(process.cwd(), "markettrybe-cfed7-aeb679b5c606.json")
// // );

// if (!admin.apps.length) {
//   admin.initializeApp({
//     // credential: admin.credential.cert(serviceAccount),
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//     }),
//   });
// }

// const adminDB = admin.firestore();

// export { adminDB };
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

if (!admin.apps.length) {
  let credentials;

  // 1️⃣ Try loading local JSON if it exists
  const serviceAccountPath = path.join(process.cwd(), "markettrybe-cfed7-aeb679b5c606.json");
  if (fs.existsSync(serviceAccountPath)) {
    credentials = admin.credential.cert(require(serviceAccountPath));
    console.log("✅ Using service account JSON for Firebase Admin (local dev)");
  } else {
    // 2️⃣ Otherwise use env vars (Vercel or local .env.local)
    credentials = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    });
    console.log("✅ Using Firebase Admin env vars");
  }

  admin.initializeApp({ credential: credentials });
}

const adminDB = admin.firestore();

export { adminDB };
