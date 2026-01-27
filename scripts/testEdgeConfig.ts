/**
 * Test script to verify Edge Config connection
 * Run with: npx tsx scripts/testEdgeConfig.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { isEdgeConfigAvailable, getEdgeConfigValue, EdgeConfigKeys } from '../lib/edgeConfig';

async function testEdgeConfig() {
  console.log('🔍 Testing Edge Config connection...\n');
  
  // Check if Edge Config is available
  const available = await isEdgeConfigAvailable();
  console.log(`✅ Edge Config Available: ${available}`);
  
  if (!available) {
    console.error('\n❌ Edge Config is not available!');
    console.log('\nTo set up Edge Config:');
    console.log('1. Make sure EDGE_CONFIG environment variable is set in .env.local');
    console.log('2. Format: EDGE_CONFIG=https://edge-config.vercel.app/{edgeConfigId}?token={token}');
    console.log('3. Or use: NEXT_PUBLIC_EDGE_CONFIG (same format)');
    process.exit(1);
  }
  
  console.log('\n📊 Testing Edge Config reads...\n');
  
  // Show the connection string (masked)
  const connectionString = process.env.EDGE_CONFIG || process.env.NEXT_PUBLIC_EDGE_CONFIG;
  if (connectionString) {
    const masked = connectionString.replace(/token=[^&]+/, 'token=***');
    console.log(`🔗 Connection String: ${masked}`);
  }
  
  // Test reading inspectors list
  const inspectorsList = await getEdgeConfigValue<string[]>(EdgeConfigKeys.inspectorsList());
  console.log(`📋 Inspectors List: ${inspectorsList ? `${inspectorsList.length} items` : 'empty (no data yet)'}`);
  if (inspectorsList && inspectorsList.length > 0) {
    console.log(`   First inspector ID: ${inspectorsList[0]}`);
  }
  
  // Test reading a document
  const documentsList = await getEdgeConfigValue<string[]>(EdgeConfigKeys.documentsList());
  console.log(`📄 Documents List: ${documentsList ? `${documentsList.length} items` : 'empty (no data yet)'}`);
  if (documentsList && documentsList.length > 0) {
    console.log(`   First document ID: ${documentsList[0]}`);
  }
  
  // Test reading document types
  const generalTypes = await getEdgeConfigValue<string[]>(`__metadata:document_types:general`);
  console.log(`📝 General Document Types: ${generalTypes ? `${generalTypes.length} types` : 'empty (no data yet)'}`);
  if (generalTypes && generalTypes.length > 0) {
    console.log(`   Types: ${generalTypes.join(', ')}`);
  }
  
  console.log('\n✅ Edge Config connection test completed successfully!');
  console.log('\n📝 Status:');
  console.log('   ✅ Edge Config is connected and available');
  if (!inspectorsList && !documentsList && !generalTypes) {
    console.log('   ⚠️  Edge Config is empty - no data has been added yet');
    console.log('   💡 To add data, use Vercel Dashboard or Vercel API');
  } else {
    console.log('   ✅ Edge Config contains data');
  }
  console.log('\n⚠️  Note: Edge Config is READ-ONLY via SDK.');
  console.log('   To write data, use Vercel Dashboard or Vercel API.');
}

testEdgeConfig().catch(console.error);
