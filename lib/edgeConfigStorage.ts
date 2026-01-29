/**
 * Edge Config Storage Implementation
 * 
 * This provides a storage layer using Vercel Edge Config.
 * Note: Edge Config is read-only via the SDK. To write data, you need to use:
 * 1. Vercel Dashboard
 * 2. Vercel API
 * 3. Edge Config API directly
 * 
 * For a production app, consider using Vercel KV (Redis) or Vercel Postgres
 * for read-write operations.
 */

import type { Document } from '../src/types/documents';
import { getEdgeConfigValue, EdgeConfigKeys, isEdgeConfigAvailable, setEdgeConfigValue, setEdgeConfigValues } from './edgeConfig';

// ==================== INSPECTORS ====================

export async function getAllInspectors() {
  if (!(await isEdgeConfigAvailable())) {
    return [];
  }
  
  try {
    const inspectorIds = await getEdgeConfigValue<string[]>(EdgeConfigKeys.inspectorsList());
    if (!inspectorIds || inspectorIds.length === 0) {
      return [];
    }
    
    const inspectors = await Promise.all(
      inspectorIds.map(async (id) => {
        const inspector = await getEdgeConfigValue<any>(EdgeConfigKeys.inspectors(id));
        if (!inspector) return null;
        
        // Get variables for this inspector
        const variableNames = await getEdgeConfigValue<string[]>(`__metadata:inspector_variables:${id}`);
        const variableValues: Map<string, string> = new Map();
        
        if (variableNames) {
          for (const varName of variableNames) {
            const value = await getEdgeConfigValue<string>(
              EdgeConfigKeys.inspectorVariable(id, varName)
            );
            if (value !== null) {
              variableValues.set(varName, value);
            }
          }
        }
        
        return {
          id: inspector.id,
          name: inspector.name,
          variableValues: variableValues.size > 0 ? variableValues : undefined
        };
      })
    );
    
    return inspectors.filter(i => i !== null);
  } catch (error) {
    console.error('Error getting all inspectors from Edge Config:', error);
    return [];
  }
}

export async function getInspectorById(id: string) {
  if (!(await isEdgeConfigAvailable())) {
    return null;
  }
  
  try {
    const inspector = await getEdgeConfigValue<any>(EdgeConfigKeys.inspectors(id));
    if (!inspector) return null;
    
    // Get variables
    const variableNames = await getEdgeConfigValue<string[]>(`__metadata:inspector_variables:${id}`);
    const variableValues: Map<string, string> = new Map();
    
    if (variableNames) {
      for (const varName of variableNames) {
        const value = await getEdgeConfigValue<string>(
          EdgeConfigKeys.inspectorVariable(id, varName)
        );
        if (value !== null) {
          variableValues.set(varName, value);
        }
      }
    }
    
    return {
      id: inspector.id,
      name: inspector.name,
      variableValues: variableValues.size > 0 ? variableValues : undefined
    };
  } catch (error) {
    console.error(`Error getting inspector ${id} from Edge Config:`, error);
    return null;
  }
}

// ==================== INSPECTOR VARIABLES ====================

export async function getAllInspectorVariableNames() {
  if (!(await isEdgeConfigAvailable())) {
    return [];
  }
  
  try {
    const names = await getEdgeConfigValue<string[]>(EdgeConfigKeys.inspectorVariableNames());
    return names || [];
  } catch (error) {
    console.error('Error getting inspector variable names from Edge Config:', error);
    return [];
  }
}

// ==================== DOCUMENT TYPES ====================

export async function getDocumentTypes(category: string) {
  if (!(await isEdgeConfigAvailable())) {
    return [];
  }
  
  try {
    const types = await getEdgeConfigValue<string[]>(`__metadata:document_types:${category}`);
    return types || [];
  } catch (error) {
    console.error(`Error getting document types for category ${category} from Edge Config:`, error);
    return [];
  }
}

