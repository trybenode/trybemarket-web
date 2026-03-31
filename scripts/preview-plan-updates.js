/**
 * Preview notification limit updates for subscription plans
 * 
 * This script shows what changes will be made to each plan
 * WITHOUT actually updating the database.
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

const NOTIFICATION_LIMITS = {
  free: 5,
  maintenance: 5,
  premium: 10,
  vip: 20,
};

async function previewPlanUpdates() {
  try {
    console.log('\n=== PREVIEW: NOTIFICATION LIMIT UPDATES ===\n');
    
    const plansRef = db.collection('subscriptionPlans');
    const snapshot = await plansRef.get();
    
    if (snapshot.empty) {
      console.log('❌ No subscription plans found in database.');
      process.exit(1);
    }
    
    console.log(`Found ${snapshot.size} plans\n`);
    console.log('─'.repeat(80));
    
    for (const doc of snapshot.docs) {
      const plan = doc.data();
      const planType = plan.type || 'free';
      
      let notificationLimit = NOTIFICATION_LIMITS[planType] || NOTIFICATION_LIMITS.free;
      if (plan.category === 'bundle') {
        notificationLimit = NOTIFICATION_LIMITS.vip;
      }
      
      console.log(`\n📋 ${plan.name} (${plan.category}/${planType})`);
      console.log(`   Plan ID: ${doc.id}`);
      console.log(`   Price: ₦${plan.price?.toLocaleString() || 0}`);
      console.log(`   Cycle: ${plan.cycle || 'N/A'}`);
      
      // Check current state
      const features = plan.features || [];
      const limits = plan.limits || {};
      
      const hasNotificationFeature = features.some(f => 
        f.toLowerCase().includes('notification')
      );
      
      const hasLimitProperty = limits.dailyNotifications !== undefined;
      
      console.log(`\n   Current State:`);
      console.log(`   - Features count: ${features.length}`);
      console.log(`   - Has notification feature: ${hasNotificationFeature ? '✅' : '❌'}`);
      
      if (hasNotificationFeature) {
        const currentFeature = features.find(f => f.toLowerCase().includes('notification'));
        console.log(`     Current: "${currentFeature}"`);
      }
      
      console.log(`   - Has limits.dailyNotifications: ${hasLimitProperty ? '✅' : '❌'}`);
      
      if (hasLimitProperty) {
        console.log(`     Current value: ${limits.dailyNotifications}`);
      }
      
      console.log(`\n   Changes to be made:`);
      
      const newFeature = `${notificationLimit} email & WhatsApp notifications per day`;
      if (!hasNotificationFeature) {
        console.log(`   ✅ ADD to features: "${newFeature}"`);
      } else {
        console.log(`   ✅ UPDATE feature to: "${newFeature}"`);
      }
      
      if (!hasLimitProperty || limits.dailyNotifications !== notificationLimit) {
        console.log(`   ✅ SET limits.dailyNotifications = ${notificationLimit}`);
      } else {
        console.log(`   ⏭️  Limit already correct (${notificationLimit})`);
      }
      
      console.log('\n' + '─'.repeat(80));
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Total plans: ${snapshot.size}`);
    console.log('\n⚠️  This is a PREVIEW only. No changes have been made.');
    console.log('💡 Run "npm run update:plan-limits" to apply these changes.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error previewing updates:', error);
    process.exit(1);
  }
}

previewPlanUpdates();
