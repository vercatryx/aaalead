import { getDatabase, getDatabaseSync, isDatabaseAvailable } from './database.js';

// Helper to safely call database functions with retry logic
async function safeDbCall(fn, defaultValue = null, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Always try to get the database - it will initialize if needed
      const pool = await getDatabase();
      if (!pool) {
        console.warn('Database pool is null, returning default value');
        return defaultValue;
      }
      return await fn();
    } catch (error) {
      // Check if it's a connection pool exhaustion error
      const isPoolExhausted = error.message && (
        error.message.includes('max clients reached') ||
        error.message.includes('MaxClientsInSessionMode') ||
        error.message.includes('too many clients')
      );
      
      if (isPoolExhausted && attempt < retries - 1) {
        // Wait with exponential backoff before retrying
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(`Database pool exhausted, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error('Database error:', error);
      // Re-throw with detailed information for API error responses
      const enhancedError = new Error(error.message || 'Database operation failed');
      // Add dbError property (JavaScript-compatible syntax)
      enhancedError.dbError = {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        stack: error.stack,
        originalError: error.toString(),
      };
      throw enhancedError;
    }
  }
  return defaultValue;
}

// ==================== INSPECTORS ====================

export async function getAllInspectors() {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const inspectorsResult = await pool.query('SELECT * FROM inspectors');
    const variablesResult = await pool.query('SELECT * FROM inspector_variables');
  
    // Group variables by inspector
    const variableMap = new Map();
    for (const v of variablesResult.rows) {
      if (!variableMap.has(v.inspector_id)) {
        variableMap.set(v.inspector_id, new Map());
      }
      variableMap.get(v.inspector_id).set(v.variable_name, v.value);
    }
  
    return inspectorsResult.rows.map(i => ({
      id: i.id,
      name: i.name,
      variableValues: variableMap.get(i.id) || undefined
    }));
  }, []);
}

export async function getInspectorById(id) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const inspectorResult = await pool.query('SELECT * FROM inspectors WHERE id = $1', [id]);
    if (inspectorResult.rows.length === 0) return null;
    
    const inspector = inspectorResult.rows[0];
    const variablesResult = await pool.query('SELECT * FROM inspector_variables WHERE inspector_id = $1', [id]);
    const variableMap = new Map();
    for (const v of variablesResult.rows) {
      variableMap.set(v.variable_name, v.value);
    }
    
    return {
      id: inspector.id,
      name: inspector.name,
      variableValues: variableMap.size > 0 ? variableMap : undefined
    };
  }, null);
}

export async function createInspector(id, name) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    await pool.query(
      'INSERT INTO inspectors (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2',
      [id, name]
    );
    return await getInspectorById(id);
  }, null);
}

export async function updateInspector(id, name) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const result = await pool.query('UPDATE inspectors SET name = $1 WHERE id = $2', [name, id]);
    if (result.rowCount === 0) return null;
    return await getInspectorById(id);
  }, null);
}

export async function deleteInspector(id) {
  await safeDbCall(async () => {
    const pool = await getDatabase();
    await pool.query('DELETE FROM inspectors WHERE id = $1', [id]);
  });
}

// ==================== INSPECTOR VARIABLES ====================

export async function setInspectorVariable(inspectorId, variableName, value) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    await pool.query(
      'INSERT INTO inspector_variables (inspector_id, variable_name, value) VALUES ($1, $2, $3) ON CONFLICT (inspector_id, variable_name) DO UPDATE SET value = $3',
      [inspectorId, variableName, value]
    );
    return true;
  }, false);
}

export async function deleteInspectorVariable(inspectorId, variableName) {
  const pool = await getDatabase();
  await pool.query('DELETE FROM inspector_variables WHERE inspector_id = $1 AND variable_name = $2', [inspectorId, variableName]);
}

// ==================== INSPECTOR VARIABLE NAMES (Global) ====================

export async function getAllInspectorVariableNames() {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const result = await pool.query('SELECT variable_name FROM inspector_variable_names ORDER BY variable_name');
    return result.rows.map(r => r.variable_name);
  }, []);
}

export async function addInspectorVariableName(variableName) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    try {
      await pool.query('INSERT INTO inspector_variable_names (variable_name) VALUES ($1)', [variableName]);
      return true;
    } catch (error) {
      // Ignore if already exists
      if (error.code === '23505') return false; // Unique violation
      throw error;
    }
  }, false);
}

export async function deleteInspectorVariableName(variableName) {
  const pool = await getDatabase();
  // Delete from global list
  await pool.query('DELETE FROM inspector_variable_names WHERE variable_name = $1', [variableName]);
  // Delete all values for this variable
  await pool.query('DELETE FROM inspector_variables WHERE variable_name = $1', [variableName]);
}

// ==================== DOCUMENT TYPES ====================

export async function getDocumentTypes(category) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const result = await pool.query('SELECT type FROM document_types WHERE category = $1 ORDER BY type', [category]);
    return result.rows.map(r => r.type);
  }, []);
}

export async function documentTypeExists(type) {
  const pool = await getDatabase();
  const result = await pool.query('SELECT 1 FROM document_types WHERE type = $1', [type]);
  return result.rows.length > 0;
}

export async function addDocumentType(type, category) {
  const pool = await getDatabase();
  try {
    await pool.query('INSERT INTO document_types (type, category) VALUES ($1, $2)', [type, category]);
    return true;
  } catch (error) {
    // Ignore if already exists
    if (error.code === '23505') return false; // Unique violation
    throw error;
  }
}

export async function deleteDocumentType(type) {
  const pool = await getDatabase();
  await pool.query('DELETE FROM document_types WHERE type = $1', [type]);
}

// ==================== GENERAL VARIABLES ====================

export async function getAllGeneralVariables() {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const result = await pool.query('SELECT * FROM general_variables');
    const map = new Map();
    for (const row of result.rows) {
      map.set(row.variable_name, row.value);
    }
    return map;
  }, new Map());
}

export async function setGeneralVariable(variableName, value) {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    await pool.query(
      'INSERT INTO general_variables (variable_name, value) VALUES ($1, $2) ON CONFLICT (variable_name) DO UPDATE SET value = $2',
      [variableName, value]
    );
    return true;
  }, false);
}

export async function deleteGeneralVariable(variableName) {
  const pool = await getDatabase();
  await pool.query('DELETE FROM general_variables WHERE variable_name = $1', [variableName]);
}

// ==================== DOCUMENTS ====================

export async function getGeneralTypedDocuments() {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    const result = await pool.query('SELECT * FROM documents WHERE category = $1', ['general-typed']);
    const map = new Map();
    for (const row of result.rows) {
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

export async function getInspectorDocuments() {
  return safeDbCall(async () => {
    const pool = await getDatabase();
    // Filter out documents with null inspector_id to avoid grouping issues
    const result = await pool.query(
      'SELECT * FROM documents WHERE category = $1 AND inspector_id IS NOT NULL ORDER BY uploaded_at DESC', 
      ['inspector']
    );
    const map = new Map();
    for (const row of result.rows) {
      const inspectorId = row.inspector_id;
      // Skip if inspector_id is still null (shouldn't happen with the query, but be safe)
      if (!inspectorId) {
        console.warn(`Skipping document ${row.id} with null inspector_id`);
        continue;
      }
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

export async function getDocumentById(id) {
  const pool = await getDatabase();
  const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getDocumentsByCategory(category, documentType, inspectorId) {
  const pool = await getDatabase();
  if (category === 'inspector' && inspectorId) {
    const result = await pool.query(
      'SELECT * FROM documents WHERE category = $1 AND document_type = $2 AND inspector_id = $3',
      [category, documentType, inspectorId]
    );
    return result.rows;
  }
  const result = await pool.query(
    'SELECT * FROM documents WHERE category = $1 AND document_type = $2',
    [category, documentType]
  );
  return result.rows;
}

export async function deleteDocumentByType(documentType, category) {
  const pool = await getDatabase();
  await pool.query('DELETE FROM documents WHERE document_type = $1 AND category = $2', [documentType, category]);
}

export async function createDocument(id, fileName, filePath, category, documentType, inspectorId) {
  const pool = await getDatabase();
  await pool.query(
    `INSERT INTO documents 
     (id, file_name, file_path, category, document_type, inspector_id) 
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET 
       file_name = $2, 
       file_path = $3, 
       category = $4, 
       document_type = $5, 
       inspector_id = $6`,
    [id, fileName, filePath, category, documentType || null, inspectorId || null]
  );
  return await getDocumentById(id);
}

export async function deleteDocument(id) {
  const pool = await getDatabase();
  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
}

// ==================== ALL DATA ====================

export async function getAllData() {
  const inspectors = await getAllInspectors();
  const generalVariables = await getAllGeneralVariables();
  const inspectorVariableNames = await getAllInspectorVariableNames();
  const generalTypedDocuments = await getGeneralTypedDocuments();
  const inspectorDocuments = await getInspectorDocuments();
  
  return {
    inspectors: inspectors,
    generalVariables: Array.from(generalVariables.entries()),
    inspectorVariableNames: inspectorVariableNames,
    generalTypedDocuments: Array.from(generalTypedDocuments.entries()),
    inspectorDocuments: Array.from(inspectorDocuments.entries())
  };
}