export async function documentTypeExists(type: string): Promise<boolean> {
  if (!(await isEdgeConfigAvailable())) {
    return false;
  }
  
  try {
    const category = await getEdgeConfigValue<string>(EdgeConfigKeys.documentType(type));
    return category !== null;
  } catch (error) {
    console.error(`Error checking if document type ${type} exists in Edge Config:`, error);
    return false;
  }
}

export async function addDocumentType(type: string, category: string): Promise<boolean> {
  if (!(await isEdgeConfigAvailable())) {
    return false;
  }
  
  try {
    // Get current document types list for this category
    const categoryTypes = await getEdgeConfigValue<string[]>(`__metadata:document_types:${category}`) || [];
    
    const updates: Record<string, any> = {
      [EdgeConfigKeys.documentType(type)]: category
    };
    
    // Add to category list if not already there
    if (!categoryTypes.includes(type)) {
      updates[`__metadata:document_types:${category}`] = [...categoryTypes, type];
    }
    
    const success = await setEdgeConfigValues(updates);
    return success;
  } catch (error) {
    console.error(`Error adding document type ${type} to Edge Config:`, error);
    return false;
  }
}

// ==================== GENERAL VARIABLES ====================

export async function getAllGeneralVariables() {
  if (!(await isEdgeConfigAvailable())) {
    return new Map();
  }
  
  try {
    const variableNames = await getEdgeConfigValue<string[]>(`__metadata:general_variables`);
    const map = new Map<string, string>();
    
    if (variableNames) {
      for (const name of variableNames) {
        const value = await getEdgeConfigValue<string>(EdgeConfigKeys.generalVariable(name));
        if (value !== null) {
          map.set(name, value);
        }
      }
    }
    
    return map;
  } catch (error) {
    console.error('Error getting general variables from Edge Config:', error);
    return new Map();
  }
}

// ==================== DOCUMENTS ====================

export async function getGeneralTypedDocuments() {
  if (!(await isEdgeConfigAvailable())) {
    return new Map();
  }
  
  try {
    const documentIds = await getEdgeConfigValue<string[]>(`__metadata:documents:general-typed`);
    const map = new Map();
    
    if (documentIds) {
      for (const id of documentIds) {
        const doc = await getEdgeConfigValue<any>(EdgeConfigKeys.document(id));
        if (doc && doc.category === 'general-typed') {
          map.set(doc.document_type, {
            id: doc.id,
            fileName: doc.file_name,
            uploadedAt: new Date(doc.uploaded_at),
            category: doc.category,
            documentType: doc.document_type,
            filePath: doc.file_path
          });
        }
      }
    }
    
    return map;
  } catch (error) {
    console.error('Error getting general typed documents from Edge Config:', error);
    return new Map();
  }
}

export async function getInspectorDocuments() {
  if (!(await isEdgeConfigAvailable())) {
    return new Map();
  }
  
  try {
    const documentIds = await getEdgeConfigValue<string[]>(`__metadata:documents:inspector`);
    const map = new Map();
    
    if (documentIds) {
      for (const id of documentIds) {
        const doc = await getEdgeConfigValue<any>(EdgeConfigKeys.document(id));
        if (doc && doc.category === 'inspector') {
          const inspectorId = doc.inspector_id;
          if (!map.has(inspectorId)) {
            map.set(inspectorId, []);
          }
          map.get(inspectorId).push({
            id: doc.id,
            fileName: doc.file_name,
            uploadedAt: new Date(doc.uploaded_at),
            category: doc.category,
            inspectorId: doc.inspector_id,
            documentType: doc.document_type,
            filePath: doc.file_path
          });
        }
      }
    }
    
    return map;
  } catch (error) {
    console.error('Error getting inspector documents from Edge Config:', error);
    return new Map();
  }
}

