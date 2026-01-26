import { getDatabaseSync, isDatabaseAvailable } from './database.js';

// Helper to safely call database functions
function safeDbCall(fn, defaultValue = null) {
  if (!isDatabaseAvailable()) {
    return defaultValue;
  }
  try {
    return fn();
  } catch (error) {
    console.error('Database error:', error);
    return defaultValue;
  }
}

// ==================== INSPECTORS ====================

export function getAllInspectors() {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const inspectors = db.prepare('SELECT * FROM inspectors').all();
    const variables = db.prepare('SELECT * FROM inspector_variables').all();
  
    // Group variables by inspector
    const variableMap = new Map();
    for (const v of variables) {
      if (!variableMap.has(v.inspector_id)) {
        variableMap.set(v.inspector_id, new Map());
      }
      variableMap.get(v.inspector_id).set(v.variable_name, v.value);
    }
  
    return inspectors.map(i => ({
      id: i.id,
      name: i.name,
      variableValues: variableMap.get(i.id) || undefined
    }));
  }, []);
}

export function getInspectorById(id) {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const inspector = db.prepare('SELECT * FROM inspectors WHERE id = ?').get(id);
    if (!inspector) return null;
    
    const variables = db.prepare('SELECT * FROM inspector_variables WHERE inspector_id = ?').all(id);
    const variableMap = new Map();
    for (const v of variables) {
      variableMap.set(v.variable_name, v.value);
    }
    
    return {
      id: inspector.id,
      name: inspector.name,
      variableValues: variableMap.size > 0 ? variableMap : undefined
    };
  }, null);
}

export function createInspector(id, name) {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    db.prepare('INSERT OR REPLACE INTO inspectors (id, name) VALUES (?, ?)').run(id, name);
    return getInspectorById(id);
  }, null);
}

export function updateInspector(id, name) {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const result = db.prepare('UPDATE inspectors SET name = ? WHERE id = ?').run(name, id);
    if (result.changes === 0) return null;
    return getInspectorById(id);
  }, null);
}

export function deleteInspector(id) {
  safeDbCall(() => {
    const db = getDatabaseSync();
    db.prepare('DELETE FROM inspectors WHERE id = ?').run(id);
  });
}

// ==================== INSPECTOR VARIABLES ====================

export function setInspectorVariable(inspectorId, variableName, value) {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO inspector_variables (inspector_id, variable_name, value) VALUES (?, ?, ?)')
    .run(inspectorId, variableName, value);
}

export function deleteInspectorVariable(inspectorId, variableName) {
  const db = getDatabase();
  db.prepare('DELETE FROM inspector_variables WHERE inspector_id = ? AND variable_name = ?')
    .run(inspectorId, variableName);
}

// ==================== INSPECTOR VARIABLE NAMES (Global) ====================

export function getAllInspectorVariableNames() {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const rows = db.prepare('SELECT variable_name FROM inspector_variable_names ORDER BY variable_name').all();
    return rows.map(r => r.variable_name);
  }, []);
}

export function addInspectorVariableName(variableName) {
  const db = getDatabase();
  try {
    db.prepare('INSERT INTO inspector_variable_names (variable_name) VALUES (?)').run(variableName);
    return true;
  } catch (error) {
    // Ignore if already exists
    if (error.message.includes('UNIQUE')) return false;
    throw error;
  }
}

export function deleteInspectorVariableName(variableName) {
  const db = getDatabase();
  // Delete from global list
  db.prepare('DELETE FROM inspector_variable_names WHERE variable_name = ?').run(variableName);
  // Delete all values for this variable
  db.prepare('DELETE FROM inspector_variables WHERE variable_name = ?').run(variableName);
}

// ==================== DOCUMENT TYPES ====================

export function getDocumentTypes(category) {
  const db = getDatabase();
  const rows = db.prepare('SELECT type FROM document_types WHERE category = ? ORDER BY type').all(category);
  return rows.map(r => r.type);
}

export function documentTypeExists(type) {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM document_types WHERE type = ?').get(type);
  return !!row;
}

export function addDocumentType(type, category) {
  const db = getDatabase();
  try {
    db.prepare('INSERT INTO document_types (type, category) VALUES (?, ?)').run(type, category);
    return true;
  } catch (error) {
    // Ignore if already exists
    if (error.message.includes('UNIQUE')) return false;
    throw error;
  }
}

export function deleteDocumentType(type) {
  const db = getDatabase();
  db.prepare('DELETE FROM document_types WHERE type = ?').run(type);
}

// ==================== GENERAL VARIABLES ====================

export function getAllGeneralVariables() {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const rows = db.prepare('SELECT * FROM general_variables').all();
    const map = new Map();
    for (const row of rows) {
      map.set(row.variable_name, row.value);
    }
    return map;
  }, new Map());
}

export function setGeneralVariable(variableName, value) {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO general_variables (variable_name, value) VALUES (?, ?)')
    .run(variableName, value);
}

export function deleteGeneralVariable(variableName) {
  const db = getDatabase();
  db.prepare('DELETE FROM general_variables WHERE variable_name = ?').run(variableName);
}

// ==================== DOCUMENTS ====================

export function getGeneralTypedDocuments() {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const rows = db.prepare('SELECT * FROM documents WHERE category = ?').all('general-typed');
    const map = new Map();
    for (const row of rows) {
      map.set(row.document_type, {
        id: row.id,
        fileName: row.file_name,
        uploadedAt: new Date(row.uploaded_at),
        category: row.category,
        documentType: row.document_type,
        filePath: row.file_path
      });
    }
    return map;
  }, new Map());
}

export function getInspectorDocuments() {
  return safeDbCall(() => {
    const db = getDatabaseSync();
    const rows = db.prepare('SELECT * FROM documents WHERE category = ?').all('inspector');
    const map = new Map();
    for (const row of rows) {
      const inspectorId = row.inspector_id;
      if (!map.has(inspectorId)) {
        map.set(inspectorId, []);
      }
      map.get(inspectorId).push({
        id: row.id,
        fileName: row.file_name,
        uploadedAt: new Date(row.uploaded_at),
        category: row.category,
        inspectorId: row.inspector_id,
        documentType: row.document_type,
        filePath: row.file_path
      });
    }
    return map;
  }, new Map());
}

export function getDocumentById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

export function getDocumentsByCategory(category, documentType, inspectorId) {
  const db = getDatabase();
  if (category === 'inspector' && inspectorId) {
    return db.prepare('SELECT * FROM documents WHERE category = ? AND document_type = ? AND inspector_id = ?')
      .all(category, documentType, inspectorId);
  }
  return db.prepare('SELECT * FROM documents WHERE category = ? AND document_type = ?')
    .all(category, documentType);
}

export function deleteDocumentByType(documentType, category) {
  const db = getDatabase();
  db.prepare('DELETE FROM documents WHERE document_type = ? AND category = ?').run(documentType, category);
}

export function createDocument(id, fileName, filePath, category, documentType, inspectorId) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO documents 
    (id, file_name, file_path, category, document_type, inspector_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, fileName, filePath, category, documentType || null, inspectorId || null);
  return getDocumentById(id);
}

export function deleteDocument(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

// ==================== ALL DATA ====================

export function getAllData() {
  return {
    inspectors: getAllInspectors(),
    generalVariables: Array.from(getAllGeneralVariables().entries()),
    inspectorVariableNames: getAllInspectorVariableNames(),
    generalTypedDocuments: Array.from(getGeneralTypedDocuments().entries()),
    inspectorDocuments: Array.from(getInspectorDocuments().entries())
  };
}
