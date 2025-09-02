import admin from "firebase-admin";
import path from "path";

const serviceAccount = require(path.join(process.cwd(), "markettrybe-cfed7-aeb679b5c606.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const adminDB = admin.firestore();

export { adminDB };
