/**
 * Admin Security Test Script
 *
 * This script demonstrates how admin creation restrictions work
 * Run with: node test-admin-security.js
 */

const BASE_URL = 'http://localhost:3000';

async function testAdminSecurity() {
  console.log('🔒 Testing Admin Creation Security...\n');

  // Test 1: Check setup status
  console.log('1️⃣ Checking admin setup status...');
  try {
    const response = await fetch(
      `${BASE_URL}/api/auth/admin-setup/check-setup-status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const data = await response.json();
    console.log('Setup Status:', data);
  } catch (error) {
    console.log('❌ Setup status check failed:', error.message);
  }

  // Test 2: Try to create admin via regular signup (should fail)
  console.log(
    '\n2️⃣ Attempting admin creation via regular signup (should fail)...',
  );
  try {
    const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker@example.com',
        password: 'password123',
        name: 'Hacker',
        role: 'ADMIN',
      }),
    });
    const data = await response.json();
    console.log('Regular signup result:', data);
  } catch (error) {
    console.log('❌ Regular signup failed:', error.message);
  }

  // Test 3: Try to create admin via setup endpoint (should work if enabled)
  console.log('\n3️⃣ Attempting admin creation via setup endpoint...');
  try {
    const response = await fetch(
      `${BASE_URL}/api/auth/admin-setup/create-first-admin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@finderapp.com',
          password: 'SecurePassword123!',
          name: 'System Administrator',
        }),
      },
    );
    const data = await response.json();
    console.log('Setup endpoint result:', data);
  } catch (error) {
    console.log('❌ Setup endpoint failed:', error.message);
  }

  // Test 4: Try to create regular user (should work)
  console.log('\n4️⃣ Creating regular user (should work)...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123',
        name: 'Regular User',
        role: 'CLIENT',
      }),
    });
    const data = await response.json();
    console.log('Regular user creation result:', data);
  } catch (error) {
    console.log('❌ Regular user creation failed:', error.message);
  }

  console.log('\n✅ Admin security test completed!');
  console.log('\n📋 Summary:');
  console.log('- Admin creation via regular signup should be blocked');
  console.log(
    '- Admin creation via setup endpoint depends on environment settings',
  );
  console.log('- Regular user creation should work normally');
  console.log('\n🔧 To enable admin creation:');
  console.log('1. Set ALLOW_ADMIN_CREATION=true in your .env file');
  console.log('2. Restart your application');
  console.log('3. Use the setup endpoint to create the first admin');
  console.log('4. Set ALLOW_ADMIN_CREATION=false to secure the system');
}

// Run the test
testAdminSecurity().catch(console.error);
