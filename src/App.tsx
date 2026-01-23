import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { StepUpload } from './components/StepUpload';
import { StepConfirmation } from './components/StepConfirmation';
import { StepGeneration } from './components/StepGeneration';
import { Documents } from './components/Documents';
import type { Inspector, Document } from './types/documents';
import {
  loadInspectors,
  saveInspectors,
  loadGeneralDocumentTypes,
  saveGeneralDocumentTypes,
  loadInspectorDocumentTypes,
  saveInspectorDocumentTypes,
  loadGeneralTypedDocuments,
  saveGeneralTypedDocuments,
  loadInspectorDocuments,
  saveInspectorDocuments,
  removeDocumentStorage,
  loadGeneralVariables,
  saveGeneralVariables,
  loadInspectorVariableNames,
  saveInspectorVariableNames,
  loadAllData,
  isStorageInitialized,
  initializeStorage,
} from './utils/storage';

// Types
export type ReportType = 'XHR' | 'CERTIF' | null;
export type AppStep = 'upload' | 'confirmation' | 'generation';

export interface ExtractedData {
  fileName: string;
  rawData: any[];
  address: string;
  inspectorName: string;
  isPositive?: boolean;
  totalReadings?: number;
  positiveReadings?: number;
  fullExcelData?: any[][]; // Full Excel data including header row
  headerRowIndex?: number;
  selectedInspectorId?: string; // ID of the inspector who performed the inspection
  certificateDocumentType?: string; // Document type for general certificate
  licenseDocumentType?: string; // Document type for inspector license
}

