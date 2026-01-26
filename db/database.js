import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    const dbPath = join(__dirname, '..', 'lead-reports.db');
    dbInstance = new Database(dbPath);
    
    // Initialize tables if they don't exist
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

function initializeDatabase(db) {
  // Create inspectors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  // Create inspector_variables table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspector_variables (
      inspector_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (inspector_id, variable_name),
      FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
    )
  `);

  // Create inspector_variable_names table (global variable names)
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspector_variable_names (
      variable_name TEXT PRIMARY KEY
    )
  `);

  // Create document_types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_types (
      type TEXT PRIMARY KEY,
      category TEXT NOT NULL
    )
  `);

  // Create general_variables table
  db.exec(`
    CREATE TABLE IF NOT EXISTS general_variables (
      variable_name TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      category TEXT NOT NULL,
      document_type TEXT,
      inspector_id TEXT,
      FOREIGN KEY (document_type) REFERENCES document_types(type),
      FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
    )
  `);
}
