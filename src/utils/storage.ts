import type { Inspector, Document } from '../types/documents';
import { uploadFileToR2, getFileFromR2, deleteFileFromR2, generateR2Key, isR2Configured } from './r2Storage';

// JSON storage structure
export interface StorageData {
  inspectors: Array<{
    id: string;
    name: string;
    variableValues?: Array<[string, string]>; // Stored as array of [key, value] pairs
  }>;
  generalDocumentTypes: string[];
  inspectorDocumentTypes: string[];
  generalVariables: Array<[string, string]>; // Array of [key, value] pairs
  inspectorVariableNames: string[];
  generalTypedDocuments: Record<string, {
    id: string;
    fileName: string;
    uploadedAt: string; // ISO string
    category: 'general' | 'general-typed' | 'inspector';
    documentType?: string;
    filePath: string; // Path to the file
  }>;
  inspectorDocuments: Record<string, Array<{
    id: string;
    fileName: string;
    uploadedAt: string; // ISO string
    category: 'general' | 'general-typed' | 'inspector';
    inspectorId?: string;
    documentType?: string;
    filePath: string; // Path to the file
  }>>;
}

// Default storage data
const defaultStorageData: StorageData = {
  inspectors: [],
  generalDocumentTypes: [],
  inspectorDocumentTypes: ['License', 'Signature'],
  generalVariables: [],
  inspectorVariableNames: [],
  generalTypedDocuments: {},
  inspectorDocuments: {},
};

// IndexedDB setup
const DB_NAME = 'LeadReportsDB';
const DB_VERSION = 1;
const STORE_NAME = 'storage';

let db: IDBDatabase | null = null;

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Get storage data from IndexedDB
const getStorageFromDB = async (): Promise<StorageData> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('data');

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          resolve(data as StorageData);
        } else {
          resolve(defaultStorageData);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to read from IndexedDB'));
      };
    });
  } catch (error) {
    console.error('Error getting storage from DB:', error);
    return defaultStorageData;
  }
};

// Save storage data to IndexedDB
const saveStorageToDB = async (data: StorageData): Promise<void> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, 'data');

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save to IndexedDB'));
      };
    });
  } catch (error) {
    console.error('Error saving storage to DB:', error);
    throw error;
  }
};

// Current storage data cache
let currentStorageData: StorageData = defaultStorageData;

// Initialize storage - automatically loads from IndexedDB
export const initializeStorage = async (): Promise<void> => {
  try {
    currentStorageData = await getStorageFromDB();
    console.log('Storage initialized from IndexedDB');
  } catch (error) {
    console.error('Error initializing storage:', error);
    currentStorageData = defaultStorageData;
    await saveStorageToDB(defaultStorageData);
  }
};

// Load all data from storage
export const loadAllData = async (): Promise<StorageData> => {
  try {
    currentStorageData = await getStorageFromDB();
    return currentStorageData;
  } catch (error) {
    console.error('Error in loadAllData:', error);
    return currentStorageData;
  }
};

// Save all data to storage
export const saveAllData = async (data: StorageData): Promise<void> => {
  currentStorageData = data;
  await saveStorageToDB(data);
};

// Check if storage is initialized
export const isStorageInitialized = (): boolean => {
  return db !== null;
};

// Clear all storage data (reset to default)
export const clearAllStorage = async (): Promise<void> => {
  currentStorageData = defaultStorageData;
  await saveStorageToDB(defaultStorageData);
};

// Inspectors
export const loadInspectors = (): Inspector[] => {
  const data = currentStorageData;
  if (!data || !data.inspectors) {
    return [];
  }
  return data.inspectors.map(inspector => ({
    id: inspector.id,
    name: inspector.name,
    variableValues: inspector.variableValues ? new Map(inspector.variableValues) : undefined,
  }));
};

export const saveInspectors = async (inspectors: Inspector[]): Promise<void> => {
  const data = await loadAllData();
  data.inspectors = inspectors.map(inspector => ({
    id: inspector.id,
    name: inspector.name,
    variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined,
  }));
  await saveAllData(data);
};

// Inspector Variable Names
export const loadInspectorVariableNames = (): string[] => {
  return currentStorageData.inspectorVariableNames;
};

export const saveInspectorVariableNames = async (names: string[]): Promise<void> => {
  const data = await loadAllData();
  data.inspectorVariableNames = names;
  await saveAllData(data);
};

// Document Types
export const loadGeneralDocumentTypes = (): string[] => {
  return currentStorageData.generalDocumentTypes;
};

export const saveGeneralDocumentTypes = async (types: string[]): Promise<void> => {
  const data = await loadAllData();
  data.generalDocumentTypes = types;
  await saveAllData(data);
};

export const loadInspectorDocumentTypes = (): string[] => {
  return currentStorageData.inspectorDocumentTypes.length > 0 
    ? currentStorageData.inspectorDocumentTypes 
    : ['License', 'Signature'];
};

export const saveInspectorDocumentTypes = async (types: string[]): Promise<void> => {
  const data = await loadAllData();
  data.inspectorDocumentTypes = types;
  await saveAllData(data);
};

