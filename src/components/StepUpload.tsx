import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Check, Layers, ArrowRight, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ExtractedData } from '../App';
import type { ReportType } from '../App';
import { extractSheetInfo } from '../utils/excelExtractor';
import { getReportConfig } from '../config/reports';
import { getTemplateUrl } from '../utils/apiConfig';

interface StepUploadProps {
    onUpload: (data: Partial<ExtractedData>) => void;
    reportType: ReportType;
    onBack: () => void;
}

export const StepUpload: React.FC<StepUploadProps> = ({ onUpload, reportType, onBack }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [templateFilesValid, setTemplateFilesValid] = useState<{ valid: boolean; missing: string[] } | null>(null);
    const [isCheckingTemplates, setIsCheckingTemplates] = useState(true);

    // Check required template files on mount
    useEffect(() => {
        const checkTemplateFiles = async () => {
            setIsCheckingTemplates(true);
            const config = getReportConfig(reportType);
            if (!config) {
                setTemplateFilesValid({ valid: false, missing: ['Report configuration'] });
                setIsCheckingTemplates(false);
                return;
            }

            const requiredFiles: string[] = [config.templateUrl];
            if (config.certifTemplateUrl && reportType === 'XHR') {
                requiredFiles.push(config.certifTemplateUrl);
            }

            const missing: string[] = [];
            
            for (const fileUrl of requiredFiles) {
                let found = false;
                const filename = fileUrl.replace('/templates/', '');
                const urlsToTry = getTemplateUrl(fileUrl);
                
                console.log(`Checking template: ${filename}, trying URLs:`, urlsToTry);
                
                // Try each URL in order until one works
                for (const url of urlsToTry) {
                    try {
                        const response = await fetch(url, { 
                            method: 'GET',
                            headers: { 'Range': 'bytes=0-0' }, // Only fetch first byte
                            cache: 'no-cache'
                        });
                        console.log(`Response for ${filename} at ${url}:`, response.status, response.statusText);
                        if (response.ok || response.status === 206) { // 206 = Partial Content
                            found = true;
                            console.log(`✅ Found: ${filename} at ${url}`);
                            break; // Found it, no need to try other URLs
                        }
                    } catch (err: any) {
                        console.warn(`Failed to fetch ${filename} from ${url}:`, err.message);
                        // Continue to next URL
                    }
                }
                
                if (!found) {
                    console.warn(`❌ Template file not accessible: ${fileUrl} (tried: ${urlsToTry.join(', ')})`);
                    missing.push(fileUrl);
                }
            }

            setTemplateFilesValid({ 
                valid: missing.length === 0, 
                missing 
            });
            setIsCheckingTemplates(false);
        };

        checkTemplateFiles();
    }, [reportType]);

    // Sheet Selection State
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setError(null);
        setFileName(file.name);

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setError('Please upload a valid Excel file (.xlsx or .xls)');
            setIsProcessing(false);
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data);

            setWorkbook(wb);
            setSheetNames(wb.SheetNames);

            if (wb.SheetNames.length === 1) {
                // Auto-select if only one sheet
                handleSheetConfirm(wb, wb.SheetNames[0]);
            } else {
                // Stop processing, wait for user selection
                setIsProcessing(false);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
            setIsProcessing(false);
        }
    };

    const handleSheetConfirm = (wb: XLSX.WorkBook, sheetName: string) => {
        const sheet = wb.Sheets[sheetName];
        const extracted = extractSheetInfo(sheet);

        const isPositive = extracted.isPositive || false;
        
        onUpload({
            fileName: fileName,
            rawData: extracted.rawData,
            address: extracted.address || '',
            isPositive: isPositive,
            totalReadings: extracted.totalReadings || 0,
            positiveReadings: extracted.positiveReadings || 0,
            fullExcelData: extracted.fullExcelData,
            headerRowIndex: extracted.headerRowIndex,
            Date: extracted.date || '', // Include extracted date from Excel
        } as any);
    };

    const handleSheetSelect = (name: string) => {
        setSelectedSheet(name);
    };

    const confirmSelection = () => {
        if (workbook && selectedSheet) {
            handleSheetConfirm(workbook, selectedSheet);
        }
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    // If waiting for selection
    if (sheetNames.length > 1 && workbook) {
        return (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                    <div className="flex items-center gap-3 mb-6 text-slate-800">
                        <Layers className="text-blue-600" size={24} />
                        <h2 className="text-xl font-bold">Select Worksheet</h2>
                    </div>

                    <p className="text-slate-500 mb-4">
                        The file <strong>{fileName}</strong> has multiple sheets. Which one do you want to use?
                    </p>

                    <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                        {sheetNames.map(name => (
                            <button
                                key={name}
                                onClick={() => handleSheetSelect(name)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between group
                                  ${selectedSheet === name
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="font-medium">{name}</span>
                                {selectedSheet === name && <Check size={18} />}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={confirmSelection}
                        disabled={!selectedSheet}
                        className="w-full primary-btn flex items-center justify-center gap-2"
                    >
                        Continue
                        <ArrowRight size={18} />
                    </button>

                    <div className="mt-4 text-center">
                        <button
                            onClick={() => {
                                setWorkbook(null);
                                setSheetNames([]);
                                setError(null);
                            }}
                            className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Data Source</h2>
                <p className="text-slate-500">
                    {reportType === 'XHR' ? 'Upload the XRF Inspection Excel file.' : 'Upload your Excel file to begin.'}
                </p>
            </div>

            {/* Template Files Validation */}
            {isCheckingTemplates && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                    <span className="text-sm text-blue-900">Checking required template files...</span>
                </div>
            )}

            {!isCheckingTemplates && templateFilesValid && !templateFilesValid.valid && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-red-900 mb-2">Missing Required Template Files</h3>
                            <p className="text-sm text-red-700 mb-2">The following template files are missing or cannot be accessed:</p>
                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                {templateFilesValid.missing.map((file, idx) => (
                                    <li key={idx} className="font-mono text-xs">{file}</li>
                                ))}
                            </ul>
                            <p className="text-sm text-red-700 mt-3">
                                Please ensure these files exist in the <code className="bg-red-100 px-1 rounded">public/templates</code> folder.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!isCheckingTemplates && templateFilesValid && templateFilesValid.valid && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <Check className="text-green-600" size={18} />
                    <span className="text-sm text-green-900">All required template files are available</span>
                </div>
            )}

            <div
                className={`
          flex-1 border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer bg-white
          ${isDragging
                        ? 'border-blue-500 bg-blue-50 scale-105'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }
          ${isProcessing || isCheckingTemplates || (templateFilesValid && !templateFilesValid.valid) ? 'opacity-50 pointer-events-none' : ''}
        `}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => {
                    if (!isCheckingTemplates && templateFilesValid?.valid) {
                        document.getElementById('fileInput')?.click();
                    }
                }}
            >
                <div className="w-20 h-20 bg-blue-50 rounded-full shadow-sm flex items-center justify-center mb-6 text-blue-600">
                    {isProcessing ? (
                        <Loader2 size={40} className="animate-spin" />
                    ) : (
                        <FileSpreadsheet size={40} />
                    )}
                </div>

                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {isProcessing ? 'Processing File...' : 'Drag & Drop your Excel file here'}
                </h3>
                <p className="text-slate-500 mb-8 text-center max-w-xs">
                    Supports .xlsx and .xls files.
                </p>

                <input
                    type="file"
                    id="fileInput"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={isProcessing}
                />

                {!isProcessing && (
                    <span className="primary-btn inline-flex items-center gap-2 pointer-events-none">
                        <Upload size={18} />
                        Browse Files
                    </span>
                )}

                {error && (
                    <div className="mt-8 flex items-center gap-2 text-red-600 text-sm bg-red-50 py-2 px-4 rounded-full">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-center">
                <button
                    onClick={onBack}
                    className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                >
                    ← Cancel
                </button>
            </div>
        </div>
    );
};
