import React from 'react';
import { Download, CheckCircle, RotateCcw, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import type { ExtractedData } from '../App';
import { generatePDFReport } from '../utils/pdfGenerator';
import type { Inspector, Document } from '../types/documents';
import { getFileFromR2, isR2Configured } from '../utils/r2Storage';

interface StepGenerationProps {
    data: ExtractedData;
    onReset: () => void;
    reportType: string | null;
    generalTypedDocuments?: Map<string, Document>;
    inspectorDocuments?: Map<string, Document[]>;
    inspectors?: Inspector[];
    generalVariables?: Map<string, string>;
}

export const StepGeneration: React.FC<StepGenerationProps> = ({ 
    data, 
    onReset, 
    reportType,
    generalTypedDocuments,
    inspectorDocuments,
    inspectors,
    generalVariables
}) => {
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleDownload = async () => {
        if (isGenerating) return;
        
        setIsGenerating(true);
        setError(null);
        
        try {
            console.log('Starting PDF generation...', {
                reportType,
                hasGeneralDocs: !!generalTypedDocuments,
                hasInspectorDocs: !!inspectorDocuments,
                hasInspectors: !!inspectors,
                hasGeneralVars: !!generalVariables,
                selectedInspectorId: data.selectedInspectorId,
                licenseDocumentType: data.licenseDocumentType,
                certificateDocumentType: data.certificateDocumentType
            });
            
            // Log inspector documents details
            if (data.selectedInspectorId && inspectorDocuments) {
                const inspectorDocs = inspectorDocuments.get(data.selectedInspectorId) || [];
                console.log(`Inspector documents for ${data.selectedInspectorId}:`, inspectorDocs.map(doc => ({
                    id: doc.id,
                    fileName: doc.fileName,
                    documentType: doc.documentType,
                    hasFile: !!doc.file,
                    fileType: doc.file?.type,
                    fileSize: doc.file instanceof Blob ? doc.file.size : 'N/A',
                    filePath: (doc as any).filePath
                })));
            }
            
            // Ensure documents have files before PDF generation
            // Reload files from R2 if they're missing or empty
            let documentsWithFiles = inspectorDocuments;
            if (data.selectedInspectorId && inspectorDocuments) {
                const inspectorDocs = inspectorDocuments.get(data.selectedInspectorId) || [];
                const needsReload = inspectorDocs.some(doc => {
                    const hasFilePath = !!(doc as any).filePath;
                    const missingFile = !doc.file;
                    const emptyFile = doc.file && doc.file.size === 0;
                    return hasFilePath && (missingFile || emptyFile);
                });
                
                if (needsReload) {
                    console.log('⚠️ Some documents are missing files or have empty files, attempting to reload from R2...');
                    const r2Configured = await isR2Configured();
                    if (r2Configured) {
                        const reloadedDocs = await Promise.all(inspectorDocs.map(async (doc) => {
                            const filePath = (doc as any).filePath;
                            const missingFile = !doc.file;
                            const emptyFile = doc.file && doc.file.size === 0;
                            
                            if (filePath && (missingFile || emptyFile)) {
                                try {
                                    console.log(`📥 Reloading file for document:`, {
                                        id: doc.id,
                                        fileName: doc.fileName,
                                        documentType: doc.documentType,
                                        filePath: filePath,
                                        currentFileSize: doc.file?.size || 0,
                                        reason: missingFile ? 'missing' : 'empty'
                                    });
                                    
                                    const file = await getFileFromR2(filePath);
                                    
                                    // Validate the reloaded file
                                    if (!file || file.size === 0) {
                                        throw new Error(`Reloaded file is empty (0 bytes)`);
                                    }
                                    
                                    console.log(`✅ Reloaded file for document ${doc.id}: ${doc.fileName} (${file.size} bytes)`);
                                    return { ...doc, file } as Document;
                                } catch (error: any) {
                                    console.error(`❌ Failed to reload file for document ${doc.id} (${doc.fileName}):`, {
                                        error: error.message || error,
                                        filePath: filePath
                                    });
                                    return doc;
                                }
                            }
                            // Validate existing file is not empty
                            if (doc.file && doc.file.size === 0) {
                                console.warn(`⚠️ Document ${doc.id} (${doc.fileName}) has empty file but no filePath to reload`);
                            }
                            return doc as Document;
                        }));
                        
                        const reloadedMap = new Map(inspectorDocuments);
                        reloadedMap.set(data.selectedInspectorId, reloadedDocs);
                        documentsWithFiles = reloadedMap;
                        console.log('✅ Documents reloaded with files');
                    } else {
                        console.warn('⚠️ R2 not configured, cannot reload files');
                    }
                } else {
                    // Even if reload isn't needed, validate all files
                    console.log('🔍 Validating all document files...');
                    inspectorDocs.forEach(doc => {
                        const filePath = (doc as any).filePath;
                        console.log(`📄 Document: ${doc.fileName}`, {
                            id: doc.id,
                            documentType: doc.documentType,
                            hasFile: !!doc.file,
                            fileSize: doc.file?.size || 0,
                            filePath: filePath || 'N/A',
                            fileType: doc.file?.type || 'N/A'
                        });
                        
                        if (doc.file && doc.file.size === 0) {
                            console.warn(`⚠️ Document ${doc.id} (${doc.fileName}) has empty file!`);
                        }
                    });
                }
            }
            
            await generatePDFReport(
                data, 
                reportType, 
                generalTypedDocuments, 
                documentsWithFiles, 
                inspectors, 
                generalVariables
            );
            
            console.log('PDF generation completed successfully');
        } catch (err: any) {
            console.error('PDF generation error:', err);
            const errorMessage = err?.message || 'Unknown error occurred';
            setError(errorMessage);
            alert(`Failed to generate PDF:\n\n${errorMessage}\n\nPlease check:\n- Template file is present in public/templates\n- Certificate and license documents are valid PDF files\n- All required documents are uploaded`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
            <div className="mb-6 text-green-600 bg-green-50 p-5 rounded-full shadow-sm ring-1 ring-green-100">
                <CheckCircle size={48} />
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-2">Ready to Download!</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
                Your Report for <strong>{data.address}</strong> has been prepared.
            </p>

            <div className="flex flex-col gap-4 w-full max-w-xs">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                        <strong>Error:</strong> {error}
                    </div>
                )}
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="primary-btn flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Generating PDF...
                        </>
                    ) : (
                        <>
                            <Download size={20} />
                            Download Report (.pdf)
                        </>
                    )}
                </button>

                <button
                    onClick={onReset}
                    className="py-3 text-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 transition-colors font-medium text-sm"
                >
                    <RotateCcw size={16} />
                    Start New Report
                </button>
            </div>

            {/* Report Details */}
            <div className="mt-8 w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold border-b border-slate-100 pb-3">
                    <FileText size={18} />
                    <h3 className="text-lg">Report Details</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-slate-500">Property Address:</span>
                        <span className="text-slate-900 font-medium text-right max-w-[60%]">{data.address || 'N/A'}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Inspection Result:</span>
                        <span className={`font-semibold ${
                            (data as any)['Inspection Result'] === 'Not Lead Free' ? 'text-red-600' : 'text-green-600'
                        }`}>
                            {(data as any)['Inspection Result'] || (data.isPositive ? 'Not Lead Free' : 'Lead Free')}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status:</span>
                        <div className="flex items-center gap-2">
                            {data.isPositive ? (
                                <>
                                    <AlertTriangle size={16} className="text-red-600" />
                                    <span className="text-red-600 font-medium">Positive</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className="text-green-600" />
                                    <span className="text-green-600 font-medium">Negative</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Total Readings:</span>
                        <span className="text-slate-900 font-medium">{data.totalReadings || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Positive Readings:</span>
                        <span className="text-slate-900 font-medium">{data.positiveReadings || 0}</span>
                    </div>

                    {data.fileName && (
                        <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                            <span className="text-slate-500">Source File:</span>
                            <span className="text-slate-600 font-mono text-xs text-right max-w-[60%] break-all">{data.fileName}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
