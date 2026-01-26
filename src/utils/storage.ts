import type { Inspector, Document } from '../types/documents';
import { uploadFileToR2, getFileFromR2, deleteFileFromR2, generateR2Key, isR2Configured } from './r2Storage';
import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl();

// Helper function to make API calls
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    
    // Log detailed database errors to browser console
    if (errorData.dbError) {
      console.error('🔴 Database Error Details:', {
        endpoint,
        status: response.status,
        error: errorData.error,
        dbError: errorData.dbError,
        details: errorData.details,
        stack: errorData.stack,
        timestamp: errorData.timestamp,
      });
      
      // Log individual dbError properties for easier debugging
      if (errorData.dbError.message) {
        console.error('  └─ DB Error Message:', errorData.dbError.message);
      }
      if (errorData.dbError.code) {
        console.error('  └─ DB Error Code:', errorData.dbError.code);
      }
      if (errorData.dbError.errno) {
        console.error('  └─ DB Error Number:', errorData.dbError.errno);
      }
      if (errorData.dbError.syscall) {
        console.error('  └─ DB System Call:', errorData.dbError.syscall);
      }
      if (errorData.dbError.hostname) {
        console.error('  └─ DB Hostname:', errorData.dbError.hostname);
      }
      if (errorData.stack) {
        console.error('  └─ Stack Trace:', errorData.stack);
      }
    } else {
      // Log non-database errors
      console.error('🔴 API Error:', {
        endpoint,
        status: response.status,
        error: errorData.error || errorData.message,
        details: errorData.details,
        stack: errorData.stack,
      });
    }
    
    const error = new Error(errorData.error || errorData.message || `API call failed: ${response.statusText}`);
    (error as any).dbError = errorData.dbError;
    (error as any).details = errorData.details;
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
};

