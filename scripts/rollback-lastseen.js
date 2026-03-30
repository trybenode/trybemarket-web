/**
 * Rollback Script: Remove lastSeen field from all users
 * 
 * ONLY use this if you need to undo the migration.
 * This will DELETE the lastSeen field from all users.
 * 
 * Usage: npm run rollback:lastseen
 * 
 * ⚠️  WARNING: This will remove lastSeen tracking!
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import readline from "readline";

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

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function rollbackLastSeen() {
  console.log("⚠️  ROLLBACK: Remove lastSeen field from all users\n");
  console.log("This will DELETE the lastSeen field from ALL users.");
  console.log("Notification debounce logic will stop working correctly.\n");
  
  const confirmed = await askConfirmation("Are you sure you want to proceed? Type 'yes' to continue: ");
  
  if (!confirmed) {
    console.log("\n❌ Rollback cancelled.");
    rl.close();
    process.exit(0);
  }
  
  console.log("\n🔄 Starting rollback...\n");
  
  try {
    // Get all users
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log("❌ No users found in database.");
      rl.close();
      return;
    }

    console.log(`📊 Found ${snapshot.size} users to process\n`);
    
    let removed = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      // Check if user has lastSeen
      if (!userData.lastSeen) {
        skipped++;
        continue;
      }
      
      try {
        // Remove lastSeen field
        batch.update(doc.ref, {
          lastSeen: admin.firestore.FieldValue.delete()
        });
        
        operationCount++;
        removed++;
        
        // Commit batch when reaching limit
        if (operationCount >= batchSize) {
          await batch.commit();
          console.log(`✅ Committed batch of ${operationCount} deletions`);
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
      console.log(`✅ Committed final batch of ${operationCount} deletions`);
    }
    
    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📈 ROLLBACK SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total users: ${snapshot.size}`);
    console.log(`✅ Removed lastSeen: ${removed}`);
    console.log(`⏭️  Skipped (no lastSeen): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("=".repeat(50));
    
    if (errors === 0) {
      console.log("\n✅ Rollback completed successfully!");
      console.log("⚠️  Warning: lastSeen tracking is now disabled.");
    } else {
      console.log("\n⚠️  Rollback completed with some errors. Check logs above.");
    }
    
  } catch (error) {
    console.error("\n💥 Rollback failed:", error);
    rl.close();
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run rollback
rollbackLastSeen()
  .then(() => {
    console.log("\n✨ Script finished. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    rl.close();
    process.exit(1);
  });
