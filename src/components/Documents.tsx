import React, { useState } from 'react';
import { Upload, FileText, Plus, X, Folder, UserPlus, Trash2, FolderOpen, Edit2, Hash, Loader2, AlertCircle, Lock } from 'lucide-react';
import type { Inspector, Document } from '../types/documents';
import { flattenPdf } from '../utils/pdfGenerator';

interface DocumentsProps {
  inspectors: Inspector[];
  generalTypedDocuments: Map<string, Document>; // Map of documentType -> Document (one per type)
  inspectorDocuments: Map<string, Document[]>;
  generalDocumentTypes: string[]; // Document types for General section
  inspectorDocumentTypes: string[]; // Document types for Inspector section
  generalVariables: Map<string, string>;
  inspectorVariableNames: string[];
  onAddInspector: (inspector: Inspector) => void;
  onUpdateInspector: (inspectorId: string, updates: Partial<Inspector>) => void;
  onDeleteInspector: (inspectorId: string) => void;
  onUploadGeneralTypedDocument: (documentType: string, file: File) => void;
  onUploadInspectorDocument: (inspectorId: string, documentType: string, file: File) => void;
  onDeleteDocument: (documentId: string, category: 'general-typed' | 'inspector') => void;
  onAddGeneralDocumentType: (documentType: string) => void;
  onDeleteGeneralDocumentType: (documentType: string) => void;
  onAddInspectorDocumentType: (documentType: string) => void;
  onDeleteInspectorDocumentType: (documentType: string) => void;
  onAddGeneralVariable: (variableName: string, variableValue: string) => void;
  onUpdateGeneralVariable: (variableName: string, variableValue: string) => void;
  onDeleteGeneralVariable: (variableName: string) => void;
  onAddInspectorVariableName: (variableName: string) => void;
  onDeleteInspectorVariableName: (variableName: string) => void;
  onSetInspectorVariableValue: (inspectorId: string, variableName: string, variableValue: string) => void;
  onDeleteInspectorVariableValue: (inspectorId: string, variableName: string) => void;
  uploadingDocument?: { type: 'general-typed' | 'inspector'; inspectorId?: string; documentType?: string; fileName?: string } | null;
  uploadError?: string | null;
  onClearUploadError?: () => void;
}

