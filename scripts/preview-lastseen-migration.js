/**
 * Preview Script: Check which users need lastSeen field
 * 
 * Run this BEFORE the actual migration to see what would be updated.
 * This is a dry-run that shows statistics without making any changes.
 * 
 * Usage: npm run preview:lastseen
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

async function previewMigration() {
  console.log("👀 Previewing lastSeen migration (dry run)...\n");
  
  try {
    // Get all users
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log("❌ No users found in database.");
      return;
    }

    console.log(`📊 Analyzing ${snapshot.size} users...\n`);
    
    let withLastSeen = 0;
    let withoutLastSeen = 0;
    const usersToUpdate = [];
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      if (userData.lastSeen) {
        withLastSeen++;
      } else {
        withoutLastSeen++;
        usersToUpdate.push({
          id: doc.id,
          email: userData.email || 'N/A',
          fullName: userData.fullName || 'N/A',
          createdAt: userData.createdAt?.toDate?.() || 'Unknown'
        });
      }
    }
    
    // Summary
    console.log("=".repeat(60));
    console.log("📈 PREVIEW RESULTS");
    console.log("=".repeat(60));
    console.log(`Total users: ${snapshot.size}`);
    console.log(`✅ Already have lastSeen: ${withLastSeen}`);
    console.log(`⚠️  Need lastSeen added: ${withoutLastSeen}`);
    console.log("=".repeat(60));
    
    if (withoutLastSeen > 0) {
      console.log(`\n📝 Users that would be updated (showing first 10):\n`);
      usersToUpdate.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.fullName} (${user.email})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('');
      });
      
      if (withoutLastSeen > 10) {
        console.log(`... and ${withoutLastSeen - 10} more users\n`);
      }
      
      console.log("=".repeat(60));
      console.log("✨ To proceed with the actual migration, run:");
      console.log("   npm run migrate:lastseen");
      console.log("=".repeat(60));
    } else {
      console.log("\n✅ All users already have lastSeen field!");
      console.log("No migration needed.\n");
    }
    
  } catch (error) {
    console.error("\n💥 Preview failed:", error);
    process.exit(1);
  }
}

// Run preview
previewMigration()
  .then(() => {
    console.log("\n✨ Preview complete. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