// Documents - load files ONLY from R2 (not from IndexedDB)
export const loadGeneralTypedDocuments = async (): Promise<Map<string, Omit<Document, 'file'> & { file?: Blob; filePath?: string }>> => {
  const data = await loadAllData();
  const map = new Map<string, Omit<Document, 'file'> & { file?: Blob; filePath?: string }>();
  
  for (const [docType, docData] of Object.entries(data.generalTypedDocuments)) {
    // Only load if filePath is an R2 key (starts with "documents/")
    // Skip old localStorage-based file paths
    if (!docData.filePath || !docData.filePath.startsWith('documents/')) {
      console.log(`Skipping document ${docData.id} - not in R2 storage (old localStorage data)`);
      continue; // Skip old documents not in R2
    }
    
    const doc: Omit<Document, 'file'> & { file?: Blob; filePath?: string } = {
      id: docData.id,
      fileName: docData.fileName,
      uploadedAt: new Date(docData.uploadedAt),
      category: docData.category,
      documentType: docData.documentType,
      filePath: docData.filePath,
    };
    
    // Load file from R2 only
    try {
      const r2Configured = await isR2Configured();
      if (r2Configured) {
        const file = await getFileFromR2(docData.filePath);
        doc.file = file;
        console.log(`Loaded file from R2 for document ${docData.id}: ${docData.fileName}`);
        map.set(docType, doc);
      } else {
        console.warn(`R2 not configured - skipping document ${docData.id}`);
      }
    } catch (error) {
      console.warn(`Failed to load file from R2 for ${docData.id}:`, error);
      // Don't add to map if file can't be loaded from R2
    }
  }
    
  return map;
};

export const saveGeneralTypedDocuments = async (documents: Map<string, Document>): Promise<void> => {
  const data = await loadAllData();
  data.generalTypedDocuments = {};
  
  for (const [docType, doc] of documents.entries()) {
    // Store file and get path
    const filePath = await storeFile(doc.file as File, doc.id);
    
    data.generalTypedDocuments[docType] = {
      id: doc.id,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt.toISOString(),
      category: doc.category,
      documentType: doc.documentType,
      filePath: filePath,
    };
  }
  
  await saveAllData(data);
};