function App() {
  const [reportType, setReportType] = useState<ReportType>(null);
  const [step, setStep] = useState<AppStep>('upload');
  const [currentView, setCurrentView] = useState<'reports' | 'documents'>('reports');

  const [data, setData] = useState<ExtractedData>({
    fileName: '',
    rawData: [],
    address: '',
    inspectorName: '',
    isPositive: false,
    totalReadings: 0,
    positiveReadings: 0
  });

  // Documents and Inspectors state
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [generalTypedDocuments, setGeneralTypedDocuments] = useState<Map<string, Document>>(new Map()); // General documents by type (one per type)
  const [inspectorDocuments, setInspectorDocuments] = useState<Map<string, Document[]>>(new Map());
  const [generalDocumentTypes, setGeneralDocumentTypes] = useState<string[]>([]); // Document types for General section
  const [inspectorDocumentTypes, setInspectorDocumentTypes] = useState<string[]>(['License', 'Signature']); // Document types for Inspector section
  const [generalVariables, setGeneralVariables] = useState<Map<string, string>>(new Map()); // General variables (name -> value)
  const [inspectorVariableNames, setInspectorVariableNames] = useState<string[]>([]); // Global variable names (shared across all inspectors)
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState<{ type: 'general-typed' | 'inspector'; inspectorId?: string; documentType?: string; fileName?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Initialize storage and load data on mount
  useEffect(() => {
    const initAndLoadData = async () => {
      try {
        // Initialize storage from IndexedDB (no user interaction needed)
        await initializeStorage();

        // Load from storage
        const allData = await loadAllData();
        console.log('Loaded storage data:', {
          inspectorCount: allData.inspectors?.length || 0,
          inspectors: allData.inspectors
        });

        // Load individual data
        const [loadedInspectors, loadedGeneralTypes, loadedInspectorTypes, loadedGeneralDocs, loadedInspectorDocs, loadedGeneralVars, loadedInspectorVarNames] = await Promise.all([
          Promise.resolve(loadInspectors()),
          Promise.resolve(loadGeneralDocumentTypes()),
          Promise.resolve(loadInspectorDocumentTypes()),
          loadGeneralTypedDocuments(),
          loadInspectorDocuments(),
          Promise.resolve(loadGeneralVariables()),
          Promise.resolve(loadInspectorVariableNames()),
        ]);

        console.log('Loaded inspectors:', loadedInspectors);
        setInspectors(loadedInspectors);
        setGeneralDocumentTypes(loadedGeneralTypes);
        setInspectorDocumentTypes(loadedInspectorTypes);
        setGeneralVariables(loadedGeneralVars);
        setInspectorVariableNames(loadedInspectorVarNames);
        
        // Convert loaded documents back to Document type (files will need to be loaded separately)
        const generalDocsMap = new Map<string, Document>();
        for (const [key, doc] of loadedGeneralDocs.entries()) {
          // Note: Files are stored by path, so we'll need to load them when needed
          // For now, we'll keep the metadata
          generalDocsMap.set(key, { ...doc, file: doc.file || new Blob() } as Document);
        }
        setGeneralTypedDocuments(generalDocsMap);

        const inspectorDocsMap = new Map<string, Document[]>();
        for (const [inspectorId, docs] of loadedInspectorDocs.entries()) {
          const fullDocs = docs.map(d => ({ ...d, file: d.file || new Blob() } as Document));
          inspectorDocsMap.set(inspectorId, fullDocs);
        }
        setInspectorDocuments(inspectorDocsMap);
      } catch (error: any) {
        console.error('Error initializing storage or loading data:', error);
        setInitError(error?.message || 'Failed to initialize application');
        // Even if there's an error, set loading to false so the app can render
        // The app will work with empty/default data
      } finally {
        setIsLoading(false);
      }
    };

    initAndLoadData();
  }, []);


  const handleReportSelect = (type: ReportType) => {
    // If switching report types, reset data
    setReportType(type);
    setStep('upload');
    setCurrentView('reports'); // Switch to reports view when selecting a report
    if (type !== reportType) {
      setData({ fileName: '', rawData: [], address: '', inspectorName: '', isPositive: false, totalReadings: 0, positiveReadings: 0 });
    }
  };

  const handleViewChange = (view: 'reports' | 'documents') => {
    setCurrentView(view);
    if (view === 'documents') {
      // Clear report selection when switching to documents
      setReportType(null);
    }
  };

  const handleFileUpload = (fileData: Partial<ExtractedData>) => {
    setData(prev => ({ ...prev, ...fileData }));
    setStep('confirmation');
  };

  const handleConfirmData = (updatedData: ExtractedData) => {
    setData(updatedData);
    setStep('generation');
  };

  const handleReset = () => {
    setStep('upload');
    setData({ fileName: '', rawData: [], address: '', inspectorName: '', isPositive: false, totalReadings: 0, positiveReadings: 0 });
  };

  // Document and Inspector handlers
  const handleAddInspector = async (inspector: Inspector) => {
    setInspectors(prev => {
      const updated = [...prev, inspector];
      saveInspectors(updated).catch(console.error);
      return updated;
    });
  };

  const handleUpdateInspector = async (inspectorId: string, updates: Partial<Inspector>) => {
    setInspectors(prev => {
      const updated = prev.map(inspector => 
        inspector.id === inspectorId 
          ? { ...inspector, ...updates }
          : inspector
      );
      saveInspectors(updated).catch(console.error);
      return updated;
    });
  };

  const handleAddInspectorVariableName = async (variableName: string) => {
    if (!inspectorVariableNames.includes(variableName)) {
      setInspectorVariableNames(prev => {
        const updated = [...prev, variableName];
        saveInspectorVariableNames(updated).catch(console.error);
        return updated;
      });
    }
  };

  const handleDeleteInspectorVariableName = async (variableName: string) => {
    // Remove from global list
    setInspectorVariableNames(prev => {
      const updated = prev.filter(name => name !== variableName);
      saveInspectorVariableNames(updated).catch(console.error);
      return updated;
    });

    // Remove values from all inspectors
    setInspectors(prev => {
      const updated = prev.map(inspector => {
        if (inspector.variableValues) {
          const values = new Map(inspector.variableValues);
          values.delete(variableName);
          return { ...inspector, variableValues: values.size > 0 ? values : undefined };
        }
        return inspector;
      });
      saveInspectors(updated).catch(console.error);
      return updated;
    });
  };

  const handleSetInspectorVariableValue = async (inspectorId: string, variableName: string, variableValue: string) => {
    setInspectors(prev => {
      const updated = prev.map(inspector => {
        if (inspector.id === inspectorId) {
          const values = inspector.variableValues ? new Map(inspector.variableValues) : new Map<string, string>();
          if (variableValue.trim()) {
            values.set(variableName, variableValue.trim());
          } else {
            values.delete(variableName);
          }
          return { ...inspector, variableValues: values.size > 0 ? values : undefined };
        }
        return inspector;
      });
      saveInspectors(updated).catch(console.error);
      return updated;
    });
  };

  const handleDeleteInspectorVariableValue = async (inspectorId: string, variableName: string) => {
    setInspectors(prev => {
      const updated = prev.map(inspector => {
        if (inspector.id === inspectorId && inspector.variableValues) {
          const values = new Map(inspector.variableValues);
          values.delete(variableName);
          return { ...inspector, variableValues: values.size > 0 ? values : undefined };
        }
        return inspector;
      });
      saveInspectors(updated).catch(console.error);
      return updated;
    });
  };

  const handleAddGeneralVariable = async (variableName: string, variableValue: string) => {
    setGeneralVariables(prev => {
      const updated = new Map(prev);
      updated.set(variableName, variableValue);
      saveGeneralVariables(updated).catch(console.error);
      return updated;
    });
  };

  const handleUpdateGeneralVariable = async (variableName: string, variableValue: string) => {
    setGeneralVariables(prev => {
      const updated = new Map(prev);
      updated.set(variableName, variableValue);
      saveGeneralVariables(updated).catch(console.error);
      return updated;
    });
  };

  const handleDeleteGeneralVariable = async (variableName: string) => {
    setGeneralVariables(prev => {
      const updated = new Map(prev);
      updated.delete(variableName);
      saveGeneralVariables(updated).catch(console.error);
      return updated;
    });
  };

  const handleDeleteInspector = async (inspectorId: string) => {
    // Delete associated document files from IndexedDB
    const inspectorDocs = inspectorDocuments.get(inspectorId) || [];
    for (const doc of inspectorDocs) {
      await removeDocumentStorage(doc.id);
    }

    setInspectors(prev => {
      const updated = prev.filter(i => i.id !== inspectorId);
      saveInspectors(updated).catch(console.error);
      return updated;
    });
    
    // Also remove inspector documents
    setInspectorDocuments(prev => {
      const newMap = new Map(prev);
      newMap.delete(inspectorId);
      saveInspectorDocuments(newMap).catch(console.error);
      return newMap;
    });
  };


  const handleUploadInspectorDocument = async (inspectorId: string, documentType: string, file: File) => {
    setUploadError(null);
    setUploadingDocument({ type: 'inspector', inspectorId, documentType, fileName: file.name });
    
    try {
      // Delete old document file if exists
      const inspectorDocs = inspectorDocuments.get(inspectorId) || [];
      const oldDoc = inspectorDocs.find(d => d.documentType === documentType);
      if (oldDoc) {
        await removeDocumentStorage(oldDoc.id);
      }

      const document: Document = {
        id: Date.now().toString(),
        fileName: file.name,
        file: file,
        uploadedAt: new Date(),
        category: 'inspector',
        inspectorId: inspectorId,
        documentType: documentType,
      };

      // Store document - this will call storeFile which uploads to R2
      const newMap = new Map(inspectorDocuments);
      const docs = newMap.get(inspectorId) || [];
      const filteredDocs = docs.filter(d => d.documentType !== documentType);
      const updated = [...filteredDocs, document];
      newMap.set(inspectorId, updated);
      
      await saveInspectorDocuments(newMap);
      
      setInspectorDocuments(newMap);
      console.log(`✅ Successfully uploaded ${file.name} to R2`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error('❌ Error uploading document:', error);
      setUploadError(`Failed to upload ${file.name}: ${errorMessage}`);
      alert(`❌ Upload Failed!\n\n${errorMessage}\n\nPlease check your R2 configuration and try again.`);
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleAddGeneralDocumentType = async (documentType: string) => {
    if (!generalDocumentTypes.includes(documentType)) {
      setGeneralDocumentTypes(prev => {
        const updated = [...prev, documentType];
        saveGeneralDocumentTypes(updated).catch(console.error);
        return updated;
      });
    }
  };

  const handleDeleteGeneralDocumentType = async (documentType: string) => {
    // Delete document file from IndexedDB
    const doc = generalTypedDocuments.get(documentType);
    if (doc) {
      await removeDocumentStorage(doc.id);
    }

    // Remove document type from General
    setGeneralDocumentTypes(prev => {
      const updated = prev.filter(t => t !== documentType);
      saveGeneralDocumentTypes(updated).catch(console.error);
      return updated;
    });

    // Delete general typed document of this type
    setGeneralTypedDocuments(prev => {
      const newMap = new Map(prev);
      newMap.delete(documentType);
      saveGeneralTypedDocuments(newMap).catch(console.error);
      return newMap;
    });
  };

  const handleAddInspectorDocumentType = async (documentType: string) => {
    if (!inspectorDocumentTypes.includes(documentType)) {
      setInspectorDocumentTypes(prev => {
        const updated = [...prev, documentType];
        saveInspectorDocumentTypes(updated).catch(console.error);
        return updated;
      });
    }
  };

  const handleDeleteInspectorDocumentType = async (documentType: string) => {
    // Delete document files from IndexedDB for all inspectors
    for (const [inspectorId, docs] of inspectorDocuments.entries()) {
      const docsToDelete = docs.filter(d => d.documentType === documentType);
      for (const doc of docsToDelete) {
        await removeDocumentStorage(doc.id);
      }
    }

    // Remove document type from Inspector
    setInspectorDocumentTypes(prev => {
      const updated = prev.filter(t => t !== documentType);
      saveInspectorDocumentTypes(updated).catch(console.error);
      return updated;
    });

    // Delete all documents of this type for ALL inspectors
    setInspectorDocuments(prev => {
      const newMap = new Map(prev);
      for (const [inspectorId, docs] of newMap.entries()) {
        const filteredDocs = docs.filter(d => d.documentType !== documentType);
        newMap.set(inspectorId, filteredDocs);
      }
      saveInspectorDocuments(newMap).catch(console.error);
      return newMap;
    });
  };

  const handleUploadGeneralTypedDocument = async (documentType: string, file: File) => {
    setUploadError(null);
    setUploadingDocument({ type: 'general-typed', documentType, fileName: file.name });
    
    try {
      // Delete old document file if exists
      const oldDoc = generalTypedDocuments.get(documentType);
      if (oldDoc) {
        await removeDocumentStorage(oldDoc.id);
      }

      const document: Document = {
        id: Date.now().toString(),
        fileName: file.name,
        file: file,
        uploadedAt: new Date(),
        category: 'general-typed',
        documentType: documentType,
      };

      // Replace existing document of this type (only one per type)
      // This will call storeFile which uploads to R2
      await saveGeneralTypedDocuments(new Map([[documentType, document]]));
      
      setGeneralTypedDocuments(prev => {
        const newMap = new Map(prev);
        newMap.set(documentType, document);
        return newMap;
      });
      
      console.log(`✅ Successfully uploaded ${file.name} to R2`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error('❌ Error uploading document:', error);
      setUploadError(`Failed to upload ${file.name}: ${errorMessage}`);
      alert(`❌ Upload Failed!\n\n${errorMessage}\n\nPlease check your R2 configuration and try again.`);
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleDeleteDocument = async (documentId: string, category: 'general-typed' | 'inspector') => {
    // Delete file from IndexedDB
    await removeDocumentStorage(documentId);

    if (category === 'general-typed') {
      // Find and remove from general typed documents
      setGeneralTypedDocuments(prev => {
        const newMap = new Map(prev);
        for (const [docType, doc] of newMap.entries()) {
          if (doc.id === documentId) {
            newMap.delete(docType);
            break;
          }
        }
        saveGeneralTypedDocuments(newMap).catch(console.error);
        return newMap;
      });
    } else {
      // Find and remove from inspector documents
      setInspectorDocuments(prev => {
        const newMap = new Map(prev);
        for (const [inspectorId, docs] of newMap.entries()) {
          const filteredDocs = docs.filter(d => d.id !== documentId);
          if (filteredDocs.length !== docs.length) {
            newMap.set(inspectorId, filteredDocs);
            break;
          }
        }
        saveInspectorDocuments(newMap).catch(console.error);
        return newMap;
      });
    }
  };

  // Show loading state while initializing
  if (isLoading) {
    return (
      <Layout 
        selectedReport={reportType} 
        onSelectReport={handleReportSelect}
        currentView={currentView}
        onViewChange={handleViewChange}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </Layout>
    );
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <Layout 
        selectedReport={reportType} 
        onSelectReport={handleReportSelect}
        currentView={currentView}
        onViewChange={handleViewChange}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-900 mb-2">Initialization Error</h2>
            <p className="text-red-700 mb-4">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      selectedReport={reportType} 
      onSelectReport={handleReportSelect}
      currentView={currentView}
      onViewChange={handleViewChange}
    >

      {currentView === 'documents' ? (
        <Documents
          inspectors={inspectors}
          generalTypedDocuments={generalTypedDocuments}
          inspectorDocuments={inspectorDocuments}
          generalDocumentTypes={generalDocumentTypes}
          inspectorDocumentTypes={inspectorDocumentTypes}
          generalVariables={generalVariables}
          inspectorVariableNames={inspectorVariableNames}
          onAddInspector={handleAddInspector}
          onUpdateInspector={handleUpdateInspector}
          onDeleteInspector={handleDeleteInspector}
          onUploadGeneralTypedDocument={handleUploadGeneralTypedDocument}
          onUploadInspectorDocument={handleUploadInspectorDocument}
          onDeleteDocument={handleDeleteDocument}
          onAddGeneralDocumentType={handleAddGeneralDocumentType}
          onDeleteGeneralDocumentType={handleDeleteGeneralDocumentType}
          onAddInspectorDocumentType={handleAddInspectorDocumentType}
          onDeleteInspectorDocumentType={handleDeleteInspectorDocumentType}
          onAddGeneralVariable={handleAddGeneralVariable}
          onUpdateGeneralVariable={handleUpdateGeneralVariable}
          onDeleteGeneralVariable={handleDeleteGeneralVariable}
          onAddInspectorVariableName={handleAddInspectorVariableName}
          onDeleteInspectorVariableName={handleDeleteInspectorVariableName}
          onSetInspectorVariableValue={handleSetInspectorVariableValue}
          onDeleteInspectorVariableValue={handleDeleteInspectorVariableValue}
          uploadingDocument={uploadingDocument}
          uploadError={uploadError}
          onClearUploadError={() => setUploadError(null)}
        />
      ) : !reportType ? (
        <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in opacity-60">
          <div className="w-20 h-20 mb-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <span className="text-3xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Lead Reports</h2>
          <p className="text-slate-500 max-w-sm">
            Select a report type from the sidebar on the left to begin.
          </p>
        </div>
      ) : (
        <div className="w-full h-full max-w-4xl mx-auto">
          {step === 'upload' && (
            <StepUpload
              onUpload={handleFileUpload}
              reportType={reportType}
              onBack={() => setReportType(null)}
            />
          )}

          {step === 'confirmation' && (
            <StepConfirmation
              data={data}
              onConfirm={handleConfirmData}
              onBack={() => setStep('upload')}
              reportType={reportType}
              inspectors={inspectors}
              generalTypedDocuments={generalTypedDocuments}
              inspectorDocuments={inspectorDocuments}
            />
          )}

          {step === 'generation' && (
            <StepGeneration
              data={data}
              onReset={handleReset}
              reportType={reportType}
              generalTypedDocuments={generalTypedDocuments}
              inspectorDocuments={inspectorDocuments}
              inspectors={inspectors}
              generalVariables={generalVariables}
            />
          )}
        </div>
      )}
    </Layout>
  );
}

export default App;