export async function getDocumentById(id: string) {
  if (!(await isEdgeConfigAvailable())) {
    return null;
  }
  
  try {
    const doc = await getEdgeConfigValue<any>(EdgeConfigKeys.document(id));
    if (!doc) return null;
    
    return {
      id: doc.id,
      fileName: doc.file_name,
      uploadedAt: new Date(doc.uploaded_at),
      category: doc.category,
      documentType: doc.document_type,
      inspectorId: doc.inspector_id,
      filePath: doc.file_path
    };
  } catch (error) {
    console.error(`Error getting document ${id} from Edge Config:`, error);
    return null;
  }
}

export async function createDocument(id: string, fileName: string, filePath: string, category: 'general' | 'general-typed' | 'inspector', documentType?: string | null, inspectorId?: string | null): Promise<Omit<Document, 'file'> & { filePath: string } | null> {
  if (!(await isEdgeConfigAvailable())) {
    return null;
  }
  
  try {
    // Create document object (without file property since Edge Config only stores metadata)
    const document: Omit<Document, 'file'> & { filePath: string } = {
      id,
      fileName,
      filePath,
      uploadedAt: new Date(),
      category,
      documentType: documentType || undefined,
      inspectorId: inspectorId || undefined
    };
    
    // Get current metadata lists
    const documentsList = await getEdgeConfigValue<string[]>(EdgeConfigKeys.documentsList()) || [];
    const generalTypedList = await getEdgeConfigValue<string[]>(`__metadata:documents:general-typed`) || [];
    
    // Update lists
    const updates: Record<string, any> = {
      [EdgeConfigKeys.document(id)]: {
        id: document.id,
        file_name: document.fileName,
        file_path: document.filePath,
        uploaded_at: document.uploadedAt.toISOString(),
        category: document.category,
        document_type: document.documentType || null,
        inspector_id: document.inspectorId || null
      }
    };
    
    // Add to documents list if not already there
    if (!documentsList.includes(id)) {
      updates[EdgeConfigKeys.documentsList()] = [...documentsList, id];
    }
    
    // Add to category-specific list
    if (category === 'general-typed') {
      if (!generalTypedList.includes(id)) {
        updates[`__metadata:documents:general-typed`] = [...generalTypedList, id];
      }
    } else if (category === 'inspector' && inspectorId) {
      const inspectorDocList = await getEdgeConfigValue<string[]>(`__metadata:inspectorDocumentsIds:${inspectorId}`) || [];
      if (!inspectorDocList.includes(id)) {
        updates[`__metadata:inspectorDocumentsIds:${inspectorId}`] = [...inspectorDocList, id];
      }
    }
    
    // Write all updates
    const success = await setEdgeConfigValues(updates);
    if (!success) {
      console.error('Failed to write document to Edge Config');
      console.error('Document data:', { id, fileName, filePath, category, documentType, inspectorId });
      console.error('Updates to write:', Object.keys(updates));
      return null;
    }
    
    return document;
  } catch (error) {
    console.error('Error creating document in Edge Config:', error);
    return null;
  }
}

// ==================== ALL DATA ====================

export async function getAllData() {
  if (!(await isEdgeConfigAvailable())) {
    return {
      inspectors: [],
      generalVariables: [],
      inspectorVariableNames: [],
      generalTypedDocuments: [],
      inspectorDocuments: []
    };
  }
  
  try {
    const [inspectors, generalVariables, inspectorVariableNames, generalTypedDocuments, inspectorDocuments] = 
      await Promise.all([
        getAllInspectors(),
        getAllGeneralVariables(),
        getAllInspectorVariableNames(),
        getGeneralTypedDocuments(),
        getInspectorDocuments()
      ]);
    
    return {
      inspectors,
      generalVariables: Array.from(generalVariables.entries()),
      inspectorVariableNames,
      generalTypedDocuments: Array.from(generalTypedDocuments.entries()),
      inspectorDocuments: Array.from(inspectorDocuments.entries())
    };
  } catch (error) {
    console.error('Error getting all data from Edge Config:', error);
    return {
      inspectors: [],
      generalVariables: [],
      inspectorVariableNames: [],
      generalTypedDocuments: [],
      inspectorDocuments: []
    };
  }
}
