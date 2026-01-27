/**
 * Vercel Edge Config Storage Adapter
 * 
 * This replaces the SQLite database with Vercel Edge Config for Vercel deployments.
 * Edge Config is a key-value store that works at the edge.
 * 
 * Note: Edge Config has size limits (8KB per item, 8MB total)
 * For larger data, consider using Vercel KV or Vercel Postgres
 */

// Edge Config connection string from environment variable
// Format: https://edge-config.vercel.app/{edgeConfigId}?token={token}
// Note: @vercel/edge-config requires the connection string in EDGE_CONFIG env var

let edgeConfigModule: any = null;

// Lazy load Edge Config to avoid build errors if not available
async function getEdgeConfigModule() {
  if (edgeConfigModule !== null) {
    return edgeConfigModule;
  }
  
  try {
    // @ts-expect-error - @vercel/edge-config is optional and may not be installed
    edgeConfigModule = await import('@vercel/edge-config');
    return edgeConfigModule;
  } catch (error) {
    console.warn('@vercel/edge-config not available:', error);
    edgeConfigModule = false;
    return null;
  }
}

// Check if Edge Config is available
export async function isEdgeConfigAvailable(): Promise<boolean> {
  const module = await getEdgeConfigModule();
  if (!module) return false;
  
  // Check if EDGE_CONFIG environment variable is set
  return !!(process.env.EDGE_CONFIG || process.env.NEXT_PUBLIC_EDGE_CONFIG);
}

// Helper to get data from Edge Config
export async function getEdgeConfigValue<T = any>(key: string): Promise<T | null> {
  const module = await getEdgeConfigModule();
  if (!module || !(await isEdgeConfigAvailable())) {
    return null;
  }
  
  try {
    // @vercel/edge-config uses the connection string from EDGE_CONFIG env var automatically
    // The 'get' function is a top-level export that reads from the env var
    const { get } = module;
    
    // Check if we have the connection string
    const connectionString = process.env.EDGE_CONFIG || process.env.NEXT_PUBLIC_EDGE_CONFIG;
    if (!connectionString) {
      console.error('EDGE_CONFIG environment variable is not set');
      return null;
    }
    
    const value = await get(key);
    return value as T | null;
  } catch (error: any) {
    // If the key doesn't exist, that's okay - return null
    if (error?.message?.includes('not found') || error?.message?.includes('Edge Config not found')) {
      // This might mean the Edge Config is empty or the key doesn't exist
      // Return null instead of logging an error
      return null;
    }
    console.error(`Error getting Edge Config key "${key}":`, error?.message || error);
    return null;
  }
}

// Helper to get all keys with a prefix
export async function getEdgeConfigKeys(prefix: string): Promise<string[]> {
  if (!(await isEdgeConfigAvailable())) {
    return [];
  }
  
  try {
    // Edge Config doesn't support listing keys directly
    // We'll need to maintain a list of keys in a special key
    const keysList = await getEdgeConfigValue<string[]>(`__keys_${prefix}`);
    return keysList || [];
  } catch (error) {
    console.error(`Error getting Edge Config keys with prefix "${prefix}":`, error);
    return [];
  }
}

// Parse Edge Config connection string to extract ID and token
export function parseEdgeConfigConnection(): { edgeConfigId: string; token: string } | null {
  const connectionString = process.env.EDGE_CONFIG || process.env.NEXT_PUBLIC_EDGE_CONFIG;
  if (!connectionString) {
    return null;
  }
  
  try {
    // Format: https://edge-config.vercel.app/{edgeConfigId}?token={token}
    const url = new URL(connectionString);
    const edgeConfigId = url.pathname.split('/').pop();
    const token = url.searchParams.get('token');
    
    if (!edgeConfigId || !token) {
      return null;
    }
    
    return { edgeConfigId, token };
  } catch (error) {
    console.error('Error parsing Edge Config connection string:', error);
    return null;
  }
}

