// Enum values follow docs/DECISIONS.md D6 (lowercase codes; see diabeatis360-mobile/src/constants/enums.ts).
// Glucose_Logs field names match the app (DECISIONS.md D13).
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const now = Timestamp.now();

async function seed() {
  await db.collection('Users').add({
    email: 'test@example.com',
    full_name: 'Juan Dela Cruz',
    birthdate: now,
    activity_level: 'Active',
    dietary_preference: 'Everything',
    diabetes_type: 'Type 2',
    location: 'Cebu City',
    language_preference: 'English',
    created_at: now,
    is_active: true,
  });

  await db.collection('Guardian_Verifications').add({
    user_id: 'test123',
    guardian_full_name: 'Maria Dela Cruz',
    guardian_id_photo_url: 'test.jpg',
    relationship_to_minor: 'Parent',
    verification_status: 'pending',
    reviewed_by: 'test123',
    reviewed_at: now,
    submitted_at: now,
  });

  await db.collection('Providers').add({
    email: 'dr.test@example.com',
    full_name: 'Dr. Test',
    specialty: 'Endocrinology',
    prc_license_number: 'TEST-001',
    city: 'Cebu City',
    consultation_fee: 500.0,
    is_verified: false,
    verified_by: 'test123',
    created_at: now,
    is_active: true,
  });

  await db.collection('Admins').add({
    email: 'admin@test.com',
    full_name: 'Admin Test',
    role: 'super_admin',
    last_login: now,
    created_at: now,
  });

  await db.collection('Glucose_Logs').add({
    patient_id: 'test123',
    reading_mgdl: 120,
    context: 'before_meal',
    notes: 'Feeling normal',
    logged_at: now,
    created_at: now,
    interpretation: 'normal',
  });

  await db.collection('Food_Database').add({
    food_name: 'Rice',
    glycemic_index: 73,
    category: 'Grains',
    calories: 130,
    status: 'active',
    added_by_admin_id: 'test123',
  });

  await db.collection('AI_Suggestions').add({
    user_id: 'test123',
    suggestion_type: 'meal',
    prompt: 'Suggest a low-GI breakfast',
    response: 'Try oatmeal with berries',
    generated_at: now,
  });

  await db.collection('AI_Suggestions_Foods').add({
    suggestion_id: 'test123',
    food_id: 'test123',
  });

  await db.collection('Nutrition_Scans').add({
    user_id: 'test123',
    image_url: 'test.jpg',
    product_name: 'Instant Noodles',
    health_rating: 'caution',
    scanned_at: now,
  });

  await db.collection('Bookings').add({
    patient_id: 'test123',
    provider_id: 'test123',
    status: 'pending',
    scheduled_at: now,
    fee: 500.0,
    payment_status: 'unpaid',
    payment_method: null,
    queue_number: null,
    created_at: now,
  });

  await db.collection('Gamification').add({
    user_id: 'test123',
    streak_count: 0,
    total_points: 0,
    updated_at: now,
  });

  await db.collection('Badges').add({
    badge_name: 'First Log',
    badge_description: 'Logged your first glucose reading',
    criteria: '1 glucose log entry',
  });

  await db.collection('User_Badges').add({
    user_id: 'test123',
    badge_id: 'test123',
    earned_at: now,
  });

  await db.collection('Notifications').add({
    user_id: 'test123',
    notification_type: 'reminder',
    message: 'Time to log your glucose',
    scheduled_time: now,
    is_read: false,
    sent_at: now,
  });

  await db.collection('Subscription_Plans').add({
    plan_name: 'Premium Monthly',
    price: 99.0,
    duration_days: 30,
    created_at: now,
  });

  await db.collection('Subscriptions').add({
    user_id: 'test123',
    plan_id: 'test123',
    status: 'active',
    started_at: now,
    expires_at: now,
    created_at: now,
  });

  console.log('Seeding complete! All 16 collections created.');
}

seed().catch(console.error);