export const Documents: React.FC<DocumentsProps> = ({
  inspectors,
  generalTypedDocuments,
  inspectorDocuments,
  generalDocumentTypes,
  inspectorDocumentTypes,
  generalVariables,
  inspectorVariableNames,
  onAddInspector,
  onUpdateInspector,
  onDeleteInspector,
  onUploadGeneralTypedDocument,
  onUploadInspectorDocument,
  onDeleteDocument,
  onAddGeneralDocumentType,
  onDeleteGeneralDocumentType,
  onAddInspectorDocumentType,
  onDeleteInspectorDocumentType,
  onAddGeneralVariable,
  onUpdateGeneralVariable,
  onDeleteGeneralVariable,
  onAddInspectorVariableName,
  onDeleteInspectorVariableName,
  onSetInspectorVariableValue,
  onDeleteInspectorVariableValue,
  uploadingDocument,
  uploadError,
  onClearUploadError,
}) => {
  const [showAddInspector, setShowAddInspector] = useState(false);
  const [newInspectorName, setNewInspectorName] = useState('');
  const [selectedInspector, setSelectedInspector] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  const [uploadingTo, setUploadingTo] = useState<{ type: 'general-typed' | 'inspector'; inspectorId?: string; documentType?: string } | null>(null);
  const [newDocumentType, setNewDocumentType] = useState('');
  const [newVariable, setNewVariable] = useState<{ name: string; value: string } | null>(null);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [flatteningPdf, setFlatteningPdf] = useState(false);

  const handleAddInspector = () => {
    if (newInspectorName.trim()) {
      const inspector: Inspector = {
        id: Date.now().toString(),
        name: newInspectorName.trim(),
      };
      onAddInspector(inspector);
      setNewInspectorName('');
      setShowAddInspector(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'general-typed' | 'inspector', inspectorId?: string, documentType?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file before processing
      console.log('📋 File selected in Documents component:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isFile: file instanceof File,
        hasName: !!file.name
      });

      if (file.size === 0) {
        alert(`Error: The file "${file.name}" is empty (0 bytes). Please select a valid file.`);
        e.target.value = '';
        return;
      }

      if (!file.name) {
        alert('Error: The selected file has no name. Please select a valid file.');
        e.target.value = '';
        return;
      }

      if (type === 'general-typed' && documentType) {
        onUploadGeneralTypedDocument(documentType, file);
      } else if (type === 'inspector' && inspectorId && documentType) {
        onUploadInspectorDocument(inspectorId, documentType, file);
      }
      setUploadingTo(null);
    }
    // Reset input AFTER processing (not before)
    e.target.value = '';
  };

  const getInspectorDocumentsByType = (inspectorId: string, documentType: string): Document[] => {
    const docs = inspectorDocuments.get(inspectorId) || [];
    return docs.filter(d => d.documentType === documentType);
  };

  const handleAddDocumentType = () => {
    if (newDocumentType.trim()) {
      if (selectedInspector === null) {
        // Adding to General
        onAddGeneralDocumentType(newDocumentType.trim());
      } else {
        // Adding to Inspector
        onAddInspectorDocumentType(newDocumentType.trim());
      }
      setNewDocumentType('');
    }
  };

  const handleFlattenPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = '';
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a PDF file');
      e.target.value = '';
      return;
    }

    setFlatteningPdf(true);
    try {
      await flattenPdf(file);
    } catch (error: any) {
      alert(`Failed to flatten PDF: ${error.message || 'Unknown error'}`);
      console.error('Flatten PDF error:', error);
    } finally {
      setFlatteningPdf(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-full animate-fade-in bg-slate-50 flex-col">
      {/* Upload Status Banner */}
      {uploadingDocument && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              Uploading {uploadingDocument.fileName} to R2...
            </p>
            <p className="text-xs text-blue-700">
              {uploadingDocument.type === 'general-typed' 
                ? `Type: ${uploadingDocument.documentType}`
                : `Inspector: ${inspectors.find(i => i.id === uploadingDocument.inspectorId)?.name || uploadingDocument.inspectorId}, Type: ${uploadingDocument.documentType}`}
            </p>
          </div>
        </div>
      )}
      
      {uploadError && !uploadingDocument && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Upload Failed</p>
            <p className="text-xs text-red-700 whitespace-pre-wrap">{uploadError}</p>
          </div>
          <button
            onClick={() => onClearUploadError?.()}
            className="text-red-600 hover:text-red-800"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      
      {/* Finder-style Column View */}
      <div className="flex-1 flex border-t border-slate-200 overflow-hidden">
        {/* Column 1: General / Inspectors */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">Folders</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Flatten PDF Button */}
            <div className="p-2 border-b border-slate-100">
              <label className="flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer font-medium">
                <Lock size={16} />
                {flatteningPdf ? 'Flattening...' : 'Flatten PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFlattenPdf}
                  disabled={flatteningPdf}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => {
                  setSelectedInspector(null);
                  setSelectedDocumentType(null);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedInspector === null && selectedDocumentType === null
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Folder size={16} />
                General
              </button>
            </div>
            <div className="p-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase px-2">Inspectors</h4>
                <button
                  onClick={() => setShowAddInspector(true)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                  title="Add Inspector"
                >
                  <Plus size={14} />
                </button>
              </div>
              {showAddInspector && (
                <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <input
                    type="text"
                    value={newInspectorName}
                    onChange={(e) => setNewInspectorName(e.target.value)}
                    placeholder="Inspector name"
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddInspector();
                      if (e.key === 'Escape') {
                        setShowAddInspector(false);
                        setNewInspectorName('');
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleAddInspector}
                      className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddInspector(false);
                        setNewInspectorName('');
                      }}
                      className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {inspectors.map((inspector) => (
                <button
                  key={inspector.id}
                  onClick={() => {
                    setSelectedInspector(inspector.id);
                    setSelectedDocumentType(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group ${
                    selectedInspector === inspector.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FolderOpen size={16} />
                  <span className="flex-1 text-left truncate">{inspector.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteInspector(inspector.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-600"
                  >
                    <X size={12} />
                  </button>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Document Types (when inspector selected) or General Documents */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">
              Document Types
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedInspector === null ? (
              <div className="p-2">
                {/* Document Type Folders for General */}
                {generalDocumentTypes.map((docType) => (
                  <button
                    key={docType}
                    onClick={() => {
                      setSelectedDocumentType(docType);
                      setSelectedInspector(null); // Ensure General is selected
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group ${
                      selectedInspector === null && selectedDocumentType === docType
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Folder size={16} />
                    <span className="flex-1 text-left">{docType}</span>
                    {generalTypedDocuments.has(docType) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Document exists" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGeneralDocumentType(docType);
                        if (selectedDocumentType === docType) {
                          setSelectedDocumentType(null);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  {newDocumentType ? (
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <input
                        type="text"
                        value={newDocumentType}
                        onChange={(e) => setNewDocumentType(e.target.value)}
                        placeholder="Type name"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddDocumentType();
                          }
                          if (e.key === 'Escape') {
                            setNewDocumentType('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddDocumentType}
                          className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setNewDocumentType('')}
                          className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewDocumentType('New Type')}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-green-600 hover:bg-green-50 font-medium"
                    >
                      <Plus size={14} />
                      Add Type
                    </button>
                  )}
                </div>
                
                {/* General Variables */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="px-2 mb-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">Variables</h4>
                  </div>
                  {Array.from(generalVariables.entries()).map(([varName, varValue]) => (
                    <div key={varName} className="p-2 mb-1 bg-slate-50 rounded text-sm group">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{varName}:</span>
                        {editingVariable === varName ? (
                          <input
                            type="text"
                            value={varValue}
                            onChange={(e) => {
                              onUpdateGeneralVariable(varName, e.target.value);
                              setEditingVariable(null);
                            }}
                            onBlur={() => setEditingVariable(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingVariable(null);
                              }
                            }}
                            className="flex-1 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                            autoFocus
                          />
                        ) : (
                          <>
                            <span className="flex-1 text-slate-600 truncate">{varValue}</span>
                            <button
                              onClick={() => setEditingVariable(varName)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-100 rounded text-blue-600"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => onDeleteGeneralVariable(varName)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-600"
                              title="Delete"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {newVariable ? (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                      <input
                        type="text"
                        value={newVariable.name}
                        onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                        placeholder="Variable name"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                      />
                      <input
                        type="text"
                        value={newVariable.value}
                        onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                        placeholder="Variable value"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newVariable.name.trim() && newVariable.value.trim()) {
                            onAddGeneralVariable(newVariable.name.trim(), newVariable.value.trim());
                            setNewVariable(null);
                          }
                          if (e.key === 'Escape') {
                            setNewVariable(null);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (newVariable.name.trim() && newVariable.value.trim()) {
                              onAddGeneralVariable(newVariable.name.trim(), newVariable.value.trim());
                              setNewVariable(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setNewVariable(null)}
                          className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewVariable({ name: '', value: '' })}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-blue-600 hover:bg-blue-50 font-medium"
                    >
                      <Plus size={14} />
                      Add Variable
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2">
                {inspectorDocumentTypes.map((docType) => (
                  <button
                    key={docType}
                    onClick={() => setSelectedDocumentType(docType)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group ${
                      selectedDocumentType === docType
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Folder size={16} />
                    <span className="flex-1 text-left">{docType}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInspectorDocumentType(docType);
                        if (selectedDocumentType === docType) {
                          setSelectedDocumentType(null);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  {newDocumentType ? (
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <input
                        type="text"
                        value={newDocumentType}
                        onChange={(e) => setNewDocumentType(e.target.value)}
                        placeholder="Type name"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddDocumentType();
                          }
                          if (e.key === 'Escape') {
                            setNewDocumentType('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddDocumentType}
                          className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setNewDocumentType('')}
                          className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewDocumentType('New Type')}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-green-600 hover:bg-green-50 font-medium"
                    >
                      <Plus size={14} />
                      Add Type
                    </button>
                  )}
                </div>
                
                {/* Inspector Variables */}
                {selectedInspector && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="px-2 mb-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase">Variables</h4>
                    </div>
                    {inspectorVariableNames.map((varName) => {
                      const inspector = inspectors.find(i => i.id === selectedInspector);
                      const varValue = inspector?.variableValues?.get(varName) || '';
                      const isEditing = editingVariable === varName;
                      
                      return (
                        <div key={varName} className="p-2 mb-1 bg-slate-50 rounded text-sm group">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{varName}:</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={varValue}
                                onChange={(e) => {
                                  onSetInspectorVariableValue(selectedInspector, varName, e.target.value);
                                }}
                                onBlur={() => setEditingVariable(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    setEditingVariable(null);
                                  }
                                }}
                                placeholder="Enter value"
                                className="flex-1 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                                autoFocus
                              />
                            ) : (
                              <>
                                <span className={`flex-1 truncate ${varValue ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                                  {varValue || '(not set)'}
                                </span>
                                <button
                                  onClick={() => setEditingVariable(varName)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-100 rounded text-blue-600"
                                  title={varValue ? "Edit" : "Set value"}
                                >
                                  <Edit2 size={12} />
                                </button>
                                {varValue && (
                                  <button
                                    onClick={() => onDeleteInspectorVariableValue(selectedInspector, varName)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-600"
                                    title="Clear value"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {newVariable ? (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                        <input
                          type="text"
                          value={newVariable.name}
                          onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                          placeholder="Variable name"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded mb-2 text-sm text-slate-900"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newVariable.name.trim()) {
                              onAddInspectorVariableName(newVariable.name.trim());
                              setNewVariable(null);
                            }
                            if (e.key === 'Escape') {
                              setNewVariable(null);
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (newVariable.name.trim()) {
                                onAddInspectorVariableName(newVariable.name.trim());
                                setNewVariable(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setNewVariable(null)}
                            className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewVariable({ name: '', value: '' })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-blue-600 hover:bg-blue-50 font-medium"
                      >
                        <Plus size={14} />
                        Add Variable
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Documents of selected type */}
        <div className="flex-1 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">
              {selectedInspector && selectedDocumentType
                ? `${inspectors.find(i => i.id === selectedInspector)?.name || ''} - ${selectedDocumentType}`
                : selectedInspector
                ? 'Select a document type'
                : selectedDocumentType
                ? `General - ${selectedDocumentType}`
                : 'General Documents'}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedInspector && selectedDocumentType ? (
              // Inspector's document type folder
              <div>
                {uploadingTo?.type === 'inspector' && uploadingTo.inspectorId === selectedInspector && uploadingTo.documentType === selectedDocumentType ? (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'inspector', selectedInspector, selectedDocumentType)}
                      className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      autoFocus
                    />
                    <button
                      onClick={() => setUploadingTo(null)}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUploadingTo({ type: 'inspector', inspectorId: selectedInspector, documentType: selectedDocumentType })}
                    className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Upload size={16} />
                    {getInspectorDocumentsByType(selectedInspector, selectedDocumentType).length > 0 ? 'Replace Document' : 'Upload Document'}
                  </button>
                )}
                <div className="space-y-2">
                  {getInspectorDocumentsByType(selectedInspector, selectedDocumentType).length === 0 ? (
                    <p className="text-slate-400 text-sm py-8 text-center">No documents in this folder</p>
                  ) : (
                    getInspectorDocumentsByType(selectedInspector, selectedDocumentType).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                      >
                        <FileText className="text-slate-400" size={18} />
                        <span className="flex-1 text-sm text-slate-900">{doc.fileName}</span>
                        <button
                          onClick={() => onDeleteDocument(doc.id, 'inspector')}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : selectedInspector ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-sm">Select a document type from the left</p>
              </div>
            ) : selectedDocumentType ? (
              // General document type folder (one document per type)
              <div>
                {uploadingTo?.type === 'general-typed' && uploadingTo.documentType === selectedDocumentType ? (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'general-typed', undefined, selectedDocumentType)}
                      className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      autoFocus
                    />
                    <button
                      onClick={() => setUploadingTo(null)}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUploadingTo({ type: 'general-typed', documentType: selectedDocumentType })}
                    className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Upload size={16} />
                    {generalTypedDocuments.has(selectedDocumentType) ? 'Replace Document' : 'Upload Document'}
                  </button>
                )}
                <div className="space-y-2">
                  {generalTypedDocuments.has(selectedDocumentType) ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                      <FileText className="text-slate-400" size={18} />
                      <span className="flex-1 text-sm text-slate-900">{generalTypedDocuments.get(selectedDocumentType)?.fileName}</span>
                      <button
                        onClick={() => {
                          const doc = generalTypedDocuments.get(selectedDocumentType);
                          if (doc) onDeleteDocument(doc.id, 'general-typed');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm py-8 text-center">No document in this folder</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-sm">Select a folder from the left</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