// Write to Edge Config using Vercel REST API
export async function setEdgeConfigValue(key: string, value: any): Promise<boolean> {
  if (!(await isEdgeConfigAvailable())) {
    return false;
  }
  
  const parsed = parseEdgeConfigConnection();
  if (!parsed) {
    console.error('Could not parse Edge Config connection string');
    return false;
  }
  
  try {
    // Get current items
    const currentItems = await getEdgeConfigItems(parsed);
    
    // Update the specific key
    const updatedItems = {
      ...currentItems,
      [key]: value
    };
    
    // Write all items back
    const response = await fetch(`https://api.vercel.com/v1/edge-config/${parsed.edgeConfigId}/items`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${parsed.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: Object.entries(updatedItems).map(([k, v]) => ({ key: k, value: v })) }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error writing to Edge Config: ${response.status} ${response.statusText}`, errorText);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error(`Error setting Edge Config key "${key}":`, error?.message || error);
    return false;
  }
}

// Get all items from Edge Config (for updating)
async function getEdgeConfigItems(parsed: { edgeConfigId: string; token: string }): Promise<Record<string, any>> {
  try {
    // Use Vercel API token - connection string token won't work for API calls
    const apiToken = process.env.VERCEL_API_TOKEN || process.env.NEXT_PUBLIC_VERCEL_API_TOKEN;
    
    if (!apiToken) {
      console.warn('No Vercel API token available for Edge Config read');
      return {};
    }
    
    // Validate that it's not the connection string token (they look similar but are different)
    if (apiToken === parsed.token) {
      console.error('❌ VERCEL_API_TOKEN is set to the Edge Config connection token!');
      console.error('   The connection token cannot be used for API writes.');
      console.error('   You need a separate Vercel API token from: https://vercel.com/dashboard → Settings → Tokens');
      return {};
    }
    
    const response = await fetch(`https://api.vercel.com/v1/edge-config/${parsed.edgeConfigId}/items`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });
    
    if (!response.ok) {
      // If Edge Config is empty, return empty object
      if (response.status === 404) {
        console.log('Edge Config is empty (404), starting fresh');
        return {};
      }
      const errorText = await response.text();
      console.error(`Failed to get Edge Config items: ${response.status}`, errorText);
      return {};
    }
    
    const data = await response.json();
    // Convert array of {key, value} to object
    const items: Record<string, any> = {};
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        items[item.key] = item.value;
      }
    }
    return items;
  } catch (error: any) {
    console.error('Error getting Edge Config items:', error?.message || error);
    return {};
  }
}

// Write multiple items at once (more efficient)
export async function setEdgeConfigValues(items: Record<string, any>): Promise<boolean> {
  if (!(await isEdgeConfigAvailable())) {
    return false;
  }
  
  const parsed = parseEdgeConfigConnection();
  if (!parsed) {
    console.error('Could not parse Edge Config connection string');
    return false;
  }
  
  try {
    // Use Vercel API token if available, otherwise try the connection string token
    const apiToken = process.env.VERCEL_API_TOKEN || process.env.NEXT_PUBLIC_VERCEL_API_TOKEN || parsed.token;
    
    if (!apiToken) {
      console.error('❌ No Vercel API token found. Set VERCEL_API_TOKEN in .env.local');
      console.error('   See EDGE_CONFIG_WRITE_SETUP.md for instructions');
      return false;
    }
    
    console.log(`📝 Writing ${Object.keys(items).length} items to Edge Config...`);
    console.log(`   Edge Config ID: ${parsed.edgeConfigId}`);
    console.log(`   API Token: ${apiToken.substring(0, 10)}... (length: ${apiToken.length})`);
    
    // Get current items
    const currentItems = await getEdgeConfigItems(parsed);
    console.log(`   Current items count: ${Object.keys(currentItems).length}`);
    
    // Merge with new items
    const updatedItems = {
      ...currentItems,
      ...items
    };
    
    console.log(`   Total items after merge: ${Object.keys(updatedItems).length}`);
    
    // Write all items back
    const itemsArray = Object.entries(updatedItems).map(([k, v]) => ({ key: k, value: v }));
    
    const response = await fetch(`https://api.vercel.com/v1/edge-config/${parsed.edgeConfigId}/items`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: itemsArray }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error writing to Edge Config: ${response.status} ${response.statusText}`);
      console.error(`   Error details:`, errorText);
      console.error(`   Edge Config ID: ${parsed.edgeConfigId}`);
      console.error(`   Items count: ${itemsArray.length}`);
      return false;
    }
    
    console.log(`✅ Successfully wrote ${itemsArray.length} items to Edge Config`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error setting Edge Config values:`, error?.message || error);
    console.error(`   Stack:`, error?.stack);
    return false;
  }
}

// Data structure helpers for Edge Config
// Since Edge Config is key-value, we'll structure data like:
// - inspectors:{id} -> inspector data
// - inspector_variables:{inspectorId}:{variableName} -> variable value
// - document_types:{type} -> category
// - general_variables:{name} -> value
// - documents:{id} -> document data

export const EdgeConfigKeys = {
  inspectors: (id: string) => `inspectors:${id}`,
  inspectorVariable: (inspectorId: string, variableName: string) => 
    `inspector_variables:${inspectorId}:${variableName}`,
  inspectorVariableNames: () => `inspector_variable_names`,
  documentType: (type: string) => `document_types:${type}`,
  generalVariable: (name: string) => `general_variables:${name}`,
  document: (id: string) => `documents:${id}`,
  // Metadata keys
  inspectorsList: () => `__metadata:inspectors`,
  documentsList: () => `__metadata:documents`,
};