export const loadInspectorDocuments = async (): Promise<Map<string, (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[]>> => {
  const data = await loadAllData();
  const map = new Map<string, (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[]>();
  
  for (const [inspectorId, docs] of Object.entries(data.inspectorDocuments)) {
    const loadedDocs: (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[] = [];
    
    for (const docData of docs) {
      // Only load if filePath is an R2 key (starts with "documents/")
      // Skip old localStorage-based file paths
      if (!docData.filePath || !docData.filePath.startsWith('documents/')) {
        console.log(`Skipping document ${docData.id} - not in R2 storage (old localStorage data)`);
        continue; // Skip old documents not in R2
      }
      
      const doc: Omit<Document, 'file'> & { file?: Blob; filePath?: string } = {
        id: docData.id,
        fileName: docData.fileName,
        uploadedAt: new Date(docData.uploadedAt),
        category: docData.category,
        inspectorId: docData.inspectorId,
        documentType: docData.documentType,
        filePath: docData.filePath,
      };
      
      // Load file from R2 only
      try {
        const r2Configured = await isR2Configured();
        if (r2Configured) {
          const file = await getFileFromR2(docData.filePath);
          doc.file = file;
          console.log(`Loaded file from R2 for document ${docData.id}: ${docData.fileName}`);
          loadedDocs.push(doc);
        } else {
          console.warn(`R2 not configured - skipping document ${docData.id}`);
        }
      } catch (error) {
        console.warn(`Failed to load file from R2 for ${docData.id}:`, error);
        // Don't add to array if file can't be loaded from R2
      }
    }
    
    if (loadedDocs.length > 0) {
      map.set(inspectorId, loadedDocs);
    }
  }
  
  return map;
};

export const saveInspectorDocuments = async (documents: Map<string, Document[]>): Promise<void> => {
  const data = await loadAllData();
  data.inspectorDocuments = {};
    
    for (const [inspectorId, docs] of documents.entries()) {
    data.inspectorDocuments[inspectorId] = await Promise.all(
      docs.map(async (doc) => {
        const filePath = await storeFile(doc.file as File, doc.id);
        return {
          id: doc.id,
          fileName: doc.fileName,
          uploadedAt: doc.uploadedAt.toISOString(),
          category: doc.category,
          inspectorId: doc.inspectorId,
          documentType: doc.documentType,
          filePath: filePath,
        };
      })
    );
  }
  
  await saveAllData(data);
};

// General Variables
export const loadGeneralVariables = (): Map<string, string> => {
  return new Map(currentStorageData.generalVariables);
};

export const saveGeneralVariables = async (variables: Map<string, string>): Promise<void> => {
  const data = await loadAllData();
  data.generalVariables = Array.from(variables.entries());
  await saveAllData(data);
};

// Store file and return R2 key
export const storeFile = async (file: File, docId: string): Promise<string> => {
  // Debug: Check what env vars are available
  const envCheck = {
    REACT_APP_R2_ENDPOINT: process.env.REACT_APP_R2_ENDPOINT ? '✅' : '❌',
    REACT_APP_R2_ACCESS_KEY_ID: process.env.REACT_APP_R2_ACCESS_KEY_ID ? '✅' : '❌',
    REACT_APP_R2_SECRET_ACCESS_KEY: process.env.REACT_APP_R2_SECRET_ACCESS_KEY ? '✅' : '❌',
    REACT_APP_R2_BUCKET_NAME: process.env.REACT_APP_R2_BUCKET_NAME ? '✅' : '❌',
  };
  console.log('🔍 Environment Variables Check in storeFile:', envCheck);
  console.log('🔍 All REACT_APP_R2_* env vars:', Object.keys(process.env).filter(k => k.startsWith('REACT_APP_R2')));
  
  const r2Configured = await isR2Configured();
  if (!r2Configured) {
    const missingVars: string[] = [];
    if (!process.env.REACT_APP_R2_ENDPOINT) missingVars.push('REACT_APP_R2_ENDPOINT');
    if (!process.env.REACT_APP_R2_ACCESS_KEY_ID) missingVars.push('REACT_APP_R2_ACCESS_KEY_ID');
    if (!process.env.REACT_APP_R2_SECRET_ACCESS_KEY) missingVars.push('REACT_APP_R2_SECRET_ACCESS_KEY');
    if (!process.env.REACT_APP_R2_BUCKET_NAME) missingVars.push('REACT_APP_R2_BUCKET_NAME');
    
    throw new Error(
      '❌ R2 storage is not configured!\n\n' +
      'Missing environment variables:\n' +
      missingVars.map(v => `  - ${v}`).join('\n') +
      '\n\nTo enable R2 uploads, add these to your .env.local file:\n' +
      '  REACT_APP_R2_ENDPOINT=your-r2-endpoint\n' +
      '  REACT_APP_R2_ACCESS_KEY_ID=your-access-key\n' +
      '  REACT_APP_R2_SECRET_ACCESS_KEY=your-secret-key\n' +
      '  REACT_APP_R2_BUCKET_NAME=your-bucket-name\n\n' +
      '⚠️ IMPORTANT: After adding these, you MUST restart your development server (stop and run npm start again).\n' +
      'Environment variables are only loaded when the dev server starts.'
    );
  }
  
  try {
    const r2Key = generateR2Key(docId, file.name);
    console.log(`📤 Uploading file to R2: ${file.name} -> ${r2Key}`);
    await uploadFileToR2(file, r2Key);
    console.log(`✅ Successfully uploaded to R2: ${r2Key}`);
    return r2Key;
  } catch (error: any) {
    console.error('❌ Error storing file to R2:', error);
    // Re-throw the error with context
    throw new Error(
      `Failed to store file "${file.name}" to R2 storage:\n\n${error.message || error}\n\n` +
      'File upload has been aborted. Please check your R2 configuration and try again.'
    );
  }
};

// Remove document storage from R2 and JSON
export const removeDocumentStorage = async (docId: string): Promise<void> => {
  const data = await loadAllData();
  let filePathToDelete: string | null = null;
  
  // Find and remove from general documents
  for (const [docType, docData] of Object.entries(data.generalTypedDocuments)) {
    if (docData.id === docId) {
      filePathToDelete = docData.filePath;
      delete data.generalTypedDocuments[docType];
      await saveAllData(data);
      break;
    }
  }
  
  // Find and remove from inspector documents
  if (!filePathToDelete) {
    for (const [inspectorId, docs] of Object.entries(data.inspectorDocuments)) {
      const docToDelete = docs.find(doc => doc.id === docId);
      if (docToDelete) {
        filePathToDelete = docToDelete.filePath;
        const filtered = docs.filter(doc => doc.id !== docId);
        data.inspectorDocuments[inspectorId] = filtered;
        await saveAllData(data);
        break;
      }
    }
  }
  
  // Delete file from R2 if configured and filePath is an R2 key
  if (filePathToDelete && filePathToDelete.startsWith('documents/')) {
    try {
      const r2Configured = await isR2Configured();
      if (r2Configured) {
        await deleteFileFromR2(filePathToDelete);
        console.log(`Deleted file from R2: ${filePathToDelete}`);
      }
    } catch (error) {
      console.warn(`Failed to delete file from R2: ${filePathToDelete}`, error);
      // Continue even if R2 deletion fails
    }
  }
};

// Export storage data to JSON file (for backup)
export const exportStorageData = async (): Promise<void> => {
  const data = await loadAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lead-reports-storage.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import storage data from JSON file
export const importStorageData = async (file: File): Promise<void> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as StorageData;
    
    // Validate the data structure
    if (!data.inspectors || !data.generalDocumentTypes || !data.inspectorDocumentTypes) {
      throw new Error('Invalid storage file format');
    }
    
    await saveAllData(data);
    // Reload current storage data
    currentStorageData = data;
  } catch (error) {
    console.error('Error importing storage file:', error);
    throw error;
  }
};