// JSON storage structure (for compatibility)
export interface StorageData {
  inspectors: Array<{
    id: string;
    name: string;
    variableValues?: Array<[string, string]>;
  }>;
  generalDocumentTypes: string[];
  inspectorDocumentTypes: string[];
  generalVariables: Array<[string, string]>;
  inspectorVariableNames: string[];
  generalTypedDocuments: Record<string, {
    id: string;
    fileName: string;
    uploadedAt: string;
    category: 'general' | 'general-typed' | 'inspector';
    documentType?: string;
    filePath: string;
  }>;
  inspectorDocuments: Record<string, Array<{
    id: string;
    fileName: string;
    uploadedAt: string;
    category: 'general' | 'general-typed' | 'inspector';
    inspectorId?: string;
    documentType?: string;
    filePath: string;
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

// Initialize storage - loads from database via API
export const initializeStorage = async (): Promise<void> => {
  try {
    // Test API connection
    await apiCall('/api/data');
    console.log('✅ Storage initialized from database');
  } catch (error) {
    console.error('Error initializing storage:', error);
    // Continue with defaults if API fails
  }
};

// Load all data from storage
export const loadAllData = async (): Promise<StorageData> => {
  try {
    const data = await apiCall('/api/data');
    return data;
  } catch (error) {
    console.error('Error in loadAllData:', error);
    return defaultStorageData;
  }
};

// Save all data to storage (not used with API, but kept for compatibility)
export const saveAllData = async (data: StorageData): Promise<void> => {
  // With API, we don't save all at once - individual operations handle saves
  console.warn('saveAllData called - this is not used with API storage');
};

// Check if storage is initialized
export const isStorageInitialized = (): boolean => {
  // Always return true for API storage
  return true;
};

// Clear all storage data (reset to default)
export const clearAllStorage = async (): Promise<void> => {
  // This would require a special endpoint - for now, just log
  console.warn('clearAllStorage called - not implemented for API storage');
};

// ==================== INSPECTORS ====================

export const loadInspectors = (): Inspector[] => {
  // This is synchronous in the old code, but we need async for API
  // For now, return empty array - callers should use async version
  return [];
};

export const loadInspectorsAsync = async (): Promise<Inspector[]> => {
  try {
    const inspectors = await apiCall('/api/inspectors');
    return inspectors.map((inspector: any) => ({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? new Map(inspector.variableValues) : undefined,
    }));
  } catch (error) {
    console.error('Error loading inspectors:', error);
    return [];
  }
};

export const saveInspectors = async (inspectors: Inspector[]): Promise<void> => {
  // Get all existing inspectors first to check which ones exist
  let existingInspectors: Inspector[] = [];
  try {
    existingInspectors = await apiCall('/api/inspectors');
  } catch (error) {
    console.warn('Error loading existing inspectors, will try to create/update anyway:', error);
  }
  
  const existingIds = new Set(existingInspectors.map(i => i.id));
  
  // Save each inspector individually
  for (const inspector of inspectors) {
    try {
      if (existingIds.has(inspector.id)) {
        // Inspector exists, update it
        await apiCall(`/api/inspectors/${inspector.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: inspector.name }),
        });
      } else {
        // Inspector doesn't exist, create it
        await apiCall('/api/inspectors', {
          method: 'POST',
          body: JSON.stringify({ id: inspector.id, name: inspector.name }),
        });
      }

      // Save variable values
      if (inspector.variableValues) {
        for (const [varName, varValue] of inspector.variableValues.entries()) {
          await apiCall(`/api/inspectors/${inspector.id}/variables/${encodeURIComponent(varName)}`, {
            method: 'PUT',
            body: JSON.stringify({ value: varValue }),
          });
        }
      }
    } catch (error) {
      console.error(`Error saving inspector ${inspector.id}:`, error);
      throw error; // Re-throw to surface the error
    }
  }
};

// ==================== INSPECTOR VARIABLE NAMES ====================

export const loadInspectorVariableNames = (): string[] => {
  // Synchronous version - return empty, use async version
  return [];
};

export const loadInspectorVariableNamesAsync = async (): Promise<string[]> => {
  try {
    return await apiCall('/api/inspector-variable-names');
  } catch (error) {
    console.error('Error loading inspector variable names:', error);
    return [];
  }
};

export const saveInspectorVariableNames = async (names: string[]): Promise<void> => {
  // Get current names and sync
  try {
    const current = await apiCall('/api/inspector-variable-names');
    const toAdd = names.filter((n: string) => !(current as string[]).includes(n));
    const toDelete = (current as string[]).filter((n: string) => !names.includes(n));

    for (const name of toAdd) {
      await apiCall('/api/inspector-variable-names', {
        method: 'POST',
        body: JSON.stringify({ variableName: name }),
      });
    }

    for (const name of toDelete) {
      await apiCall(`/api/inspector-variable-names/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
    }
  } catch (error) {
    console.error('Error saving inspector variable names:', error);
  }
};

// ==================== DOCUMENT TYPES ====================

export const loadGeneralDocumentTypes = (): string[] => {
  return [];
};

export const loadGeneralDocumentTypesAsync = async (): Promise<string[]> => {
  try {
    return await apiCall('/api/document-types/general');
  } catch (error) {
    console.error('Error loading general document types:', error);
    return [];
  }
};

export const saveGeneralDocumentTypes = async (types: string[]): Promise<void> => {
  try {
    const current = await apiCall('/api/document-types/general');
    const toAdd = types.filter((t: string) => !(current as string[]).includes(t));
    const toDelete = (current as string[]).filter((t: string) => !types.includes(t));

    for (const type of toAdd) {
      await apiCall('/api/document-types', {
        method: 'POST',
        body: JSON.stringify({ type, category: 'general' }),
      });
    }

    for (const type of toDelete) {
      await apiCall(`/api/document-types/${encodeURIComponent(type)}`, {
        method: 'DELETE',
      });
    }
  } catch (error) {
    console.error('Error saving general document types:', error);
  }
};

export const loadInspectorDocumentTypes = (): string[] => {
  return ['License', 'Signature'];
};

export const loadInspectorDocumentTypesAsync = async (): Promise<string[]> => {
  try {
    const types = await apiCall('/api/document-types/inspector');
    return types.length > 0 ? types : ['License', 'Signature'];
  } catch (error) {
    console.error('Error loading inspector document types:', error);
    return ['License', 'Signature'];
  }
};

export const saveInspectorDocumentTypes = async (types: string[]): Promise<void> => {
  try {
    const current = await apiCall('/api/document-types/inspector');
    const toAdd = types.filter((t: string) => !(current as string[]).includes(t));
    const toDelete = (current as string[]).filter((t: string) => !types.includes(t));

    for (const type of toAdd) {
      await apiCall('/api/document-types', {
        method: 'POST',
        body: JSON.stringify({ type, category: 'inspector' }),
      });
    }

    for (const type of toDelete) {
      await apiCall(`/api/document-types/${encodeURIComponent(type)}`, {
        method: 'DELETE',
      });
    }
  } catch (error) {
    console.error('Error saving inspector document types:', error);
  }
};

// ==================== DOCUMENTS ====================

export const loadGeneralTypedDocuments = async (): Promise<Map<string, Omit<Document, 'file'> & { file?: Blob; filePath?: string }>> => {
  try {
    const data = await apiCall('/api/documents/general-typed');
    const map = new Map<string, Omit<Document, 'file'> & { file?: Blob; filePath?: string }>();

    for (const [docType, docData] of Object.entries(data)) {
      const doc = docData as any;
      if (!doc.filePath || !doc.filePath.startsWith('documents/')) {
        console.warn(`⚠️ Document ${doc.id} (${doc.fileName}) has invalid or missing filePath: "${doc.filePath}". This document may have been uploaded before R2 storage was configured, or the filePath was lost. The document record exists in the database but the file link is broken.`);
        // Continue to next document - don't load this one
        continue;
      }

      const document: Omit<Document, 'file'> & { file?: Blob; filePath?: string } = {
        id: doc.id,
        fileName: doc.fileName,
        uploadedAt: new Date(doc.uploadedAt),
        category: doc.category,
        documentType: doc.documentType,
        filePath: doc.filePath,
      };

      try {
        const r2Configured = await isR2Configured();
        if (r2Configured) {
          const file = await getFileFromR2(doc.filePath);
          document.file = file;
          console.log(`Loaded file from R2 for document ${doc.id}: ${doc.fileName}`);
          map.set(docType, document);
        } else {
          console.warn(`R2 not configured - skipping document ${doc.id}`);
        }
      } catch (error) {
        console.warn(`Failed to load file from R2 for ${doc.id}:`, error);
      }
    }

    return map;
  } catch (error) {
    console.error('Error loading general typed documents:', error);
    return new Map();
  }
};

export const saveGeneralTypedDocuments = async (documents: Map<string, Document>): Promise<void> => {
  for (const [docType, doc] of documents.entries()) {
    try {
      // Use the ID from the document (it was already determined by checking the database in handleUploadGeneralTypedDocument)
      // This prevents UNIQUE constraint errors
      const documentIdToUse = doc.id;
      console.log(`📝 Using document ID ${documentIdToUse} for type "${docType}"`);

      // Store file and get path (use the ID we determined above for consistent R2 key)
      const filePath = await storeFile(doc.file as File, documentIdToUse);
      console.log(`📤 Uploaded file to R2: ${filePath}`);

      // Save document record to database (server will handle deleting old records with same type)
      await apiCall('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          id: documentIdToUse,
          fileName: doc.fileName,
          filePath: filePath,
          category: doc.category,
          documentType: doc.documentType,
        }),
      });
      
      console.log(`✅ Successfully saved general typed document "${docType}" with ID ${documentIdToUse} and filePath ${filePath}`);
    } catch (error) {
      console.error(`❌ Error saving general typed document "${docType}":`, error);
      throw error; // Re-throw to surface the error
    }
  }
};

export const loadInspectorDocuments = async (): Promise<Map<string, (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[]>> => {
  try {
    const data = await apiCall('/api/documents/inspector');
    const map = new Map<string, (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[]>();

    for (const [inspectorId, docs] of Object.entries(data)) {
      const documents = docs as any[];
      const loadedDocs: (Omit<Document, 'file'> & { file?: Blob; filePath?: string })[] = [];

      for (const docData of documents) {
        if (!docData.filePath || !docData.filePath.startsWith('documents/')) {
          console.warn(`⚠️ Document ${docData.id} (${docData.fileName}) has invalid or missing filePath: "${docData.filePath}". This document may have been uploaded before R2 storage was configured, or the filePath was lost. The document record exists in the database but the file link is broken.`);
          // Continue to next document - don't load this one
          continue;
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

        // Always add document to the list, even if file loading fails
        // This ensures documents in the database are visible
        try {
          const r2Configured = await isR2Configured();
          if (r2Configured && docData.filePath) {
            try {
              console.log(`📥 Loading file from R2 for document:`, {
                id: docData.id,
                fileName: docData.fileName,
                documentType: docData.documentType,
                filePath: docData.filePath
              });
              
              const file = await getFileFromR2(docData.filePath);
              
              // Validate file is not empty
              if (!file || file.size === 0) {
                throw new Error(`File loaded but is empty (0 bytes)`);
              }
              
              doc.file = file;
              console.log(`✅ Loaded file from R2 for document ${docData.id}: ${docData.fileName} (${file.size} bytes)`);
            } catch (fileError: any) {
              console.error(`❌ Failed to load file from R2 for ${docData.id} (${docData.fileName}):`, {
                error: fileError.message || fileError,
                filePath: docData.filePath
              });
              // Document is still added without the file - user can see it exists and can delete/reupload
            }
          } else {
            console.warn(`⚠️ R2 not configured or missing filePath - document ${docData.id} will be shown without file`, {
              r2Configured,
              hasFilePath: !!docData.filePath,
              filePath: docData.filePath || 'N/A'
            });
          }
        } catch (error: any) {
          console.warn(`⚠️ Error processing document ${docData.id}, but keeping it in list:`, error.message || error);
        }
        
        // Always add the document, even if file loading failed
        loadedDocs.push(doc);
      }

      if (loadedDocs.length > 0) {
        map.set(inspectorId, loadedDocs);
      }
    }

    return map;
  } catch (error) {
    console.error('Error loading inspector documents:', error);
    return new Map();
  }
};

export const saveInspectorDocuments = async (documents: Map<string, Document[]>): Promise<void> => {
  for (const [inspectorId, docs] of documents.entries()) {
    for (const doc of docs) {
      try {
        // Validate required fields before doing anything
        if (!doc.inspectorId || !doc.inspectorId.trim()) {
          throw new Error(`Inspector ID is missing or empty for document ${doc.id}. Cannot save inspector document without an inspector.`);
        }
        if (!doc.documentType || !doc.documentType.trim()) {
          throw new Error(`Document type is missing or empty for document ${doc.id}. Cannot save document without a document type.`);
        }

        // Verify inspector exists before proceeding
        try {
          const inspector = await apiCall(`/api/inspectors/${doc.inspectorId}`);
          if (!inspector || !inspector.id) {
            throw new Error(`Inspector with ID "${doc.inspectorId}" does not exist. Please create the inspector first.`);
          }
          console.log(`✅ Verified inspector "${doc.inspectorId}" exists: ${inspector.name}`);
        } catch (error: any) {
          if (error.message && error.message.includes('does not exist')) {
            throw error; // Re-throw our custom error
          }
          console.warn(`⚠️ Could not verify inspector ${doc.inspectorId}, but continuing:`, error);
        }

        // Use the ID from the document (it was already determined by checking the database in handleUploadInspectorDocument)
        // This prevents UNIQUE constraint errors
        const documentIdToUse = doc.id;
        console.log(`📝 Using document ID ${documentIdToUse} for inspector ${inspectorId}, type "${doc.documentType}"`);

        // Validate file before storing
        if (!doc.file) {
          throw new Error(`Document ${doc.id} (${doc.fileName}) has no file object. Cannot upload without a file.`);
        }

        // Check if file is a File or Blob
        if (!(doc.file instanceof File || doc.file instanceof Blob)) {
          throw new Error(`Document ${doc.id} (${doc.fileName}) has an invalid file object. Expected File or Blob, got ${typeof doc.file}.`);
        }

        // Validate file size
        const fileSize = doc.file.size;
        console.log(`📋 File validation in saveInspectorDocuments:`, {
          fileName: doc.fileName,
          fileSize: fileSize,
          fileType: doc.file.type || 'unknown',
          isFile: doc.file instanceof File,
          isBlob: doc.file instanceof Blob,
          hasName: doc.file instanceof File ? !!doc.file.name : false,
          actualFileName: doc.file instanceof File ? doc.file.name : 'N/A (Blob)'
        });

        if (fileSize === 0) {
          throw new Error(`Document ${doc.id} (${doc.fileName}) has an empty file (0 bytes). The file may have been corrupted during upload. Please try uploading again.`);
        }

        // Get file name - use doc.fileName if file.name is missing (for Blobs)
        const fileName = (doc.file instanceof File && doc.file.name) ? doc.file.name : doc.fileName;
        if (!fileName || fileName === 'undefined') {
          throw new Error(`Document ${doc.id} has no file name. Cannot generate R2 key without a file name.`);
        }

        // Store file and get path (use the ID we determined above for consistent R2 key)
        // Convert Blob to File if needed for storeFile
        let fileToUpload: File;
        if (doc.file instanceof File) {
          fileToUpload = doc.file;
        } else {
          // Convert Blob to File
          fileToUpload = new File([doc.file], fileName, { type: doc.file.type || 'application/octet-stream' });
        }

        const filePath = await storeFile(fileToUpload, documentIdToUse);
        console.log(`📤 Uploaded file to R2: ${filePath}`);

        // Save document record to database (server will handle deleting old records with same inspectorId and type)
        console.log(`💾 Saving document to database:`, {
          id: documentIdToUse,
          inspectorId: doc.inspectorId,
          documentType: doc.documentType,
          category: doc.category
        });
        
        await apiCall('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            id: documentIdToUse,
            fileName: doc.fileName,
            filePath: filePath,
            category: doc.category,
            inspectorId: doc.inspectorId,
            documentType: doc.documentType,
          }),
        });
        
        console.log(`✅ Successfully saved inspector document for ${inspectorId}, type "${doc.documentType}" with ID ${documentIdToUse} and filePath ${filePath}`);
      } catch (error) {
        console.error(`❌ Error saving inspector document ${doc.id}:`, error);
        throw error; // Re-throw to surface the error
      }
    }
  }
};

// ==================== GENERAL VARIABLES ====================

export const loadGeneralVariables = (): Map<string, string> => {
  return new Map();
};

export const loadGeneralVariablesAsync = async (): Promise<Map<string, string>> => {
  try {
    const variables = await apiCall('/api/general-variables');
    return new Map(variables);
  } catch (error) {
    console.error('Error loading general variables:', error);
    return new Map();
  }
};

export const saveGeneralVariables = async (variables: Map<string, string>): Promise<void> => {
  try {
    const current = await apiCall('/api/general-variables');
    const currentMap = new Map(current);
    const toAdd = Array.from(variables.entries()).filter(([k]) => !currentMap.has(k));
    const toUpdate = Array.from(variables.entries()).filter(([k, v]) => currentMap.get(k) !== v);
    const toDelete = Array.from(currentMap.keys()).filter((k) => !variables.has(k as string));

    for (const [name, value] of [...toAdd, ...toUpdate]) {
      await apiCall(`/api/general-variables/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    }

    for (const name of toDelete) {
      await apiCall(`/api/general-variables/${encodeURIComponent(name as string)}`, {
        method: 'DELETE',
      });
    }
  } catch (error) {
    console.error('Error saving general variables:', error);
  }
};

// ==================== FILE STORAGE ====================

export const storeFile = async (file: File, docId: string): Promise<string> => {
  // In Next.js, client-side code can only access NEXT_PUBLIC_* variables
  // But the actual R2 upload happens via API routes (server-side), so we don't need to check env vars here
  // Just try to upload and let the API handle the error if R2 is not configured
  // The API routes can access both REACT_APP_* and NEXT_PUBLIC_* variables

  try {
    // Validate file has a name - use fallback if missing
    const fileName = file.name || (file instanceof File ? 'unnamed-file' : 'blob-file');
    if (!fileName || fileName === 'undefined') {
      throw new Error('File name is missing or invalid. Cannot upload file without a name.');
    }
    
    // Validate file size
    if (file.size === 0) {
      throw new Error('File is empty (0 bytes). Cannot upload empty file.');
    }
    
    const r2Key = generateR2Key(docId, fileName);
    console.log(`📤 Uploading file to R2: ${fileName} -> ${r2Key}`);
    await uploadFileToR2(file, r2Key);
    console.log(`✅ Successfully uploaded to R2: ${r2Key}`);
    return r2Key;
  } catch (error: any) {
    console.error('❌ Error storing file to R2:', error);
    const fileName = file.name || 'unknown file';
    throw new Error(
      `Failed to store file "${fileName}" to R2 storage:\n\n${error.message || error}\n\n` +
      'File upload has been aborted. Please check your R2 configuration and try again.'
    );
  }
};

export const removeDocumentStorage = async (docId: string): Promise<void> => {
  try {
    // Get document info first
    const doc = await apiCall(`/api/documents/${docId}`).catch(() => null);
    
    if (doc && doc.filePath && doc.filePath.startsWith('documents/')) {
      try {
        const r2Configured = await isR2Configured();
        if (r2Configured) {
          await deleteFileFromR2(doc.filePath);
          console.log(`Deleted file from R2: ${doc.filePath}`);
        }
      } catch (error) {
        console.warn(`Failed to delete file from R2: ${doc.filePath}`, error);
      }
    }

    // Delete from database
    await apiCall(`/api/documents/${docId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error removing document storage:', error);
  }
};

// ==================== EXPORT/IMPORT (for backup) ====================

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

export const importStorageData = async (file: File): Promise<void> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as StorageData;

    if (!data.inspectors || !data.generalDocumentTypes || !data.inspectorDocumentTypes) {
      throw new Error('Invalid storage file format');
    }

    // Import all data
    await saveInspectors(data.inspectors.map(i => ({
      id: i.id,
      name: i.name,
      variableValues: i.variableValues ? new Map(i.variableValues) : undefined,
    })));
    await saveGeneralDocumentTypes(data.generalDocumentTypes);
    await saveInspectorDocumentTypes(data.inspectorDocumentTypes);
    await saveGeneralVariables(new Map(data.generalVariables));
    await saveInspectorVariableNames(data.inspectorVariableNames);

    // Documents would need to be re-uploaded since we only store metadata
    console.log('Note: Documents need to be re-uploaded after import');
  } catch (error) {
    console.error('Error importing storage file:', error);
    throw error;
  }
};
