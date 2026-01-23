export interface Inspector {
  id: string;
  name: string;
  variableValues?: Map<string, string>; // Variable values for this inspector (variableName -> value)
  // Document types are now shared globally, not per-inspector
  // Variables are also shared globally, but each inspector has their own values
}

export interface Document {
  id: string;
  fileName: string;
  file: File | Blob;
  uploadedAt: Date;
  category: 'general' | 'general-typed' | 'inspector';
  inspectorId?: string; // For inspector-specific documents
  documentType?: string; // Type of document (e.g., 'License', 'Signature')
}

export interface DocumentFolder {
  name: string;
  documents: Document[];
}
