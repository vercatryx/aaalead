/**
 * Test script to verify Edge Config write functionality
 * Run with: npx tsx scripts/testEdgeConfigWrite.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { isEdgeConfigAvailable, getEdgeConfigValue, setEdgeConfigValue, setEdgeConfigValues, EdgeConfigKeys, parseEdgeConfigConnection } from '../lib/edgeConfig';

async function testEdgeConfigWrite() {
  console.log('🧪 Testing Edge Config Write Functionality...\n');
  
  // Check if Edge Config is available
  const available = await isEdgeConfigAvailable();
  console.log(`✅ Edge Config Available: ${available}`);
  
  if (!available) {
    console.error('\n❌ Edge Config is not available!');
    console.log('\nTo set up Edge Config:');
    console.log('1. Make sure EDGE_CONFIG environment variable is set in .env.local');
    console.log('2. Format: EDGE_CONFIG=https://edge-config.vercel.app/{edgeConfigId}?token={token}');
    process.exit(1);
  }
  
  // Check for Vercel API Token
  const apiToken = process.env.VERCEL_API_TOKEN || process.env.NEXT_PUBLIC_VERCEL_API_TOKEN;
  console.log(`🔑 Vercel API Token: ${apiToken ? `✅ Present (length: ${apiToken.length})` : '❌ Missing'}`);
  
  if (!apiToken) {
    console.error('\n❌ VERCEL_API_TOKEN is required for writes!');
    console.log('\nTo get your Vercel API token:');
    console.log('1. Go to https://vercel.com/dashboard');
    console.log('2. Settings → Tokens');
    console.log('3. Create a new token');
    console.log('4. Add to .env.local: VERCEL_API_TOKEN=your_token_here');
    process.exit(1);
  }
  
  // Parse connection string
  const parsed = parseEdgeConfigConnection();
  if (!parsed) {
    console.error('❌ Could not parse Edge Config connection string');
    process.exit(1);
  }
  
  console.log(`📋 Edge Config ID: ${parsed.edgeConfigId}`);
  console.log(`🔗 Connection Token: ${parsed.token.substring(0, 10)}... (length: ${parsed.token.length})`);
  console.log('');
  
  // Test 1: Read current items
  console.log('📖 Test 1: Reading current Edge Config items...');
  try {
    const testKey = '__test:write_test';
    const currentValue = await getEdgeConfigValue<string>(testKey);
    console.log(`   Current value for "${testKey}": ${currentValue || 'null (not set)'}`);
  } catch (error: any) {
    console.error(`   ❌ Error reading: ${error.message}`);
  }
  console.log('');
  
  // Test 2: Write a single value
  console.log('✍️  Test 2: Writing a single value...');
  const testValue = `test_${Date.now()}`;
  try {
    const success = await setEdgeConfigValue('__test:write_test', testValue);
    if (success) {
      console.log(`   ✅ Successfully wrote value: ${testValue}`);
      
      // Verify it was written
      const verifyValue = await getEdgeConfigValue<string>('__test:write_test');
      if (verifyValue === testValue) {
        console.log(`   ✅ Verified: Value matches (${verifyValue})`);
      } else {
        console.log(`   ⚠️  Warning: Value mismatch. Expected: ${testValue}, Got: ${verifyValue}`);
      }
    } else {
      console.log(`   ❌ Failed to write value`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error writing: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
  console.log('');
  
  // Test 3: Write multiple values
  console.log('✍️  Test 3: Writing multiple values...');
  try {
    const testItems = {
      '__test:multi_1': 'value1',
      '__test:multi_2': 'value2',
      '__test:multi_3': { nested: 'object', timestamp: Date.now() }
    };
    
    const success = await setEdgeConfigValues(testItems);
    if (success) {
      console.log(`   ✅ Successfully wrote ${Object.keys(testItems).length} items`);
      
      // Verify they were written
      for (const [key, expectedValue] of Object.entries(testItems)) {
        const verifyValue = await getEdgeConfigValue<any>(key);
        if (JSON.stringify(verifyValue) === JSON.stringify(expectedValue)) {
          console.log(`   ✅ Verified: ${key} matches`);
        } else {
          console.log(`   ⚠️  Warning: ${key} mismatch`);
          console.log(`      Expected: ${JSON.stringify(expectedValue)}`);
          console.log(`      Got: ${JSON.stringify(verifyValue)}`);
        }
      }
    } else {
      console.log(`   ❌ Failed to write multiple values`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error writing multiple values: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
  console.log('');
  
  // Test 4: Test document creation structure
  console.log('✍️  Test 4: Testing document creation structure...');
  try {
    const testDocument = {
      id: `test_doc_${Date.now()}`,
      file_name: 'test.pdf',
      file_path: 'documents/test/test.pdf',
      uploaded_at: new Date().toISOString(),
      category: 'general-typed',
      document_type: 'test',
      inspector_id: null
    };
    
    const documentKey = EdgeConfigKeys.document(testDocument.id);
    const success = await setEdgeConfigValue(documentKey, testDocument);
    
    if (success) {
      console.log(`   ✅ Successfully wrote document: ${testDocument.id}`);
      
      // Verify it was written
      const verifyDoc = await getEdgeConfigValue<any>(documentKey);
      if (verifyDoc && verifyDoc.id === testDocument.id) {
        console.log(`   ✅ Verified: Document matches`);
        console.log(`      File path: ${verifyDoc.file_path}`);
      } else {
        console.log(`   ⚠️  Warning: Document mismatch`);
      }
    } else {
      console.log(`   ❌ Failed to write document`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error writing document: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
  console.log('');
  
  // Test 5: Direct API call test
  console.log('🔧 Test 5: Direct Vercel API call test...');
  try {
    const response = await fetch(`https://api.vercel.com/v1/edge-config/${parsed.edgeConfigId}/items`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ API call successful`);
      console.log(`   Current items count: ${data.items?.length || 0}`);
    } else {
      const errorText = await response.text();
      console.error(`   ❌ API call failed: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
    }
  } catch (error: any) {
    console.error(`   ❌ API call error: ${error.message}`);
  }
  console.log('');
  
  console.log('✅ Edge Config write tests completed!');
  console.log('\n💡 If any tests failed, check:');
  console.log('   1. VERCEL_API_TOKEN is correct');
  console.log('   2. Token has write permissions');
  console.log('   3. Edge Config ID is correct');
  console.log('   4. Network connectivity to api.vercel.com');
}

testEdgeConfigWrite().catch(console.error);
