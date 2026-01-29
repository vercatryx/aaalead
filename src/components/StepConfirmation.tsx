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
    generalVariables: Map<string, string>;
}

export const StepConfirmation: React.FC<StepConfirmationProps> = ({ 
    data, 
    onConfirm, 
    onBack, 
    reportType,
    inspectors,
    generalTypedDocuments,
    inspectorDocuments,
    generalVariables
}) => {
    // Initialize formData with data, ensuring all Excel-extracted values are included
    const initialFormData: Record<string, any> = { ...data };
    
    {
        // Ensure all Excel-extracted values are in initialFormData (from StepUpload)
        // These come from Excel and should be shown in the form for user confirmation
        
        // Address/Inspection Location from Excel
        if (initialFormData['Inspection Location'] === undefined || initialFormData['Inspection Location'] === '') {
            initialFormData['Inspection Location'] = data['Inspection Location'] || data.address || '';
        }
        
        // Auto-fill address field from Address field if Address is set
        if (initialFormData['Address']) {
            initialFormData['address'] = initialFormData['Address'];
        } else if (data['Address']) {
            initialFormData['Address'] = data['Address'];
            initialFormData['address'] = data['Address'];
        } else if (data.address) {
            // If address exists but Address doesn't, set both
            initialFormData['Address'] = data.address;
            initialFormData['address'] = data.address;
        }
        
        // Date from Excel - use extracted date if available
        if (initialFormData['Date'] === undefined || initialFormData['Date'] === '') {
            initialFormData['Date'] = data['Date'] || data.date || '';
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
        
        // Auto-fill Building Type with default "single family home" if not set
        if (initialFormData['Building Type'] === undefined || initialFormData['Building Type'] === '') {
            initialFormData['Building Type'] = data['Building Type'] || 'single family home';
        }
    }
    
    const [formData, setFormData] = useState<Record<string, any>>(initialFormData);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedInspectorId, setSelectedInspectorId] = useState<string>(data.selectedInspectorId || '');
    const [missingItems, setMissingItems] = useState<{
        documents: string[];
        variables: string[];
    }>({ documents: [], variables: [] });
    
    // Auto-fill Inspector name and njdoh if inspector was pre-selected or when inspector changes
    useEffect(() => {
        if (selectedInspectorId) {
            const selectedInspector = inspectors.find(i => i.id === selectedInspectorId);
            setFormData(prev => {
                const updated = { ...prev };
                if (selectedInspector?.name) {
                    updated['Inspector name'] = selectedInspector.name;
                    updated['inpector name '] = selectedInspector.name;
                }
                // Auto-fill njdoh from inspector variable
                if (selectedInspector?.variableValues) {
                    const njdohValue = selectedInspector.variableValues.get('njdoh');
                    if (njdohValue) {
                        updated['njdoh'] = njdohValue;
                    }
                }
                return updated;
            });
        } else {
            // Clear Inspector name if no inspector is selected
            setFormData(prev => ({
                ...prev,
                'Inspector name': '',
                'inpector name ': '',
                'njdoh': ''
            }));
        }
    }, [selectedInspectorId, inspectors]);
    
    // Auto-fill njdca from general variables on component mount
    useEffect(() => {
        const njdcaValue = generalVariables.get('njdca');
        if (njdcaValue) {
            setFormData(prev => ({ ...prev, njdca: njdcaValue }));
        }
    }, [generalVariables]);

    // Check for missing documents and variables
    useEffect(() => {
        const missingDocs: string[] = [];
        const missingVars: string[] = [];

        // Check for certificate document
        const certificateType = Array.from(generalTypedDocuments.keys()).find(
            type => type.toLowerCase().includes('certificate') || type.toLowerCase().includes('cert')
        );
        const certDoc = certificateType ? generalTypedDocuments.get(certificateType) : null;
        if (!certDoc || !certDoc.file) {
            missingDocs.push('Certificate document');
        }

        // Check inspector documents and variables if inspector is selected
        if (selectedInspectorId) {
            const inspectorDocs = inspectorDocuments.get(selectedInspectorId) || [];
            
            // Check for signature (must have file)
            const signatureDoc = inspectorDocs.find(doc => 
                doc.documentType?.toLowerCase().includes('signature')
            );
            if (!signatureDoc || !signatureDoc.file) {
                missingDocs.push('Inspector signature');
            }

            // Check for license (must have file)
            const licenseDoc = inspectorDocs.find(doc => 
                doc.documentType?.toLowerCase().includes('license') || 
                doc.documentType?.toLowerCase().includes('licence')
            );
            if (!licenseDoc || !licenseDoc.file) {
                missingDocs.push('Inspector license');
            }

            // Check for njdoh variable
            const selectedInspector = inspectors.find(i => i.id === selectedInspectorId);
            const njdohValue = selectedInspector?.variableValues?.get('njdoh');
            if (!njdohValue || !njdohValue.trim()) {
                missingVars.push('njdoh (Inspector variable)');
            }
        }

        // Check for njdca general variable
        const njdcaValue = generalVariables.get('njdca');
        if (!njdcaValue || !njdcaValue.trim()) {
            missingVars.push('njdca (General variable)');
        }

        setMissingItems({ documents: missingDocs, variables: missingVars });
    }, [selectedInspectorId, inspectorDocuments, generalTypedDocuments, generalVariables, inspectors]);

    const config = getReportConfig(reportType);

    // Filter for User Input fields dynamically, but exclude fields that are auto-filled:
    // - Inspector name fields (auto-filled from dropdown)
    // - address field (auto-filled from Address field)
    // - county, block, lot fields (only needed for page 6, which is removed if positive)
    const inputFields = config?.mappings.filter(m => 
        m.source === 'user_input' && 
        m.pdfFieldId !== 'Inspector name' && 
        m.pdfFieldId !== 'inpector name ' &&
        m.pdfFieldId !== 'address' &&
        // Exclude county, block, and lot if report is positive (page 6 will be removed)
        !(data.isPositive && (m.pdfFieldId === 'county' || m.pdfFieldId === 'block' || m.pdfFieldId === 'lot'))
    ) || [];

    const handleChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        
        // Auto-fill address field when Address field changes
        if (fieldId === 'Address') {
            setFormData(prev => ({ ...prev, address: value }));
        }
        
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
            // Validate inspector selection is mandatory
            if (!selectedInspectorId || !selectedInspectorId.trim()) {
                newErrors['inspector'] = 'Inspector selection is required';
            }

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
            </div>

            <div className="space-y-6 max-w-6xl mx-auto w-full pb-10 px-4">

                {/* Missing Documents/Variables Warning - only show if something is missing */}
                {(missingItems.documents.length > 0 || missingItems.variables.length > 0) && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={24} />
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-900 mb-3">Missing Required Items</h3>
                                
                                {missingItems.documents.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-sm font-medium text-amber-800 mb-2">Missing Documents:</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
                                            {missingItems.documents.map((doc, idx) => (
                                                <li key={idx}>{doc}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {missingItems.variables.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-amber-800 mb-2">Missing Variables:</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
                                            {missingItems.variables.map((variable, idx) => (
                                                <li key={idx}>{variable}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                <p className="text-xs text-amber-600 mt-3 italic">
                                    Note: You can still generate the PDF, but these items will not be included in the report.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                            className={`input-field ${errors.inspector ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            value={selectedInspectorId}
                            onChange={(e) => {
                                setSelectedInspectorId(e.target.value);
                                // Inspector name will be auto-filled via useEffect
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

                {/* Dynamic Inputs - Custom Grouped Layout */}
                <div className="space-y-5">
                    {/* Helper function to render a field */}
                    {(() => {
                        const renderField = (fieldId: string) => {
                            const field = inputFields.find(f => f.pdfFieldId === fieldId);
                            if (!field) return null;
                            
                            return (
                                <div key={field.pdfFieldId} className="flex-1">
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
                            );
                        };

                        const hasField = (fieldId: string) => inputFields.some(f => f.pdfFieldId === fieldId);
                        const hasAnyField = (fieldIds: string[]) => fieldIds.some(id => hasField(id));

                        return (
                            <>
                                {/* Row 1: Property Address (alone) */}
                                {hasField('Address') && (
                                    <div>
                                        {renderField('Address')}
                                    </div>
                                )}

                                {/* Row 2: county, block, lot */}
                                {hasAnyField(['county', 'block', 'lot']) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {renderField('county')}
                                        {renderField('block')}
                                        {renderField('lot')}
                                    </div>
                                )}

                                {/* Row 3: Units areas, Building Type, Inspection Info 1 */}
                                {hasAnyField(['Units areas', 'Building Type', 'Inspection Info 1']) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {renderField('Units areas')}
                                        {renderField('Building Type')}
                                        {renderField('Inspection Info 1')}
                                    </div>
                                )}

                                {/* Row 4: Inspection Date, Today (Report Date) */}
                                {hasAnyField(['Date', 'Today']) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {renderField('Date')}
                                        {renderField('Today')}
                                    </div>
                                )}

                                {/* Row 5: Inspection Result, Amount of total readings, Amount of positive readings */}
                                {hasAnyField(['Inspection Result', 'Numb1', 'Numb2']) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {renderField('Inspection Result')}
                                        {renderField('Numb1')}
                                        {renderField('Numb2')}
                                    </div>
                                )}
                            </>
                        );
                    })()}
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
