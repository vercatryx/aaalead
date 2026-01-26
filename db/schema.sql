-- =====================================================
-- PostgreSQL Schema for Lead Reports Application
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- Go to: Supabase Dashboard -> SQL Editor -> New Query
-- Paste this entire file and click "Run"
-- =====================================================

-- Drop tables if they exist (optional - only use if you want to start fresh)
-- DROP TABLE IF EXISTS documents CASCADE;
-- DROP TABLE IF EXISTS inspector_variables CASCADE;
-- DROP TABLE IF EXISTS inspector_variable_names CASCADE;
-- DROP TABLE IF EXISTS document_types CASCADE;
-- DROP TABLE IF EXISTS general_variables CASCADE;
-- DROP TABLE IF EXISTS inspectors CASCADE;

-- =====================================================
-- 1. Inspectors Table
-- =====================================================
-- Stores inspector information
CREATE TABLE IF NOT EXISTS inspectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- =====================================================
-- 2. Inspector Variables Table
-- =====================================================
-- Stores variable values for each inspector
CREATE TABLE IF NOT EXISTS inspector_variables (
  inspector_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (inspector_id, variable_name),
  FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. Inspector Variable Names Table
-- =====================================================
-- Global list of variable names (shared across all inspectors)
CREATE TABLE IF NOT EXISTS inspector_variable_names (
  variable_name TEXT PRIMARY KEY
);

-- =====================================================
-- 4. Document Types Table
-- =====================================================
-- Stores document types and their categories
CREATE TABLE IF NOT EXISTS document_types (
  type TEXT PRIMARY KEY,
  category TEXT NOT NULL
);

-- =====================================================
-- 5. General Variables Table
-- =====================================================
-- Stores general application variables (not inspector-specific)
CREATE TABLE IF NOT EXISTS general_variables (
  variable_name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- =====================================================
-- 6. Documents Table
-- =====================================================
-- Stores document metadata
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL,
  document_type TEXT,
  inspector_id TEXT,
  FOREIGN KEY (document_type) REFERENCES document_types(type) ON DELETE SET NULL,
  FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
);

-- =====================================================
-- Create Indexes for Better Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_inspector_variables_inspector_id ON inspector_variables(inspector_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_inspector_id ON documents(inspector_id);
CREATE INDEX IF NOT EXISTS idx_document_types_category ON document_types(category);

-- =====================================================
-- Verification Queries (Optional - run to verify tables)
-- =====================================================
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('inspectors', 'inspector_variables', 'inspector_variable_names', 'document_types', 'general_variables', 'documents')
-- ORDER BY table_name;

-- =====================================================
-- End of Schema
-- =====================================================
