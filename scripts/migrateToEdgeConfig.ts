/**
 * Migration Script: SQLite to Edge Config
 * 
 * This script exports data from SQLite and formats it for Edge Config.
 * You'll need to manually upload the output to Edge Config via Vercel API or Dashboard.
 * 
 * Usage:
 *   npx tsx scripts/migrateToEdgeConfig.ts > edge-config-data.json
 * 
 * Then use the Vercel API to upload:
 *   curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \
 *     -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d @edge-config-data.json
 */

import * as dbModels from '../db/models.js';
import { EdgeConfigKeys } from '../lib/edgeConfig';

interface EdgeConfigItem {
  key: string;
  value: any;
}

function migrate() {
  try {
    const data = dbModels.getAllData();
    const items: EdgeConfigItem[] = [];

    // 1. Inspectors
    const inspectorIds: string[] = [];
    for (const inspector of data.inspectors) {
      inspectorIds.push(inspector.id);
      items.push({
        key: EdgeConfigKeys.inspectors(inspector.id),
        value: {
          id: inspector.id,
          name: inspector.name
        }
      });

      // Inspector variables
      if (inspector.variableValues) {
        const variableNames: string[] = [];
        for (const [varName, varValue] of inspector.variableValues.entries()) {
          variableNames.push(varName);
          items.push({
            key: EdgeConfigKeys.inspectorVariable(inspector.id, varName),
            value: varValue
          });
        }
        if (variableNames.length > 0) {
          items.push({
            key: `__metadata:inspector_variables:${inspector.id}`,
            value: variableNames
          });
        }
      }
    }
    if (inspectorIds.length > 0) {
      items.push({
        key: EdgeConfigKeys.inspectorsList(),
        value: inspectorIds
      });
    }

    // 2. Inspector Variable Names (Global)
    if (data.inspectorVariableNames.length > 0) {
      items.push({
        key: EdgeConfigKeys.inspectorVariableNames(),
        value: data.inspectorVariableNames
      });
    }

    // 3. General Variables
    const generalVarNames: string[] = [];
    for (const [name, value] of data.generalVariables) {
      generalVarNames.push(name);
      items.push({
        key: EdgeConfigKeys.generalVariable(name),
        value: value
      });
    }
    if (generalVarNames.length > 0) {
      items.push({
        key: '__metadata:general_variables',
        value: generalVarNames
      });
    }

    // 4. Documents - General Typed
    const generalTypedDocIds: string[] = [];
    for (const [docType, doc] of data.generalTypedDocuments) {
      generalTypedDocIds.push(doc.id);
      items.push({
        key: EdgeConfigKeys.document(doc.id),
        value: {
          id: doc.id,
          file_name: doc.fileName,
          file_path: doc.filePath,
          uploaded_at: doc.uploadedAt.toISOString(),
          category: doc.category,
          document_type: doc.documentType,
          inspector_id: null
        }
      });
    }
    if (generalTypedDocIds.length > 0) {
      items.push({
        key: '__metadata:documents:general-typed',
        value: generalTypedDocIds
      });
    }

    // 5. Documents - Inspector
    const inspectorDocIds: string[] = [];
    for (const [inspectorId, docs] of data.inspectorDocuments) {
      for (const doc of docs) {
        inspectorDocIds.push(doc.id);
        items.push({
          key: EdgeConfigKeys.document(doc.id),
          value: {
            id: doc.id,
            file_name: doc.fileName,
            file_path: doc.filePath,
            uploaded_at: doc.uploadedAt.toISOString(),
            category: doc.category,
            document_type: doc.documentType,
            inspector_id: doc.inspectorId
          }
        });
      }
    }
    if (inspectorDocIds.length > 0) {
      items.push({
        key: '__metadata:documents:inspector',
        value: inspectorDocIds
      });
    }

    // Output as JSON for Vercel API
    const output = { items };
    console.log(JSON.stringify(output, null, 2));
    
    console.error(`\n✅ Migration complete! Generated ${items.length} items.`);
    console.error(`\n📤 To upload to Edge Config:`);
    console.error(`   1. Save this output to edge-config-data.json`);
    console.error(`   2. Run: curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \\`);
    console.error(`      -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \\`);
    console.error(`      -H "Content-Type: application/json" \\`);
    console.error(`      -d @edge-config-data.json`);
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    if (error.message?.includes('Database is not available')) {
      console.error('\n💡 Tip: Make sure you have a local SQLite database with data to migrate.');
    }
    process.exit(1);
  }
}

migrate();
