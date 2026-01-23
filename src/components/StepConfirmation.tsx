import React, { useState, useEffect } from 'react';
import { Check, ClipboardList, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ExtractedData } from '../App';
import { getReportConfig } from '../config/reports';
import type { Inspector, Document } from '../types/documents';

interface StepConfirmationProps {
    data: ExtractedData & Record<string, any>; // Allow dynamic keys
    onConfirm: (data: ExtractedData & Record<string, any>) => void;
    onBack: () => void;
    reportType: string | null;
    inspectors: Inspector[];
    generalTypedDocuments: Map<string, Document>;
    inspectorDocuments: Map<string, Document[]>;
}

export const StepConfirmation: React.FC<StepConfirmationProps> = ({ 
    data, 
    onConfirm, 
    onBack, 
    reportType,
    inspectors,
    generalTypedDocuments,
    inspectorDocuments
}) => {
    // Initialize formData with data, ensuring all Excel-extracted values are included
    const initialFormData: Record<string, any> = { ...data };
    
    // For CERTIF report, fields start empty (static fields will be filled automatically)
    if (reportType === 'CERTIF') {
        // No default values needed - fields start empty
    } else {
        // Ensure all Excel-extracted values are in initialFormData (from StepUpload)
        // These come from Excel and should be shown in the form for user confirmation
        
        // Address/Inspection Location from Excel
        if (initialFormData['Inspection Location'] === undefined || initialFormData['Inspection Location'] === '') {
            initialFormData['Inspection Location'] = data['Inspection Location'] || data.address || '';
        }
        
        // Date from Excel
        if (initialFormData['Date'] === undefined || initialFormData['Date'] === '') {
            initialFormData['Date'] = data['Date'] || '';
        }
        
        // Today/Report Date - default to today if not set
        if (initialFormData['Today'] === undefined || initialFormData['Today'] === '') {
            initialFormData['Today'] = data['Today'] || new Date().toISOString().split('T')[0];
        }
        
        // Auto-fill Numb1 (Total readings) and Numb2 (Positive readings) from Excel if not already set
        if (initialFormData['Numb1'] === undefined || initialFormData['Numb1'] === '') {
            initialFormData['Numb1'] = data['Numb1'] || data.totalReadings || 0;
        }
        if (initialFormData['Numb2'] === undefined || initialFormData['Numb2'] === '') {
            initialFormData['Numb2'] = data['Numb2'] || data.positiveReadings || 0;
        }
        
        // Auto-fill Inspection Result based on positive/negative status if not already set
        if (initialFormData['Inspection Result'] === undefined || initialFormData['Inspection Result'] === '') {
            initialFormData['Inspection Result'] = data['Inspection Result'] || (data.isPositive ? 'Not Lead Free' : 'Lead Free');
        }
        
        // Auto-fill Inspection Info 1 with "property" if not already set
        if (initialFormData['Inspection Info 1'] === undefined || initialFormData['Inspection Info 1'] === '') {
            initialFormData['Inspection Info 1'] = data['Inspection Info 1'] || 'property';
        }
        
        // Ensure Inspection Info 2 is blank by default if not set
        if (initialFormData['Inspection Info 2'] === undefined) {
            initialFormData['Inspection Info 2'] = data['Inspection Info 2'] || '';
        }
    }
    
    const [formData, setFormData] = useState<Record<string, any>>(initialFormData);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedInspectorId, setSelectedInspectorId] = useState<string>(data.selectedInspectorId || '');
    
    // Auto-fill Inspector name if inspector was pre-selected
    useEffect(() => {
        if (selectedInspectorId && !formData['Inspector name']) {
            const selectedInspector = inspectors.find(i => i.id === selectedInspectorId);
            if (selectedInspector?.name) {
                handleChange('Inspector name', selectedInspector.name);
            }
        }
    }, [selectedInspectorId]);

    const config = getReportConfig(reportType);

    // Filter for User Input fields dynamically
    const inputFields = config?.mappings.filter(m => m.source === 'user_input') || [];

    const handleChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!config) {
            newErrors['general'] = 'Configuration not found for this report type.';
        } else {
            inputFields.forEach(field => {
                // Simple required check for now (assuming all inputs are required for MVP unless specified)
                if (field.required && !String(formData[field.pdfFieldId] || '').trim()) {
                    newErrors[field.pdfFieldId] = `${field.label || field.pdfFieldId} is required`;
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            // TEMPORARILY: Skip validation for inspector, certificate, and license
            // Just try to find them if they exist, but don't require them
            
            // Find certificate document type (look for "certificate" or "Certificate" in general document types)
            const certificateType = Array.from(generalTypedDocuments.keys()).find(
                type => type.toLowerCase().includes('certificate') || type.toLowerCase().includes('cert')
            );
            
            // Find license document type if inspector is selected
            let licenseDocumentType: string | undefined = undefined;
            if (selectedInspectorId) {
                const inspectorDocs = inspectorDocuments.get(selectedInspectorId) || [];
                const licenseDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('license') || 
                    doc.documentType?.toLowerCase().includes('licence')
                );
                if (licenseDoc) {
                    licenseDocumentType = licenseDoc.documentType;
                }
            }
            
            // All validations passed (no required checks for now)
            // Merge formData with original data to ensure all Excel-extracted values are included
            const confirmedData = {
                ...data, // Start with original data (includes Excel-extracted values)
                ...formData, // Override with user-edited form values
                selectedInspectorId: selectedInspectorId || undefined,
                certificateDocumentType: certificateType || undefined,
                licenseDocumentType: licenseDocumentType || undefined,
                // Ensure these are explicitly included
                fullExcelData: data.fullExcelData,
                headerRowIndex: data.headerRowIndex,
                isPositive: data.isPositive,
                totalReadings: data.totalReadings,
                positiveReadings: data.positiveReadings
            } as ExtractedData;
            
            console.log('Submitting confirmed data with fields:', Object.keys(confirmedData));
            console.log('Form field values:', Object.entries(formData).filter(([k, v]) => v !== '' && v !== undefined && v !== null));
            
            onConfirm(confirmedData);
        }
    };

    if (!config) return <div className="text-red-500">Error: Report configuration missing.</div>;

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Review & Confirm</h2>
                <p className="text-slate-500">
                    Source: <strong>{data.fileName || 'Uploaded File'}</strong>
                </p>
            </div>

            <div className="space-y-6 max-w-lg mx-auto w-full pb-10">

                {/* Extracted Info Verification */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold border-b border-slate-100 pb-2">
                        <ClipboardList size={20} />
                        <h3>Source File Data</h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-2">Rows Detected: <span className="text-slate-900 font-mono font-medium">{data.rawData?.length || 0}</span></p>
                </div>

                {/* Positive/Negative Status */}
                {data.isPositive !== undefined && (
                    <div className={`bg-white p-6 rounded-xl border shadow-sm ${
                        data.isPositive 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-green-300 bg-green-50'
                    }`}>
                        <div className="flex items-center gap-3">
                            {data.isPositive ? (
                                <>
                                    <AlertTriangle className="text-red-600" size={24} />
                                    <div>
                                        <h3 className="font-semibold text-red-900">Status: Positive</h3>
                                        <p className="text-sm text-red-700 mt-1">
                                            One or more screenings in the Pb P/F column are positive (excluding calibration rows).
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="text-green-600" size={24} />
                                    <div>
                                        <h3 className="font-semibold text-green-900">Status: Negative</h3>
                                        <p className="text-sm text-green-700 mt-1">
                                            No positive screenings detected in the Pb P/F column (excluding calibration rows).
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Inspector Selection */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold border-b border-slate-100 pb-2">
                        <ClipboardList size={20} />
                        <h3>Inspector Information</h3>
                    </div>
                    <div>
                        <label className="label-text">
                            Inspector who performed the inspection
                            <span className="text-slate-400 ml-1 text-xs">(optional)</span>
                        </label>
                        <select
                            className={`input-field ${errors.inspector ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            value={selectedInspectorId}
                            onChange={(e) => {
                                setSelectedInspectorId(e.target.value);
                                // Auto-fill Inspector name when inspector is selected
                                if (e.target.value) {
                                    const selectedInspector = inspectors.find(i => i.id === e.target.value);
                                    if (selectedInspector?.name) {
                                        handleChange('Inspector name', selectedInspector.name);
                                    }
                                }
                                if (errors.inspector) {
                                    setErrors(prev => {
                                        const newErrors = { ...prev };
                                        delete newErrors.inspector;
                                        return newErrors;
                                    });
                                }
                            }}
                        >
                            <option value="">-- Select Inspector --</option>
                            {inspectors.map((inspector) => {
                                const inspectorDocs = inspectorDocuments.get(inspector.id) || [];
                                const hasLicense = inspectorDocs.some(doc => 
                                    doc.documentType?.toLowerCase().includes('license') || 
                                    doc.documentType?.toLowerCase().includes('licence')
                                );
                                return (
                                    <option key={inspector.id} value={inspector.id}>
                                        {inspector.name} {!hasLicense && '(No License)'}
                                    </option>
                                );
                            })}
                        </select>
                        {errors.inspector && (
                            <p className="text-red-500 text-xs mt-1 font-medium">{errors.inspector}</p>
                        )}
                        {errors.certificate && (
                            <p className="text-red-500 text-xs mt-1 font-medium">{errors.certificate}</p>
                        )}
                    </div>
                </div>

                {/* Dynamic Inputs */}
                <div className="space-y-5">
                    {inputFields.map((field) => (
                        <div key={field.pdfFieldId}>
                            <label className="label-text">
                                {field.label || field.pdfFieldId}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                                type={field.inputType || 'text'}
                                className={`input-field ${errors[field.pdfFieldId] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                value={formData[field.pdfFieldId] ?? ''}
                                onChange={(e) => handleChange(field.pdfFieldId, e.target.value)}
                                placeholder={`Enter ${field.label}...`}
                            />
                            {errors[field.pdfFieldId] && (
                                <p className="text-red-500 text-xs mt-1 font-medium">{errors[field.pdfFieldId]}</p>
                            )}
                        </div>
                    ))}
                </div>

                {errors['general'] && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
                        <AlertCircle size={18} />
                        <span>{errors['general']}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-6 flex gap-4">
                    <button
                        onClick={onBack}
                        className="flex-1 py-3 px-4 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors font-medium shadow-sm"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 primary-btn flex items-center justify-center gap-2"
                    >
                        <Check size={18} />
                        Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
