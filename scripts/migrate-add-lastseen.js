/**
 * Migration Script: Add lastSeen field to all users
 * 
 * Run this ONCE before deploying the lastSeen feature to production.
 * This ensures all existing users have the lastSeen field initialized.
 * 
 * Usage: node scripts/migrate-add-lastseen.js
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

async function migrateLastSeen() {
  console.log("🚀 Starting lastSeen migration...\n");
  
  try {
    // Get all users
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log("❌ No users found in database.");
      return;
    }

    console.log(`📊 Found ${snapshot.size} users to process\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      // Check if user already has lastSeen
      if (userData.lastSeen) {
        skipped++;
        continue;
      }
      
      try {
        // Set lastSeen to current timestamp
        // This makes sense because we don't know when they were last active
        // Setting to "now" ensures the feature works immediately
        batch.update(doc.ref, {
          lastSeen: admin.firestore.FieldValue.serverTimestamp()
        });
        
        operationCount++;
        updated++;
        
        // Commit batch when reaching limit
        if (operationCount >= batchSize) {
          await batch.commit();
          console.log(`✅ Committed batch of ${operationCount} updates`);
          batch = db.batch();
          operationCount = 0;
        }
      } catch (error) {
        console.error(`❌ Error updating user ${doc.id}:`, error.message);
        errors++;
      }
    }
    
    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${operationCount} updates`);
    }
    
    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📈 MIGRATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total users: ${snapshot.size}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped (already had lastSeen): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("=".repeat(50));
    
    if (errors === 0) {
      console.log("\n🎉 Migration completed successfully!");
    } else {
      console.log("\n⚠️  Migration completed with some errors. Check logs above.");
    }
    
  } catch (error) {
    console.error("\n💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateLastSeen()
  .then(() => {
    console.log("\n✨ Script finished. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
