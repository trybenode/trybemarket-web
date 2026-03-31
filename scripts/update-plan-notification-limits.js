/**
 * Add notification limits to subscription plans
 * 
 * This script updates all subscription plans in Firestore to include
 * daily notification limits in their features list and limits object.
 * 
 * Notification limits by tier:
 * - Free/Maintenance: 5 notifications/day
 * - Premium: 10 notifications/day
 * - VIP: 20 notifications/day
 * - Bundle: 20 notifications/day
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

// Notification limit mapping
const NOTIFICATION_LIMITS = {
  free: 5,
  maintenance: 5,
  premium: 10,
  vip: 20,
};

async function updatePlansWithNotificationLimits() {
  try {
    console.log('\n=== UPDATING SUBSCRIPTION PLANS WITH NOTIFICATION LIMITS ===\n');
    
    const plansRef = db.collection('subscriptionPlans');
    const snapshot = await plansRef.get();
    
    if (snapshot.empty) {
      console.log('No subscription plans found in database.');
      console.log('Please ensure plans are seeded first.');
      process.exit(1);
    }
    
    console.log(`Found ${snapshot.size} plans to update\n`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    for (const doc of snapshot.docs) {
      const plan = doc.data();
      const planType = plan.type || 'free';
      
      // Determine notification limit based on plan type
      let notificationLimit = NOTIFICATION_LIMITS[planType] || NOTIFICATION_LIMITS.free;
      
      // Bundle plans get VIP tier limits
      if (plan.category === 'bundle') {
        notificationLimit = NOTIFICATION_LIMITS.vip;
      }
      
      console.log(`📋 Plan: ${plan.name} (${plan.category}/${planType})`);
      console.log(`   Current features: ${plan.features?.length || 0} items`);
      
      // Add notification limit to features if not already there
      const features = plan.features || [];
      const notificationFeature = `${notificationLimit} email & WhatsApp notifications per day`;
      
      // Check if notification feature already exists
      const hasNotificationFeature = features.some(f => 
        f.toLowerCase().includes('notification')
      );
      
      let updatedFeatures = [...features];
      if (!hasNotificationFeature) {
        // Add notification feature (insert after 2nd item for better visibility)
        if (features.length >= 2) {
          updatedFeatures.splice(2, 0, notificationFeature);
        } else {
          updatedFeatures.push(notificationFeature);
        }
        console.log(`   ✅ Adding: "${notificationFeature}"`);
      } else {
        // Update existing notification feature to include both email & WhatsApp
        const notifIndex = features.findIndex(f => f.toLowerCase().includes('notification'));
        updatedFeatures[notifIndex] = notificationFeature;
        console.log(`   ✅ Updating: "${notificationFeature}"`);
      }
      
      // Update limits object
      const limits = plan.limits || {};
      const updatedLimits = {
        ...limits,
        dailyNotifications: notificationLimit
      };
      
      console.log(`   ✅ Setting limits.dailyNotifications = ${notificationLimit}`);
      
      // Update the document
      batch.update(doc.ref, {
        features: updatedFeatures,
        limits: updatedLimits
      });
      
      updateCount++;
      console.log('');
    }
    
    // Commit all updates
    console.log(`\n🔄 Committing updates to ${updateCount} plans...`);
    await batch.commit();
    
    console.log('\n✅ SUCCESS: All subscription plans updated with notification limits!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Plans updated: ${updateCount}`);
    console.log(`   - Free/Maintenance tier: 5 notifications/day`);
    console.log(`   - Premium tier: 10 notifications/day`);
    console.log(`   - VIP/Bundle tier: 20 notifications/day`);
    console.log(`   - Includes: Email & WhatsApp notifications`);
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating plans:', error);
    process.exit(1);
  }
}

// Run the update
updatePlansWithNotificationLimits();
