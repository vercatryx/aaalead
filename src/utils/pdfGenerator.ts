import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ExtractedData } from '../App';
import { getReportConfig } from '../config/reports';
import type { Inspector, Document } from '../types/documents';
import { getTemplateUrl } from './apiConfig';
import * as pdfjsLib from 'pdfjs-dist';
import { detectPositiveNegative } from './excelExtractor';

// Set up pdf.js worker
if (typeof window !== 'undefined') {
    // Try local file first (copied by postinstall script), fallback to CDN
    // In pdfjs-dist v5+, the worker is pdf.worker.mjs
    const version = pdfjsLib.version || '5.4.530';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;
    
    // If local file fails, it will fallback to trying to load from CDN
    // Fallback CDN (uncomment if local file doesn't work):
    // pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.mjs`;
}

// Helper to check if file is an image
const isImageFile = (file: File | Blob, fileName?: string): boolean => {
  // Check MIME type first
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  
  // Fallback: check file extension if MIME type is missing
  const nameToCheck = fileName || (file instanceof File ? file.name : '');
  if (nameToCheck) {
    const lowerName = nameToCheck.toLowerCase();
    return lowerName.endsWith('.png') || 
           lowerName.endsWith('.jpg') || 
           lowerName.endsWith('.jpeg') || 
           lowerName.endsWith('.gif') || 
           lowerName.endsWith('.bmp') || 
           lowerName.endsWith('.webp');
  }
  
  return false;
};

// Helper to embed image in PDF page (centered)
const embedImageInPDF = async (pdfDoc: PDFDocument, imageFile: File | Blob): Promise<void> => {
  // Validate file size
  if (imageFile.size === 0) {
    throw new Error('Image file is empty. Please re-upload a valid image file.');
  }
  
  const arrayBuffer = await imageFile.arrayBuffer();
  
  // Validate array buffer
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Failed to read image file data. The file may be corrupted or empty.');
  }
  
  if (arrayBuffer.byteLength < 8) {
    throw new Error('Image file is too small to be valid. Please re-upload a valid image file.');
  }
  
  let image;
  
  // Determine image type and embed accordingly
  if (imageFile.type === 'image/png') {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
    image = await pdfDoc.embedJpg(arrayBuffer);
  } else {
    // Try PNG first, then JPEG
    try {
      image = await pdfDoc.embedPng(arrayBuffer);
    } catch (pngError) {
      try {
        image = await pdfDoc.embedJpg(arrayBuffer);
      } catch (jpgError) {
        throw new Error(`Failed to embed image. The file may not be a valid PNG or JPEG image. PNG error: ${pngError.message || pngError}, JPEG error: ${jpgError.message || jpgError}`);
      }
    }
  }
  
  // Create a new page with standard size (8.5 x 11 inches = 612 x 792 points)
  const page = pdfDoc.addPage([612, 792]);
  
  // Get image dimensions and page dimensions
  const imageDims = image.scale(1);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  
  // Calculate scaling to fit image on page with margins (leave 50 points margin on all sides)
  const margin = 50;
  const maxWidth = pageWidth - (2 * margin);
  const maxHeight = pageHeight - (2 * margin);
  
  // Calculate scale to fit within available space while maintaining aspect ratio
  const scaleX = maxWidth / imageDims.width;
  const scaleY = maxHeight / imageDims.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed
  
  const scaledWidth = imageDims.width * scale;
  const scaledHeight = imageDims.height * scale;
  
  // Center the image on the page
  const x = (pageWidth - scaledWidth) / 2;
  const y = (pageHeight - scaledHeight) / 2;
  
  // Draw the image
  page.drawImage(image, {
    x: x,
    y: y,
    width: scaledWidth,
    height: scaledHeight,
  });
};

// Helper to check if a value indicates positive
const isPositiveValue = (value: any): boolean => {
    const text = String(value || '').trim().toLowerCase();
    return text === 'positive' || 
           text === 'pos' || 
           text === 'p' || 
           text === '+' ||
           text === 'fail' ||
           text === 'f';
};

// Helper to check if a row is calibration
const isCalibrationRow = (rowIndex: number, row: any[], calibrationColIndex: number): boolean => {
    // First 4 rows are always calibration
    if (rowIndex < 4) {
        return true;
    }
    
    // Check calibration column if it exists
    if (calibrationColIndex !== -1 && row && row[calibrationColIndex]) {
        const calibrationValue = String(row[calibrationColIndex] || '').trim().toLowerCase();
        if (calibrationValue.includes('pcs cal') || 
            calibrationValue.includes('calibration') || 
            calibrationValue.includes('cal')) {
            return true;
        }
    }
    
    return false;
};

// Helper to format date as MM/DD/YYYY (e.g., 1/13/2026)
const formatDateForPDF = (dateStr: string | number | Date | undefined): string => {
    if (!dateStr) return '';

    let dateObj: Date | null = null;

    if (dateStr instanceof Date) {
        dateObj = dateStr;
    } else if (typeof dateStr === 'number') {
        // Excel serial date
        dateObj = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
    } else if (typeof dateStr === 'string') {
        // Try parsing the date string
        dateObj = new Date(dateStr);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
        const month = dateObj.getMonth() + 1; // getMonth() returns 0-11
        const day = dateObj.getDate();
        const year = dateObj.getFullYear();
        return `${month}/${day}/${year}`;
    }

    // If it's already in a format we can use, return as is
    return String(dateStr);
};

// Helper to format cell value for display
const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        // Check if it's an Excel date serial number
        if (value > 25567 && value < 2958465) {
            return formatDateForPDF(value);
        }
        return value.toString();
    }
    return String(value);
};

// Helper function to fill certificate form fields - EXACT COPY of CERTIF report logic
const fillCertificateForm = async (
    form: any,
    data: ExtractedData & Record<string, any>,
    certConfig: any,
    inspectors?: Inspector[],
    generalVariables?: Map<string, string>
): Promise<void> => {
    console.log('=== CERTIFICATE FILLING DEBUG START ===');
    console.log('Certificate data object:', data);
    console.log('Certificate config mappings count:', certConfig.mappings.length);
    console.log('Available form fields:', form.getFields().map((f: any) => f.getName()).join(', '));
    
    // First pass: Handle Inspection Date splitting first
    const inspectionDateMapping = certConfig.mappings.find(m => m.pdfFieldId === 'Dates of Inspection' && m.source === 'user_input');
    console.log('Inspection date mapping found:', !!inspectionDateMapping);
    if (inspectionDateMapping) {
        const inspectionDateValue = data[inspectionDateMapping.pdfFieldId] || data['Certificate_DatesOfInspection'] || data['Date'] || '';
        console.log('Inspection date value:', inspectionDateValue);
        if (inspectionDateValue) {
            const formattedDate = formatDateForPDF(inspectionDateValue);
            const dateParts = formattedDate.split('/');
            
            if (dateParts.length === 3) {
                const [month, day, year] = dateParts;
                
                // Fill all date fields
                const dateFields = [
                    { id: 'Dates of Inspection', value: month },
                    { id: 'undefined', value: day },
                    { id: 'undefined_2', value: year },
                    { id: 'TO', value: month },
                    { id: 'undefined_3', value: day },
                    { id: 'undefined_4', value: year },
                    { id: 'Date Certificate Issued', value: month },
                    { id: 'undefined_5', value: day },
                    { id: 'undefined_6a', value: year }
                ];
                
                dateFields.forEach(({ id, value }) => {
                    try {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/e11fb577-b11a-452a-988c-2b2628576451',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdfGenerator.ts:212',message:'Attempting to get date field',data:{fieldId:id,availableFields:form.getFields().map((f:any)=>f.getName())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                        // #endregion
                        const field = form.getTextField(id);
                        if (field) {
                            console.log(`CERTIFICATE: Filling date field "${id}" with value "${value}"`);
                            field.setText(value);
                            // updateFieldAppearances() will be called on the whole form after all fields are set
                        } else {
                            console.warn(`CERTIFICATE: Date field "${id}" not found in form`);
                        }
                    } catch (err: any) {
                        console.warn(`CERTIFICATE: Error filling date field ${id}:`, err);
                        // #region agent log
                        try {
                            fetch('http://127.0.0.1:7242/ingest/e11fb577-b11a-452a-988c-2b2628576451',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdfGenerator.ts:223',message:'Error getting date field',data:{fieldId:id,error:err?.message||String(err),availableFields:form.getFields().map((f:any)=>f.getName())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                        } catch {}
                        // #endregion
                    }
                });
            }
        }
    }

    // Handle Applicable Units text splitting
    const applicableUnitsMapping = certConfig.mappings.find(m => m.pdfFieldId === 'Applicable Units or Common Areas 1' && m.source === 'user_input');
    console.log('Applicable Units mapping found:', !!applicableUnitsMapping);
    if (applicableUnitsMapping) {
        const applicableUnitsValue = data[applicableUnitsMapping.pdfFieldId] || data['Certificate_ApplicableUnits'] || '';
        console.log('Applicable Units value:', applicableUnitsValue);
        if (applicableUnitsValue) {
            const maxLength = 50;
            const text = String(applicableUnitsValue);
            if (text.length > maxLength) {
                let breakPoint = maxLength;
                for (let i = maxLength; i > maxLength * 0.7; i--) {
                    if (text[i] === ' ' || text[i] === ',' || text[i] === '-') {
                        breakPoint = i + 1;
                        break;
                    }
                }
                const firstPart = text.substring(0, breakPoint).trim();
                const secondPart = text.substring(breakPoint).trim();
                
                try {
                    const secondField = form.getTextField('Applicable Units or Common Areas 2');
                    if (secondField) {
                        secondField.setText(secondPart);
                        // updateFieldAppearances() will be called on the whole form after all fields are set
                    }
                } catch (err) {
                    console.warn('CERTIFICATE: Error filling Applicable Units field 2:', err);
                }
            }
        }
    }

    // Iterate Mappings for all other fields (but skip Check Box8 - handle at end)
    const checkboxMapping = certConfig.mappings.find(m => m.pdfFieldId === 'Check Box8');
    const otherMappings = certConfig.mappings.filter(m => m.pdfFieldId !== 'Check Box8');
    console.log(`CERTIFICATE: Processing ${otherMappings.length} other mappings (excluding Check Box8)`);
    
    otherMappings.forEach(mapping => {
        console.log(`CERTIFICATE: Processing field "${mapping.pdfFieldId}" (source: ${mapping.source})`);
        try {
            // Skip fields that were already handled in special cases
            if (mapping.pdfFieldId === 'Dates of Inspection' || 
                ['undefined', 'undefined_2', 'TO', 'undefined_3', 'undefined_4', 
                 'Date Certificate Issued', 'undefined_5', 'undefined_6a', 'Signature'].includes(mapping.pdfFieldId) ||
                (mapping.pdfFieldId === 'Applicable Units or Common Areas 1' && mapping.source === 'user_input')) {
                // These are handled above, but we still need to process the main field
                if (mapping.pdfFieldId === 'Dates of Inspection' && mapping.source === 'user_input') {
                    const field = form.getTextField(mapping.pdfFieldId);
                    if (field) {
                        const inspectionDateValue = data[mapping.pdfFieldId] || data['Certificate_DatesOfInspection'] || data['Date'] || '';
                        if (inspectionDateValue) {
                            const formattedDate = formatDateForPDF(inspectionDateValue);
                            const dateParts = formattedDate.split('/');
                            if (dateParts.length === 3) {
                                field.setText(dateParts[0]); // MM
                                // updateFieldAppearances() will be called on the whole form after all fields are set
                            }
                        }
                    }
                } else if (mapping.pdfFieldId === 'Applicable Units or Common Areas 1' && mapping.source === 'user_input') {
                    const field = form.getTextField(mapping.pdfFieldId);
                    if (field) {
                        let valueToFill = data[mapping.pdfFieldId] || data['Certificate_ApplicableUnits'] || '';
                        if (valueToFill) {
                            const maxLength = 50;
                            const text = String(valueToFill);
                            if (text.length > maxLength) {
                                let breakPoint = maxLength;
                                for (let i = maxLength; i > maxLength * 0.7; i--) {
                                    if (text[i] === ' ' || text[i] === ',' || text[i] === '-') {
                                        breakPoint = i + 1;
                                        break;
                                    }
                                }
                                valueToFill = text.substring(0, breakPoint).trim();
                            }
                        }
                        field.setText(String(valueToFill));
                        // updateFieldAppearances() will be called on the whole form after all fields are set
                    }
                }
                return; // Skip other special case fields as they're already handled
            }

            // Skip signature field - it's a PDFSignature, not a text field
            if (mapping.pdfFieldId === 'Signature of Inspector  Risk Assessor') {
                console.log(`CERTIFICATE: Skipping signature field "${mapping.pdfFieldId}" - it's a signature field, not text`);
                return;
            }

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e11fb577-b11a-452a-988c-2b2628576451',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdfGenerator.ts:319',message:'Attempting to get field',data:{fieldId:mapping.pdfFieldId,availableFields:form.getFields().map((f:any)=>f.getName())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            const field = form.getTextField(mapping.pdfFieldId);
            if (!field) {
                console.warn(`CERTIFICATE: Field "${mapping.pdfFieldId}" found in config but not in PDF.`);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e11fb577-b11a-452a-988c-2b2628576451',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdfGenerator.ts:322',message:'Field not found',data:{fieldId:mapping.pdfFieldId,availableFields:form.getFields().map((f:any)=>f.getName())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                // #endregion
                return;
            }

            let valueToFill = '';

            if (mapping.source === 'user_input') {
                // Try certificate-specific field names first, then regular field names
                valueToFill = data[mapping.pdfFieldId] || 
                              data[`Certificate_${mapping.pdfFieldId}`] ||
                              (mapping.pdfFieldId === 'Site Address' ? (data['Certificate_SiteAddress'] || data['Address'] || '') : '') ||
                              (mapping.pdfFieldId === 'Name of Inspector  Risk Assessor' ? 
                                  (data['Certificate_NameOfInspector'] || 
                                   (data.selectedInspectorId && inspectors ? 
                                    (inspectors.find(i => i.id === data.selectedInspectorId)?.name || '') : '') || '') : '') ||
                              '';
                console.log(`CERTIFICATE: Field "${mapping.pdfFieldId}" - user_input value: "${valueToFill}"`);
            } else if (mapping.source === 'static') {
                valueToFill = mapping.staticValue || '';
                console.log(`CERTIFICATE: Field "${mapping.pdfFieldId}" - static value: "${valueToFill}"`);
            } else if (mapping.source === 'excel_cell') {
                valueToFill = '';
                console.log(`CERTIFICATE: Field "${mapping.pdfFieldId}" - excel_cell (empty)`);
            }
            
            // Check if field name matches variables (general first, then inspector)
            if (!valueToFill) {
                const fieldName = mapping.pdfFieldId.toLowerCase();
                
                // Check general variables first
                if (generalVariables) {
                    for (const [varName, varValue] of generalVariables.entries()) {
                        const varNameLower = varName.toLowerCase();
                        if (fieldName === varNameLower || 
                            fieldName.includes(varNameLower) || 
                            varNameLower.includes(fieldName)) {
                            valueToFill = varValue;
                            break;
                        }
                    }
                }
                
                // Then check inspector variable values if available
                if (!valueToFill && data.selectedInspectorId && inspectors) {
                    const inspector = inspectors.find(i => i.id === data.selectedInspectorId);
                    if (inspector?.variableValues) {
                        for (const [varName, varValue] of inspector.variableValues.entries()) {
                            const varNameLower = varName.toLowerCase();
                            if (fieldName === varNameLower || 
                                fieldName.includes(varNameLower) || 
                                varNameLower.includes(fieldName)) {
                                valueToFill = varValue;
                                break;
                            }
                        }
                    }
                }
            }

            // Format dates as MM/DD/YYYY if this is a date field (but not Dates of Inspection)
            if (mapping.inputType === 'date' && valueToFill && mapping.pdfFieldId !== 'Dates of Inspection') {
                valueToFill = formatDateForPDF(valueToFill);
            }

            console.log(`CERTIFICATE: Setting field "${mapping.pdfFieldId}" to "${valueToFill}"`);
            field.setText(String(valueToFill));
            // updateFieldAppearances() will be called on the whole form after all fields are set

        } catch (err) {
            console.warn(`CERTIFICATE: Error filling field ${mapping.pdfFieldId}:`, err);
        }
    });
    
    console.log('=== CERTIFICATE FILLING DEBUG END ===');

    // Handle Check Box8 LAST to ensure it's on top of everything
    if (checkboxMapping) {
        try {
            let checkBoxText = '';
            if (checkboxMapping.source === 'user_input') {
                checkBoxText = data['Check Box8'] || data['Certificate_CheckBox8'] || '';
            } else if (checkboxMapping.source === 'static') {
                checkBoxText = checkboxMapping.staticValue || '';
            }
            
            if (checkBoxText) {
                try {
                    const textField = form.getTextField('Check Box8');
                    if (textField) {
                        textField.setText(checkBoxText);
                        try {
                            textField.setFontSize(24);
                        } catch (fontErr) {
                            console.warn('CERTIFICATE: Could not set font size:', fontErr);
                        }
                        // updateFieldAppearances() will be called on the whole form after all fields are set
                    }
                } catch (textErr) {
                    try {
                        const checkboxField = form.getCheckBox('Check Box8');
                        if (checkboxField) {
                            checkboxField.check();
                            checkboxField.updateAppearances();
                            console.warn('Check Box8 is a checkbox field, cannot write text directly');
                        }
                    } catch (checkboxErr) {
                        console.warn('Check Box8 field not found or could not be accessed:', checkboxErr);
                    }
                }
            }
        } catch (err) {
            console.warn(`Error handling Check Box8:`, err);
        }
    }
};

// Helper to calculate text width
const getTextWidth = (text: string, fontSize: number, font: any): number => {
    return font.widthOfTextAtSize(text, fontSize);
};

// Calculate a global font size that fits all visible columns
const calculateGlobalFontSize = (
    excelData: any[][],
    headerRowIndex: number,
    headerRow: any[],
    visibleColumnIndices: number[],
    colWidth: number,
    cellPadding: number,
    baseFontSize: number,
    font: any,
    boldFont: any
): number => {
    const maxTextWidth = colWidth - (cellPadding * 2);
    let minFontSize = baseFontSize;
    
    // Check all visible header cells
    visibleColumnIndices.forEach(colIndex => {
        const headerText = String(headerRow[colIndex] || '');
        if (headerText) {
            const textWidth = getTextWidth(headerText, baseFontSize, boldFont);
            if (textWidth > maxTextWidth) {
                const scaleFactor = maxTextWidth / textWidth;
                minFontSize = Math.min(minFontSize, baseFontSize * scaleFactor);
            }
        }
    });
    
    // Check all visible data cells (skip header row)
    const dataRows = excelData.slice(headerRowIndex + 1);
    dataRows.forEach((row) => {
        if (row) {
            visibleColumnIndices.forEach(colIndex => {
                if (colIndex < row.length) {
                    const cellValue = formatCellValue(row[colIndex] || '');
                    if (cellValue) {
                        const textWidth = getTextWidth(cellValue, baseFontSize, font);
                        if (textWidth > maxTextWidth) {
                            const scaleFactor = maxTextWidth / textWidth;
                            minFontSize = Math.min(minFontSize, baseFontSize * scaleFactor);
                        }
                    }
                }
            });
        }
    });
    
    // Ensure minimum readable font size (at least 4pt)
    return Math.max(4, minFontSize);
};

// Simple Table Helper Class
class SimpleTable {
    private page: any;
    private font: any;
    private boldFont: any;
    private pageWidth: number;
    private pageHeight: number;
    private margin: number;
    private rowHeight: number;
    private fontSize: number;
    private cellPadding: number;
    private columnPositions: number[] = [];
    private columnWidth: number;
    private numColumns: number;
    
    constructor(
        page: any,
        font: any,
        boldFont: any,
        pageWidth: number,
        pageHeight: number,
        margin: number,
        numColumns: number,
        rowHeight: number = 18,
        fontSize: number = 7,
        cellPadding: number = 2
    ) {
        this.page = page;
        this.font = font;
        this.boldFont = boldFont;
        this.pageWidth = pageWidth;
        this.pageHeight = pageHeight;
        this.margin = margin;
        this.rowHeight = rowHeight;
        this.fontSize = fontSize;
        this.cellPadding = cellPadding;
        this.numColumns = numColumns;
        
        // Calculate column width and positions once
        const availableWidth = pageWidth - (2 * margin);
        const totalPadding = cellPadding * (numColumns - 1);
        this.columnWidth = Math.floor((availableWidth - totalPadding) / numColumns);
        
        // Pre-calculate all column x-positions
        this.columnPositions = [];
        let x = margin;
        for (let i = 0; i < numColumns; i++) {
            this.columnPositions.push(x);
            x += this.columnWidth + cellPadding;
        }
    }
    
    drawRow(rowData: string[], y: number, isHeader: boolean = false, highlight: boolean = false) {
        const fontToUse = isHeader ? this.boldFont : this.font;
        
        // Draw highlight background if needed - brighter yellow highlight
        if (highlight) {
            const rowLeft = this.columnPositions[0];
            const rowRight = this.columnPositions[this.columnPositions.length - 1] + this.columnWidth;
            this.page.drawRectangle({
                x: rowLeft,
                y: y,
                width: rowRight - rowLeft,
                height: this.rowHeight,
                color: rgb(1, 1, 0.4), // Brighter yellow (less blue component)
                opacity: 0.5, // More opaque for brighter appearance
            });
        }
        
        // Calculate line height for wrapped text
        const lineHeight = this.fontSize * 1.2; // Line spacing
        
        // Draw cell content - allow wrapping but keep within cell bounds
        for (let i = 0; i < Math.min(rowData.length, this.columnPositions.length); i++) {
            const cellText = rowData[i] || '';
            const x = this.columnPositions[i] + this.cellPadding;
            const maxTextWidth = this.columnWidth - (this.cellPadding * 2);
            
            // Calculate how many lines the text will take
            const textWidth = fontToUse.widthOfTextAtSize(cellText, this.fontSize);
            const linesNeeded = Math.ceil(textWidth / maxTextWidth);
            const maxLines = Math.floor(this.rowHeight / lineHeight);
            const actualLines = Math.min(linesNeeded, maxLines);
            
            // Start text at the top of the cell (accounting for font baseline)
            // pdf-lib draws text from the baseline, so we need to position it higher
            const textY = y + this.rowHeight - this.fontSize - (this.cellPadding / 2);
            
            // Draw text with wrapping, constrained to cell width
            // Split text into words and build lines that fit
            const words = cellText.split(/\s+/);
            let currentLine = '';
            let currentY = textY;
            let lineCount = 0;
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = fontToUse.widthOfTextAtSize(testLine, this.fontSize);
                
                if (testWidth <= maxTextWidth && lineCount < maxLines) {
                    currentLine = testLine;
                } else {
                    // Draw current line and start new one
                    if (currentLine && lineCount < maxLines) {
                        this.page.drawText(currentLine, {
                            x,
                            y: currentY,
                            size: this.fontSize,
                            font: fontToUse,
                            color: rgb(0, 0, 0),
                        });
                        lineCount++;
                        currentY -= lineHeight;
                    }
                    currentLine = word;
                }
            }
            
            // Draw the last line
            if (currentLine && lineCount < maxLines) {
                this.page.drawText(currentLine, {
                    x,
                    y: currentY,
                    size: this.fontSize,
                    font: fontToUse,
                    color: rgb(0, 0, 0),
                });
            }
        }
        
        // Grid lines removed as requested
    }
}

// Create pages with Excel data displayed as a table
const createExcelDataPages = async (pdfDoc: PDFDocument, excelData: any[][], headerRowIndex: number): Promise<any[]> => {
    const pages: any[] = [];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Landscape orientation: width > height
    const pageWidth = 792;
    const pageHeight = 612;
    const margin = 50;
    const topMargin = 570;
    const bottomMargin = 50;
    const rowHeight = 18;
    const baseFontSize = 7;
    const cellPadding = 2;
    
    // Get header row and data
    const headerRow = excelData[headerRowIndex] || excelData[0] || [];
    const dataRows = excelData.slice(headerRowIndex + 1);
    
    // Find column indices for filtering
    const conditionColIndex = headerRow.findIndex((h: any) => 
        String(h).trim().toLowerCase() === 'condition'
    );
    const notesColIndex = headerRow.findIndex((h: any) => 
        String(h).trim().toLowerCase() === 'notes'
    );
    const pbPfColIndex = headerRow.findIndex((h: any) => 
        String(h).trim().toLowerCase().includes('pb p/f')
    );
    const calibrationColIndex = headerRow.findIndex((h: any) => 
        String(h).trim().toLowerCase().includes('calibration')
    );
    
    // Create visible columns (exclude CONDITION and NOTES)
    const visibleColumnIndices: number[] = [];
    headerRow.forEach((header, colIndex) => {
        if (colIndex !== conditionColIndex && colIndex !== notesColIndex) {
            visibleColumnIndices.push(colIndex);
        }
    });
    
    // Calculate font size that fits all columns
    const visibleHeaders = visibleColumnIndices.map(i => String(headerRow[i] || ''));
    let globalFontSize = baseFontSize;
    
    // Simple font size calculation - check headers first
    const availableWidth = pageWidth - (2 * margin);
    const totalPadding = cellPadding * (visibleColumnIndices.length - 1);
    const colWidth = Math.floor((availableWidth - totalPadding) / visibleColumnIndices.length);
    
    // Check if we need to reduce font size based on headers
    for (const headerText of visibleHeaders) {
        const textWidth = boldFont.widthOfTextAtSize(headerText, baseFontSize);
        if (textWidth > colWidth - (cellPadding * 2)) {
            const scaleFactor = (colWidth - (cellPadding * 2)) / textWidth;
            globalFontSize = Math.min(globalFontSize, baseFontSize * scaleFactor);
        }
    }
    globalFontSize = Math.max(4, globalFontSize);
    
    // Calculate rows per page
    const availableHeight = topMargin - bottomMargin;
    const rowsPerPage = Math.floor(availableHeight / rowHeight);
    
    let currentY = topMargin;
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(currentPage);
    
    // Create table helper
    let table = new SimpleTable(
        currentPage,
        font,
        boldFont,
        pageWidth,
        pageHeight,
        margin,
        visibleColumnIndices.length,
        rowHeight,
        globalFontSize,
        cellPadding
    );
    
    // Draw header row
    const headerRowData = visibleColumnIndices.map(i => String(headerRow[i] || ''));
    table.drawRow(headerRowData, currentY, true);
    currentY -= rowHeight;
    
    let rowCount = 1; // Header already drawn
    
    // Draw data rows
    dataRows.forEach((row, rowIndexInData) => {
        // Check if current row will fit on the current page
        const spaceNeeded = rowHeight;
        const spaceAvailable = currentY - bottomMargin;
        
        // If not enough space, create a new page BEFORE drawing the row
        if (spaceAvailable < spaceNeeded || rowCount >= rowsPerPage) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            pages.push(currentPage);
            currentY = topMargin;
            rowCount = 1; // Header will be drawn
            
            // Create new table helper for new page
            table = new SimpleTable(
                currentPage,
                font,
                boldFont,
                pageWidth,
                pageHeight,
                margin,
                visibleColumnIndices.length,
                rowHeight,
                globalFontSize,
                cellPadding
            );
            
            // Redraw header on new page
            table.drawRow(headerRowData, currentY, true);
            currentY -= rowHeight;
        }
        
        // Check if this row is positive (non-calibration)
        const isCalibration = isCalibrationRow(rowIndexInData, row, calibrationColIndex);
        const isPositive = !isCalibration && 
                          pbPfColIndex !== -1 && 
                          row && 
                          isPositiveValue(row[pbPfColIndex]);
        
        // Prepare row data (only visible columns)
        const rowData = visibleColumnIndices.map(i => formatCellValue(row[i] || ''));
        
        // Draw the row using table helper
        table.drawRow(rowData, currentY, false, isPositive);
        
        currentY -= rowHeight;
        rowCount++;
    });
    
    return pages;
};

// Method 4: Manual text drawing - Extract field positions and draw text directly
const flattenFormByManualDrawing = async (pdfDoc: PDFDocument, form: any): Promise<void> => {
    console.log('🔄 Attempting manual text drawing flattening...');
    
    try {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const fields = form.getFields();
        
        // Group fields by page by examining their widgets
        const fieldsByPage = new Map<number, Array<{ field: any; value: string; x: number; y: number; width: number; height: number; fontSize?: number }>>();
        
        for (const field of fields) {
            try {
                let fieldValue = '';
                let fieldName = '';
                
                // Get field value
                if (field.constructor.name.includes('TextField')) {
                    fieldValue = (field as any).getText() || '';
                    fieldName = field.getName();
                } else if (field.constructor.name.includes('CheckBox')) {
                    if ((field as any).isChecked()) {
                        fieldValue = 'X';
                        fieldName = field.getName();
                    }
                }
                
                if (!fieldValue || !fieldName) continue;
                
                // Try to get widget information
                try {
                    const acroField = (field as any).acroField;
                    if (acroField) {
                        const kids = acroField.dict?.get('Kids');
                        if (kids && Array.isArray(kids)) {
                            for (const widget of kids) {
                                try {
                                    const rect = widget.dict?.get('Rect');
                                    const pageRef = widget.dict?.get('P');
                                    
                                    if (rect && Array.isArray(rect) && rect.length >= 4 && pageRef) {
                                        const [x0, y0, x1, y1] = rect;
                                        const width = x1 - x0;
                                        const height = y1 - y0;
                                        
                                        // Find which page this widget belongs to
                                        for (let i = 0; i < pages.length; i++) {
                                            if (pages[i].ref === pageRef) {
                                                if (!fieldsByPage.has(i)) {
                                                    fieldsByPage.set(i, []);
                                                }
                                                
                                                // Calculate font size based on field height
                                                const fontSize = Math.min(12, height * 0.7);
                                                
                                                fieldsByPage.get(i)!.push({
                                                    field,
                                                    value: fieldValue,
                                                    x: x0,
                                                    y: y0, // PDF coordinates: y0 is bottom
                                                    width,
                                                    height,
                                                    fontSize
                                                });
                                                break;
                                            }
                                        }
                                    }
                                } catch (widgetErr) {
                                    // Skip this widget
                                }
                            }
                        }
                    }
                } catch (posErr) {
                    // If we can't get position, try to draw on first page at default position
                    if (pages.length > 0) {
                        if (!fieldsByPage.has(0)) {
                            fieldsByPage.set(0, []);
                        }
                        fieldsByPage.get(0)!.push({
                            field,
                            value: fieldValue,
                            x: 50,
                            y: 50,
                            width: 200,
                            height: 20,
                            fontSize: 12
                        });
                    }
                }
            } catch (fieldErr) {
                console.warn(`⚠️ Could not process field ${field.getName()}:`, fieldErr);
            }
        }
        
        // Draw text for each field on its page
        for (const [pageIndex, fieldData] of fieldsByPage.entries()) {
            const page = pages[pageIndex];
            
            for (const { value, x, y, height, fontSize } of fieldData) {
                try {
                    // PDF coordinates: y is bottom, but we want to draw from bottom
                    // Adjust y to account for text baseline
                    const textY = y + (height * 0.3); // Position text in lower third of field
                    
                    page.drawText(value, {
                        x,
                        y: textY,
                        size: fontSize || 12,
                        font,
                        color: rgb(0, 0, 0),
                    });
                } catch (drawErr: any) {
                    console.warn(`⚠️ Could not draw text "${value}":`, drawErr.message);
                }
            }
        }
        
        // Remove form fields after drawing
        try {
            for (const field of fields) {
                try {
                    field.remove();
                } catch (removeErr) {
                    // Some fields might not be removable
                }
            }
        } catch (removeErr) {
            console.warn('⚠️ Could not remove all fields, but text has been drawn');
        }
        
        console.log('✅ Manual text drawing flattening completed');
    } catch (err: any) {
        console.warn('⚠️ Manual text drawing failed:', err.message);
        throw err;
    }
};

// Method 3: Image-based flatten: Convert PDF page to image and embed it (browser-only)
const flattenFormAsImage = async (pdfDoc: PDFDocument): Promise<void> => {
    console.log('🔄 Attempting image-based flattening (screenshot approach)...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('Image-based flattening requires browser environment');
    }
    
    try {
        // Save the PDF to bytes first
        const pdfBytes = await pdfDoc.save();
        
        // Use pdf.js to render pages to canvas, then convert to images
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        const pages = pdfDoc.getPages();
        // Save original page sizes before we remove pages
        const pageSizes: Array<[number, number]> = [];
        for (const page of pages) {
            const size = page.getSize();
            // Ensure size is in the correct format [width, height]
            if (Array.isArray(size) && size.length >= 2) {
                pageSizes.push([size[0], size[1]]);
            } else {
                // Fallback to standard page size
                pageSizes.push([612, 792]); // 8.5 x 11 inches
            }
        }
        const newPages: any[] = [];
        
        // Render each page to canvas and convert to image
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pdfPage = await pdf.getPage(pageNum);
            const viewport = pdfPage.getViewport({ scale: 2.0 }); // Higher scale for better quality
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render PDF page to canvas
            await pdfPage.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Convert canvas to image
            const imageData = canvas.toDataURL('image/png');
            
            // Convert data URL to bytes
            const response = await fetch(imageData);
            const imageBytes = await response.arrayBuffer();
            
            // Embed image in new PDF page
            const image = await pdfDoc.embedPng(imageBytes);
            
            // Use saved page size (with bounds checking)
            const pageSize = pageSizes[pageNum - 1] || [612, 792];
            const [width, height] = pageSize;
            const newPage = pdfDoc.addPage([width, height]);
            
            // Scale image to fit page exactly
            // The canvas viewport dimensions need to be scaled to match PDF page dimensions
            const scaleX = width / viewport.width;
            const scaleY = height / viewport.height;
            
            newPage.drawImage(image, {
                x: 0,
                y: 0,
                width: width,
                height: height,
            });
            
            newPages.push(newPage);
        }
        
        // Remove old pages and add new ones
        for (let i = pages.length - 1; i >= 0; i--) {
            pdfDoc.removePage(i);
        }
        
        // Insert new pages at the beginning (they'll be in order since we add them sequentially)
        for (let i = 0; i < newPages.length; i++) {
            pdfDoc.insertPage(i, newPages[i]);
        }
        
        console.log('✅ Image-based flattening completed');
    } catch (err: any) {
        console.warn('⚠️ Image-based flattening failed:', err.message);
        throw err;
    }
};

// Helper function to fill Certif Template fields (for first document in XHR report)
const fillCertifFirstDocument = async (
    pdfDoc: PDFDocument,
    form: any,
    data: ExtractedData & Record<string, any>,
    config: any,
    inspectors?: Inspector[],
    generalVariables?: Map<string, string>
): Promise<void> => {
    console.log('=== FILLING CERTIF FIRST DOCUMENT ===');
    console.log('Data object keys:', Object.keys(data));
    console.log('CertifFirst data values:', {
        SiteAddress: data['CertifFirst_SiteAddress'],
        County: data['CertifFirst_County'],
        Block: data['CertifFirst_Block'],
        Lot: data['CertifFirst_Lot'],
        ApplicableUnits: data['CertifFirst_ApplicableUnits'],
        NameOfInspector: data['CertifFirst_NameOfInspector'],
        NJDOH_ID: data['CertifFirst_NJDOH_ID'],
        NJDCA_CERT: data['CertifFirst_NJDCA_CERT'],
        DatesOfInspection: data['CertifFirst_DatesOfInspection'],
        CheckBox8: data['CertifFirst_CheckBox8']
    });
    
    // Embed a standard font for field appearances
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Get all available form fields for debugging
    const allFields = form.getFields();
    const availableFieldNames = allFields.map((f: any) => f.getName());
    console.log('Available PDF form fields:', availableFieldNames);
    
    // Get CERTIF config to use its field structure
    const certifConfig = getReportConfig('CERTIF');
    if (!certifConfig) {
        console.warn('CERTIF config not found, using basic field mapping');
        return;
    }
    
    // Map CertifFirst_* fields to actual PDF field names
    const fieldMapping: Record<string, string> = {
        'CertifFirst_SiteAddress': 'Site Address',
        'CertifFirst_County': 'County',
        'CertifFirst_Block': 'Block',
        'CertifFirst_Lot': 'Lot',
        'CertifFirst_ApplicableUnits': 'Applicable Units or Common Areas 1',
        'CertifFirst_NameOfInspector': 'Name of Inspector  Risk Assessor',
        'CertifFirst_NJDOH_ID': 'NJDOH ID',
        'CertifFirst_NJDCA_CERT': 'NJDCA CERT',
        'CertifFirst_DatesOfInspection': 'Dates of Inspection',
        'CertifFirst_CheckBox8': 'Check Box8'
    };
    
    // Handle Dates of Inspection splitting
    const datesValue = data['CertifFirst_DatesOfInspection'] || '';
    console.log('Dates of Inspection value:', datesValue);
    if (datesValue) {
        const formattedDate = formatDateForPDF(datesValue);
        const dateParts = formattedDate.split('/');
        console.log('Formatted date parts:', dateParts);
        
        if (dateParts.length === 3) {
            const [month, day, year] = dateParts;
            
            const dateFields = [
                { id: 'Dates of Inspection', value: month },
                { id: 'undefined', value: day },
                { id: 'undefined_2', value: year },
                { id: 'TO', value: month },
                { id: 'undefined_3', value: day },
                { id: 'undefined_4', value: year },
                { id: 'Date Certificate Issued', value: month },
                { id: 'undefined_5', value: day },
                { id: 'undefined_6a', value: year }
            ];
            
            for (const { id, value } of dateFields) {
                try {
                    const field = form.getTextField(id);
                    if (field) {
                        console.log(`Setting date field "${id}" to "${value}"`);
                        field.setText(value);
                        try {
                            await field.updateAppearances(font);
                        } catch (err: any) {
                            console.warn(`Error updating appearances for ${id}:`, err);
                        }
                    } else {
                        console.warn(`Date field "${id}" not found in PDF. Available fields:`, availableFieldNames);
                    }
                } catch (err) {
                    console.warn(`Error filling date field ${id}:`, err);
                }
            }
        }
    }
    
    // Handle Applicable Units text splitting
    const applicableUnitsValue = data['CertifFirst_ApplicableUnits'] || '';
    console.log('Applicable Units value:', applicableUnitsValue);
    if (applicableUnitsValue) {
        const maxLength = 50;
        const text = String(applicableUnitsValue);
        if (text.length > maxLength) {
            let breakPoint = maxLength;
            for (let i = maxLength; i > maxLength * 0.7; i--) {
                if (text[i] === ' ' || text[i] === ',' || text[i] === '-') {
                    breakPoint = i + 1;
                    break;
                }
            }
            const firstPart = text.substring(0, breakPoint).trim();
            const secondPart = text.substring(breakPoint).trim();
            
            try {
                const firstField = form.getTextField('Applicable Units or Common Areas 1');
                const secondField = form.getTextField('Applicable Units or Common Areas 2');
                if (firstField) {
                    console.log(`Setting "Applicable Units or Common Areas 1" to "${firstPart}"`);
                    firstField.setText(firstPart);
                    try {
                        await firstField.updateAppearances(font);
                    } catch (err: any) {
                        console.warn('Error updating appearances for Applicable Units 1:', err);
                    }
                } else {
                    console.warn('Field "Applicable Units or Common Areas 1" not found');
                }
                if (secondField) {
                    console.log(`Setting "Applicable Units or Common Areas 2" to "${secondPart}"`);
                    secondField.setText(secondPart);
                    try {
                        await secondField.updateAppearances(font);
                    } catch (err: any) {
                        console.warn('Error updating appearances for Applicable Units 2:', err);
                    }
                } else {
                    console.warn('Field "Applicable Units or Common Areas 2" not found');
                }
            } catch (err) {
                console.warn('Error filling Applicable Units fields:', err);
            }
        } else {
            try {
                const firstField = form.getTextField('Applicable Units or Common Areas 1');
                if (firstField) {
                    console.log(`Setting "Applicable Units or Common Areas 1" to "${text}"`);
                    firstField.setText(text);
                    try {
                        await firstField.updateAppearances(font);
                    } catch (err: any) {
                        console.warn('Error updating appearances for Applicable Units 1:', err);
                    }
                } else {
                    console.warn('Field "Applicable Units or Common Areas 1" not found');
                }
            } catch (err) {
                console.warn('Error filling Applicable Units field:', err);
            }
        }
    }
    
    // Fill other fields
    for (const [dataKey, pdfFieldId] of Object.entries(fieldMapping)) {
        if (dataKey === 'CertifFirst_DatesOfInspection' || dataKey === 'CertifFirst_ApplicableUnits') {
            continue; // Already handled above
        }
        
        try {
            const value = data[dataKey] || '';
            console.log(`Processing field: ${dataKey} -> ${pdfFieldId}, value: "${value}"`);
            if (value) {
                const field = form.getTextField(pdfFieldId);
                if (field) {
                    console.log(`Setting field "${pdfFieldId}" to "${value}"`);
                    field.setText(String(value));
                    try {
                        await field.updateAppearances(font);
                    } catch (err: any) {
                        console.warn(`Error updating appearances for ${pdfFieldId}:`, err);
                    }
                } else {
                    console.warn(`Field "${pdfFieldId}" not found in PDF. Available fields:`, availableFieldNames);
                }
            } else {
                console.log(`Skipping field "${pdfFieldId}" - no value provided`);
            }
        } catch (err) {
            console.warn(`Error filling field ${pdfFieldId}:`, err);
        }
    }
    
    // Handle Check Box8
    try {
        const checkBoxValue = data['CertifFirst_CheckBox8'] || '';
        console.log('Check Box8 value:', checkBoxValue);
        if (checkBoxValue) {
            try {
                const textField = form.getTextField('Check Box8');
                if (textField) {
                    console.log(`Setting Check Box8 to "${checkBoxValue}"`);
                    textField.setText(checkBoxValue);
                    try {
                        textField.setFontSize(24);
                    } catch (fontErr) {
                        console.warn('Could not set font size:', fontErr);
                    }
                    try {
                        await textField.updateAppearances(font);
                    } catch (err: any) {
                        console.warn('Error updating appearances for Check Box8:', err);
                    }
                } else {
                    console.warn('Check Box8 not found as text field, trying checkbox...');
                    try {
                        const checkboxField = form.getCheckBox('Check Box8');
                        if (checkboxField) {
                            checkboxField.check();
                            checkboxField.updateAppearances(font);
                            console.warn('Check Box8 is a checkbox field, cannot write text directly');
                        }
                    } catch (checkboxErr) {
                        console.warn('Check Box8 field not found:', checkboxErr);
                    }
                }
            } catch (textErr) {
                console.warn('Error handling Check Box8:', textErr);
            }
        }
    } catch (err) {
        console.warn('Error handling Check Box8:', err);
    }
    
    // Fill static fields from CERTIF config
    for (const mapping of certifConfig.mappings) {
        if (mapping.source === 'static' && mapping.staticValue) {
            try {
                const field = form.getTextField(mapping.pdfFieldId);
                if (field) {
                    console.log(`Setting static field "${mapping.pdfFieldId}" to "${mapping.staticValue}"`);
                    field.setText(mapping.staticValue);
                    try {
                        await field.updateAppearances(font);
                    } catch (err: any) {
                        console.warn(`Error updating appearances for static field ${mapping.pdfFieldId}:`, err);
                    }
                }
            } catch (err) {
                // Field might not exist or might be a different type
                console.log(`Static field "${mapping.pdfFieldId}" not found or not a text field`);
            }
        }
    }
    
    // Update all field appearances one more time to ensure everything is visible
    try {
        const fields = form.getFields();
        console.log(`Updating appearances for ${fields.length} fields`);
        for (const field of fields) {
            try {
                if ('updateAppearances' in field) {
                    await field.updateAppearances(font);
                }
            } catch (err) {
                // Ignore errors for individual fields
            }
        }
    } catch (err) {
        console.warn('Error updating field appearances:', err);
    }
    
    console.log('=== CERTIF FIRST DOCUMENT FILLED ===');
};

export const generatePDFReport = async (
    data: ExtractedData & Record<string, any>, 
    reportType: string | null,
    generalTypedDocuments?: Map<string, Document>,
    inspectorDocuments?: Map<string, Document[]>,
    inspectors?: Inspector[],
    generalVariables?: Map<string, string>
) => {
    try {
    const config = getReportConfig(reportType);
    if (!config) {
        throw new Error('Report configuration not found');
    }

        // 1. Load Main Template
        // Use utility to get template URLs to try
        const templateUrls = getTemplateUrl(config.templateUrl);
        const templateFilename = config.templateUrl.replace('/templates/', '');
        
        console.log('Fetching main template, trying URLs:', templateUrls);
        let templateResponse: Response | null = null;
        
        // Try each URL until one works
        for (const url of templateUrls) {
            try {
                templateResponse = await fetch(url, { cache: 'no-cache' });
                if (templateResponse.ok) {
                    console.log(`✅ Successfully fetched main template from: ${url}`);
                    break;
                }
            } catch (err: any) {
                console.warn(`Failed to fetch main template from ${url}:`, err.message);
                templateResponse = null;
            }
        }
        
        if (!templateResponse || !templateResponse.ok) {
            throw new Error(
                `Failed to fetch template: ${templateResponse?.status || 'Network Error'} ${templateResponse?.statusText || ''}.\n\n` +
                `Tried URLs: ${templateUrls.join(', ')}\n` +
                `Please ensure:\n` +
                `  1. Template file exists at: public/templates/${templateFilename}\n` +
                `  2. React dev server is running (for development) or API server is running (npm run server)`
            );
        }
        
        const existingPdfBytes = await templateResponse.arrayBuffer();
        if (existingPdfBytes.byteLength === 0) {
            throw new Error(`Template file ${config.templateUrl} is empty. Please check the file.`);
        }
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();

        // Store the original page count and identify the target page index (3rd-to-last from original template)
        // This is the page with new form fields that should be removed if results are positive
        let targetPageIndex: number | null = null;
        if (reportType === 'XHR') {
            const originalPageCount = pdfDoc.getPageCount();
            // 3rd-to-last page: if there are 5 pages (0-4), 3rd-to-last is index 2
            // But user says it's the 6th page (index 5), so let's use that
            if (originalPageCount >= 6) {
                targetPageIndex = 5; // 6th page (0-indexed)
            } else if (originalPageCount >= 3) {
                // Fallback: calculate 3rd-to-last
                targetPageIndex = originalPageCount - 3;
            }
            console.log(`XHR template has ${originalPageCount} pages. Target page index: ${targetPageIndex}`);
        }

        // 2. Fill form fields - use helper function for CERTIF, regular logic for others
        if (reportType === 'CERTIF') {
            // Use the helper function for certificate reports
            await fillCertificateForm(form, data, config, inspectors, generalVariables);
        } else {
            // For non-certificate reports, use the original logic
            // First pass: Handle special cases that need to populate multiple fields
        // Handle Inspection Date splitting first
        const inspectionDateMapping = config.mappings.find(m => m.pdfFieldId === 'Dates of Inspection' && m.source === 'user_input');
        if (inspectionDateMapping) {
            const inspectionDateValue = data[inspectionDateMapping.pdfFieldId] || '';
            if (inspectionDateValue) {
                const formattedDate = formatDateForPDF(inspectionDateValue);
                const dateParts = formattedDate.split('/');
                
                if (dateParts.length === 3) {
                    const [month, day, year] = dateParts;
                    
                    // Fill all date fields
                    const dateFields = [
                        { id: 'Dates of Inspection', value: month },
                        { id: 'undefined', value: day },
                        { id: 'undefined_2', value: year },
                        { id: 'TO', value: month },
                        { id: 'undefined_3', value: day },
                        { id: 'undefined_4', value: year },
                        { id: 'Date Certificate Issued', value: month },
                        { id: 'undefined_5', value: day },
                        { id: 'undefined_6a', value: year }
                    ];
                    
                    dateFields.forEach(({ id, value }) => {
                        try {
                            const field = form.getTextField(id);
                            if (field) {
                                field.setText(value);
                                field.updateAppearances().catch(() => {});
                            }
                        } catch (err) {
                            console.warn(`Error filling date field ${id}:`, err);
                        }
                    });
                }
            }
        }

        // Handle Applicable Units text splitting
        const applicableUnitsMapping = config.mappings.find(m => m.pdfFieldId === 'Applicable Units or Common Areas 1' && m.source === 'user_input');
        if (applicableUnitsMapping) {
            const applicableUnitsValue = data[applicableUnitsMapping.pdfFieldId] || '';
            if (applicableUnitsValue) {
                const maxLength = 50;
                const text = String(applicableUnitsValue);
                if (text.length > maxLength) {
                    let breakPoint = maxLength;
                    for (let i = maxLength; i > maxLength * 0.7; i--) {
                        if (text[i] === ' ' || text[i] === ',' || text[i] === '-') {
                            breakPoint = i + 1;
                            break;
                        }
                    }
                    const firstPart = text.substring(0, breakPoint).trim();
                    const secondPart = text.substring(breakPoint).trim();
                    
                    try {
                        const secondField = form.getTextField('Applicable Units or Common Areas 2');
                        if (secondField) {
                            secondField.setText(secondPart);
                            secondField.updateAppearances().catch(() => {});
                        }
                    } catch (err) {
                        console.warn('Error filling Applicable Units field 2:', err);
                    }
                }
            }
        }

        // 3. Handle special field mappings for XHR reports
        // Note: Fields that reuse values (Address, address, insp date, etc.) are now handled
        // in the main loop by reading from the same data source - no special copying needed
        if (reportType === 'XHR') {
            // Fill Inspector name from dropdown if selected (before main loop processes it)
            if (data.selectedInspectorId && inspectors) {
                const inspector = inspectors.find(i => i.id === data.selectedInspectorId);
                if (inspector?.name && !data['Inspector name']) {
                    // Pre-fill Inspector name if not already set
                    data['Inspector name'] = inspector.name;
                }
            }
        }

        // 4. Iterate Mappings for all other fields (but skip Check Box8 - handle at end)
        const checkboxMapping = config.mappings.find(m => m.pdfFieldId === 'Check Box8');
            // Skip Certificate_* and CertifFirst_* fields - they're only for the certificate page, not the main form
            const otherMappings = config.mappings.filter(m => 
                m.pdfFieldId !== 'Check Box8' && 
                !m.pdfFieldId.startsWith('Certificate_') &&
                !m.pdfFieldId.startsWith('CertifFirst_')
            );
        
        otherMappings.forEach(mapping => {
            try {
                // Skip fields that were already handled in special cases
                if (mapping.pdfFieldId === 'Dates of Inspection' || 
                    ['undefined', 'undefined_2', 'TO', 'undefined_3', 'undefined_4', 
                     'Date Certificate Issued', 'undefined_5', 'undefined_6a', 'Signature'].includes(mapping.pdfFieldId) ||
                    (mapping.pdfFieldId === 'Applicable Units or Common Areas 1' && mapping.source === 'user_input')) {
                    // These are handled above, but we still need to process the main field
                    if (mapping.pdfFieldId === 'Dates of Inspection' && mapping.source === 'user_input') {
                        const field = form.getTextField(mapping.pdfFieldId);
                        if (field) {
                            const inspectionDateValue = data[mapping.pdfFieldId] || '';
                            if (inspectionDateValue) {
                                const formattedDate = formatDateForPDF(inspectionDateValue);
                                const dateParts = formattedDate.split('/');
                                if (dateParts.length === 3) {
                                    field.setText(dateParts[0]); // MM
                                    field.updateAppearances().catch(() => {});
                                }
                            }
                        }
                    } else if (mapping.pdfFieldId === 'Applicable Units or Common Areas 1' && mapping.source === 'user_input') {
                        const field = form.getTextField(mapping.pdfFieldId);
                        if (field) {
                            let valueToFill = data[mapping.pdfFieldId] || '';
                            if (valueToFill) {
                                const maxLength = 50;
                                const text = String(valueToFill);
                                if (text.length > maxLength) {
                                    let breakPoint = maxLength;
                                    for (let i = maxLength; i > maxLength * 0.7; i--) {
                                        if (text[i] === ' ' || text[i] === ',' || text[i] === '-') {
                                            breakPoint = i + 1;
                                            break;
                                        }
                                    }
                                    valueToFill = text.substring(0, breakPoint).trim();
                                }
                            }
                            field.setText(String(valueToFill));
                            field.updateAppearances().catch(() => {});
                        }
                    }
                    return; // Skip other special case fields as they're already handled
                }

                const field = form.getTextField(mapping.pdfFieldId);
                if (!field) {
                    console.warn(`Field ${mapping.pdfFieldId} found in config but not in PDF.`);
                    return;
                }

                // Skip static fields with empty staticValue that are meant to be filled from other fields
                // (These are handled in the special XHR mapping section above)
                // Also skip Date field for XHR since it's handled in the special section
                // No special skipping needed - all fields are processed normally in main loop

                let valueToFill = '';

                if (mapping.source === 'user_input') {
                    // For XHR reports, some fields reuse values from other fields
                    if (reportType === 'XHR') {
                        // address (lowercase, on page 6) reuses Address value
                        if (mapping.pdfFieldId === 'address') {
                            valueToFill = data['Address'] || data[mapping.pdfFieldId] || '';
                        }
                        // Date-related fields (insp date, insp date end, cert date) reuse Date value
                        else if (mapping.pdfFieldId === 'insp date' || mapping.pdfFieldId === 'insp date end' || mapping.pdfFieldId === 'cert date') {
                            valueToFill = data['Date'] || data[mapping.pdfFieldId] || '';
                        }
                        // inpector name (typo) reuses Inspector name value
                        else if (mapping.pdfFieldId === 'inpector name ') {
                            valueToFill = data['Inspector name'] || data[mapping.pdfFieldId] || '';
                        }
                        else {
                            valueToFill = data[mapping.pdfFieldId] || '';
                        }
                    } else {
                        valueToFill = data[mapping.pdfFieldId] || '';
                    }
                } else if (mapping.source === 'static') {
                    valueToFill = mapping.staticValue || '';
                    // For XHR reports, static fields with empty values that should reuse other field values
                    if (reportType === 'XHR' && !valueToFill) {
                        // Date-related fields (insp date, insp date end, cert date) reuse Date value
                        if (mapping.pdfFieldId === 'insp date' || mapping.pdfFieldId === 'insp date end' || mapping.pdfFieldId === 'cert date') {
                            valueToFill = data['Date'] || '';
                        }
                        // inpector name (typo) reuses Inspector name value
                        else if (mapping.pdfFieldId === 'inpector name ') {
                            valueToFill = data['Inspector name'] || '';
                        }
                        // address (lowercase) reuses Address value
                        else if (mapping.pdfFieldId === 'address') {
                            valueToFill = data['Address'] || '';
                        }
                    }
                } else if (mapping.source === 'excel_cell') {
                    // TODO: Implement Excel Extraction Logic here
                    // For now, we mock or leave empty unless data is passed via inputs
                    valueToFill = '';
                }
                
                // Check if field name matches variables (general first, then inspector)
                if (!valueToFill) {
                    const fieldName = mapping.pdfFieldId.toLowerCase();
                    
                    // Check general variables first
                    if (generalVariables) {
                        for (const [varName, varValue] of generalVariables.entries()) {
                            const varNameLower = varName.toLowerCase();
                            if (fieldName === varNameLower || 
                                fieldName.includes(varNameLower) || 
                                varNameLower.includes(fieldName)) {
                                valueToFill = varValue;
                                break;
                            }
                        }
                    }
                    
                    // Then check inspector variable values if available
                    if (!valueToFill && data.selectedInspectorId && inspectors) {
                        const inspector = inspectors.find(i => i.id === data.selectedInspectorId);
                        if (inspector?.variableValues) {
                            for (const [varName, varValue] of inspector.variableValues.entries()) {
                                const varNameLower = varName.toLowerCase();
                                if (fieldName === varNameLower || 
                                    fieldName.includes(varNameLower) || 
                                    varNameLower.includes(fieldName)) {
                                    valueToFill = varValue;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Format dates as MM/DD/YYYY if this is a date field (but not Dates of Inspection)
                if (mapping.inputType === 'date' && valueToFill && mapping.pdfFieldId !== 'Dates of Inspection') {
                    valueToFill = formatDateForPDF(valueToFill);
                }
                
                // Format date fields that reuse Date value (static fields that get date values)
                if (reportType === 'XHR' && valueToFill && 
                    (mapping.pdfFieldId === 'insp date' || mapping.pdfFieldId === 'insp date end' || mapping.pdfFieldId === 'cert date')) {
                    valueToFill = formatDateForPDF(valueToFill);
                }
                
                // Ensure Numb1 and Numb2 default to 0 if empty
                if (reportType === 'XHR' && (mapping.pdfFieldId === 'Numb1' || mapping.pdfFieldId === 'Numb2')) {
                    if (!valueToFill || valueToFill === '' || valueToFill === 'undefined' || valueToFill === 'null') {
                        valueToFill = '0';
                    }
                }

                field.setText(String(valueToFill));
                
                // Ensure text appears on top by updating appearances
                // This ensures the text is properly rendered and visible
                try {
                    field.updateAppearances();
                } catch (e) {
                    // Some fields may not support updateAppearances, that's okay
                }

            } catch (err) {
                console.warn(`Error filling field ${mapping.pdfFieldId}:`, err);
            }
        });

        // Note: Fields that reuse values are now handled in main loop above
        // No special copying needed - they read from the same data source

            // 4. Handle Check Box8 LAST to ensure it's on top of everything - write user input in large, obvious text
            if (checkboxMapping) {
                try {
                    // Get the user's input text for Check Box8
                    let checkBoxText = '';
                    if (checkboxMapping.source === 'user_input') {
                        checkBoxText = data['Check Box8'] || '';
                    } else if (checkboxMapping.source === 'static') {
                        checkBoxText = checkboxMapping.staticValue || '';
                    }
                    
                    if (checkBoxText) {
                        // Try as text field first (most likely)
                        try {
                            const textField = form.getTextField('Check Box8');
                            if (textField) {
                                // Write the user's text
                                textField.setText(checkBoxText);
                                // Set a large font size to make it big and obvious
                                try {
                                    textField.setFontSize(24); // Large, obvious font size
                                } catch (fontErr) {
                                    // If setFontSize fails, try alternative approach
                                    console.warn('Could not set font size:', fontErr);
                                }
                                // Ensure it's visible and on top
                                textField.updateAppearances();
                            }
                        } catch (textErr) {
                            // If it's not a text field, try as checkbox but write text to a label instead
                            try {
                                const checkboxField = form.getCheckBox('Check Box8');
                                if (checkboxField) {
                                    // For checkboxes, we can't set text directly, but we can still make it visible
                                    checkboxField.check();
                                    checkboxField.updateAppearances();
                                    // Try to get the page and draw text nearby if possible
                                    console.warn('Check Box8 is a checkbox field, cannot write text directly');
                                }
                            } catch (checkboxErr) {
                                console.warn('Check Box8 field not found or could not be accessed:', checkboxErr);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Error handling Check Box8:`, err);
                }
            }
        }

        // Store signature image info to draw last (on top of everything)
        let signatureImageData: { image: any; page: any; x: number; y: number; width: number; height: number } | null = null;
        
        // 3. Prepare Signature image - will be drawn last to appear on top
        if (reportType === 'CERTIF' && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments.get(data.selectedInspectorId) || [];
                // Find signature document (look for document type containing "signature")
                const signatureDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                if (signatureDoc && signatureDoc.file) {
                    try {
                        // Known position of signature (from when we removed the field)
                        // Move 20px higher: original y=86.56, now y=106.56
                        const sigX = 594.72;
                        const sigY = 106.56; // Bottom-left y coordinate (20px higher than original 86.56)
                        const sigWidth = 83.4;
                        const sigHeight = 50;

                        // Get first page (where signature should be)
                        const pages = pdfDoc.getPages();
                        const targetPage = pages[0]; // Signature is on first page

                        // Embed the signature image
                        const arrayBuffer = await signatureDoc.file.arrayBuffer();
                        let image;
                        
                        if (signatureDoc.file.type === 'image/png') {
                            image = await pdfDoc.embedPng(arrayBuffer);
                        } else if (signatureDoc.file.type === 'image/jpeg' || signatureDoc.file.type === 'image/jpg') {
                            image = await pdfDoc.embedJpg(arrayBuffer);
                        } else {
                            // Try PNG first, then JPEG
                            try {
                                image = await pdfDoc.embedPng(arrayBuffer);
                            } catch {
                                image = await pdfDoc.embedJpg(arrayBuffer);
                            }
                        }

                        // Calculate image dimensions and scale to fit, then make 25% bigger
                        const imageDims = image.scale(1);
                        const scaleX = sigWidth / imageDims.width;
                        const scaleY = sigHeight / imageDims.height;
                        let scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
                        
                        // Make it 25% bigger (1.25x the size)
                        scale = scale * 1.25;

                        const scaledWidth = imageDims.width * scale;
                        const scaledHeight = imageDims.height * scale;

                        // Center the image in the signature location
                        const imageX = sigX + (sigWidth - scaledWidth) / 2;
                        // Note: PDF coordinates start from bottom-left, so y is the bottom of the field
                        const imageY = sigY + (sigHeight - scaledHeight) / 2;

                        // Store image data to draw later (on top of everything)
                        signatureImageData = {
                            image,
                            page: targetPage,
                            x: imageX,
                            y: imageY,
                            width: scaledWidth,
                            height: scaledHeight
                        };
                    } catch (sigErr) {
                        console.warn('Error preparing signature image:', sigErr);
                    }
                }
            } catch (err) {
                console.warn('Error handling signature:', err);
            }
        }

        // 5. Add Excel data pages before the last page (skip for CERTIF reports)
        if (reportType !== 'CERTIF' && data.fullExcelData && data.fullExcelData.length > 0) {
            const totalPages = pdfDoc.getPageCount();
            // Calculate insertion point: before last page
            // If totalPages is 5, we want to insert at index 4 (before page 5)
            const insertBeforeIndex = Math.max(0, totalPages - 1);
            
            // Create a temporary PDF document to build Excel pages
            const tempPdfDoc = await PDFDocument.create();
            const excelPages = await createExcelDataPages(tempPdfDoc, data.fullExcelData, data.headerRowIndex || 0);
            
            // Copy Excel pages from temp document to main document at correct position
            const copiedPages = await pdfDoc.copyPages(tempPdfDoc, excelPages.map((_, i) => i));
            
            // Insert them at the correct position (in reverse order to maintain indices)
            for (let i = copiedPages.length - 1; i >= 0; i--) {
                pdfDoc.insertPage(insertBeforeIndex, copiedPages[i]);
            }
        }

        // 6. Append documents at the end (General Certificate and Inspector License) - skip for CERTIF reports
        // TEMPORARILY: Skip if documents don't exist instead of throwing errors
        if (reportType !== 'CERTIF') {
            // Append General Certificate (if available)
            if (data.certificateDocumentType && generalTypedDocuments && generalTypedDocuments.has(data.certificateDocumentType)) {
            const certDoc = generalTypedDocuments.get(data.certificateDocumentType!)!;
            console.log('Certificate document found:', {
                fileName: certDoc.fileName,
                fileType: certDoc.file?.type,
                hasFile: !!certDoc.file,
                fileSize: certDoc.file instanceof Blob ? certDoc.file.size : 'unknown',
                certificateType: data.certificateDocumentType
            });
            
                // TEMPORARILY: Skip if file is missing or invalid
            if (!certDoc.file || (certDoc.file instanceof Blob && certDoc.file.size === 0)) {
                    console.warn(`Certificate document file is missing for "${certDoc.fileName}". Skipping certificate append.`);
                } else if (!(certDoc.file instanceof File || certDoc.file instanceof Blob)) {
                    console.warn(`Certificate document file is invalid for "${certDoc.fileName}". Skipping certificate append.`);
                } else {
            try {
                // Check if it's an image file (using filename as fallback)
                if (isImageFile(certDoc.file, certDoc.fileName)) {
                    console.log('Processing certificate as image:', certDoc.fileName);
                    // Handle image - embed in a new PDF page
                    await embedImageInPDF(pdfDoc, certDoc.file);
                    console.log('Certificate image embedded successfully');
                } else {
                    console.log('Processing certificate as PDF:', certDoc.fileName);
                    // Handle PDF - load and copy pages
                    const certArrayBuffer = await certDoc.file.arrayBuffer();
                    console.log('Certificate PDF arrayBuffer size:', certArrayBuffer.byteLength);
                    
                    if (certArrayBuffer.byteLength === 0) {
                                console.warn(`Certificate PDF "${certDoc.fileName}" is empty. Skipping certificate append.`);
                            } else {
                    const certPdfDoc = await PDFDocument.load(certArrayBuffer);
                    const certPageCount = certPdfDoc.getPageCount();
                    console.log(`Certificate PDF has ${certPageCount} page(s)`);
                    
                    if (certPageCount === 0) {
                                    console.warn(`Certificate PDF "${certDoc.fileName}" has no pages. Skipping certificate append.`);
                                } else {
                    const certPageIndices = Array.from({ length: certPageCount }, (_, i) => i);
                    const copiedCertPages = await pdfDoc.copyPages(certPdfDoc, certPageIndices);
                    console.log(`Copied ${copiedCertPages.length} certificate page(s)`);
                    
                    // Add each page at the end
                    copiedCertPages.forEach((page, index) => {
                        const currentPageCount = pdfDoc.getPageCount();
                        pdfDoc.insertPage(currentPageCount, page);
                        console.log(`Inserted certificate page ${index + 1} at position ${currentPageCount}`);
                    });
                                }
                            }
                }
            } catch (certError: any) {
                        console.warn('Error processing certificate (skipping):', certError);
                        // TEMPORARILY: Just log the error instead of throwing
                    }
                }
            }

            // Append Inspector License (if available)
            if (data.selectedInspectorId && data.licenseDocumentType && inspectorDocuments) {
            const inspectorDocs = inspectorDocuments.get(data.selectedInspectorId) || [];
            const licenseDoc = inspectorDocs.find(doc => doc.documentType === data.licenseDocumentType);
            
                if (licenseDoc && licenseDoc.file) {
            if (!(licenseDoc.file instanceof File || licenseDoc.file instanceof Blob)) {
                        console.warn(`License document file is invalid for "${licenseDoc.fileName}". Skipping license append.`);
                    } else if (licenseDoc.file instanceof Blob && licenseDoc.file.size === 0) {
                        console.warn(`License file "${licenseDoc.fileName}" is empty. Skipping license append.`);
                    } else {
                        try {
                
                console.log('License file info:', {
                    fileName: licenseDoc.fileName,
                    fileSize: licenseDoc.file.size,
                    fileType: licenseDoc.file.type,
                    isFile: licenseDoc.file instanceof File,
                    isBlob: licenseDoc.file instanceof Blob
                });
                
                // Check if it's an image file (using filename as fallback)
                if (isImageFile(licenseDoc.file, licenseDoc.fileName)) {
                    console.log('Processing license as image:', licenseDoc.fileName);
                    // Handle image - embed in a new PDF page
                    await embedImageInPDF(pdfDoc, licenseDoc.file);
                    console.log('License image embedded successfully');
                } else {
                    console.log('Processing license as PDF:', licenseDoc.fileName);
                    // Handle PDF - load and copy pages
                    const licenseArrayBuffer = await licenseDoc.file.arrayBuffer();
                    console.log('License PDF arrayBuffer size:', licenseArrayBuffer.byteLength);
                    
                    if (licenseArrayBuffer.byteLength === 0) {
                        console.warn(`License file "${licenseDoc.fileName}" is empty. Skipping license append.`);
                    } else {
                    // Try to detect if it's actually an image by checking the first bytes (safely)
                    if (licenseArrayBuffer.byteLength >= 8) {
                        const firstBytes = new Uint8Array(licenseArrayBuffer.slice(0, 8));
                        const isPng = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
                        const isJpeg = firstBytes[0] === 0xFF && firstBytes[1] === 0xD8;
                        
                        if (isPng || isJpeg) {
                            console.log('Detected image file by binary signature, converting to PDF page');
                            await embedImageInPDF(pdfDoc, licenseDoc.file);
                            } else {
                    // Try to load as PDF
                    try {
                        const licensePdfDoc = await PDFDocument.load(licenseArrayBuffer);
                        const licensePageCount = licensePdfDoc.getPageCount();
                        console.log(`License PDF has ${licensePageCount} page(s)`);
                        
                        if (licensePageCount === 0) {
                                        console.warn(`License PDF "${licenseDoc.fileName}" has no pages. Skipping license append.`);
                                    } else {
                        const licensePageIndices = Array.from({ length: licensePageCount }, (_, i) => i);
                        const copiedLicensePages = await pdfDoc.copyPages(licensePdfDoc, licensePageIndices);
                        
                        // Add each page at the end
                        copiedLicensePages.forEach((page) => {
                            const currentPageCount = pdfDoc.getPageCount();
                            pdfDoc.insertPage(currentPageCount, page);
                        });
                                    }
                    } catch (pdfError: any) {
                        // If PDF loading fails, try as image
                        const errorMsg = pdfError.message || String(pdfError);
                        if (errorMsg.includes('No PDF header') || errorMsg.includes('Invalid PDF')) {
                            console.log('PDF loading failed, trying as image instead');
                            await embedImageInPDF(pdfDoc, licenseDoc.file);
                        } else {
                                        console.warn('Error loading license PDF (skipping):', pdfError);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (licenseError: any) {
                            console.warn('Error processing license (skipping):', licenseError);
                            // TEMPORARILY: Just log the error instead of throwing
                        }
                    }
                }
            }
        }


        // 6. Draw white background box and signature image on certificate page (for XHR reports)
        // REMOVED - certificate page no longer added to XHR reports
        let certificatePage: any = null;
        if (false && reportType === 'XHR' && certificatePage && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments.get(data.selectedInspectorId) || [];
                const signatureDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                if (signatureDoc && signatureDoc.file) {
                    try {
                        const sigX = 594.72;
                        const sigY = 106.56;
                        const sigWidth = 83.4;
                        const sigHeight = 50;

                        const arrayBuffer = await signatureDoc.file.arrayBuffer();
                        let image;
                        
                        if (signatureDoc.file.type === 'image/png') {
                            image = await pdfDoc.embedPng(arrayBuffer);
                        } else if (signatureDoc.file.type === 'image/jpeg' || signatureDoc.file.type === 'image/jpg') {
                            image = await pdfDoc.embedJpg(arrayBuffer);
                        } else {
                            try {
                                image = await pdfDoc.embedPng(arrayBuffer);
                            } catch {
                                image = await pdfDoc.embedJpg(arrayBuffer);
                            }
                        }

                        const imageDims = image.scale(1);
                        const scaleX = sigWidth / imageDims.width;
                        const scaleY = sigHeight / imageDims.height;
                        let scale = Math.min(scaleX, scaleY, 1);
                        scale = scale * 1.25;

                        const scaledWidth = imageDims.width * scale;
                        const scaledHeight = imageDims.height * scale;

                        const imageX = sigX + (sigWidth - scaledWidth) / 2;
                        const imageY = sigY + (sigHeight - scaledHeight) / 2;

                        // Draw white background box first
                        const widthMargin = 40;
                        const heightMargin = 20;
                        const whiteBoxX = imageX - widthMargin;
                        const whiteBoxY = imageY - (heightMargin / 2);
                        const whiteBoxWidth = scaledWidth + (widthMargin * 2);
                        const whiteBoxHeight = scaledHeight + heightMargin;

                        certificatePage.drawRectangle({
                            x: whiteBoxX,
                            y: whiteBoxY,
                            width: whiteBoxWidth,
                            height: whiteBoxHeight,
                            color: rgb(1, 1, 1),
                        });

                        // Draw signature image on top
                        certificatePage.drawImage(image, {
                            x: imageX,
                            y: imageY,
                            width: scaledWidth,
                            height: scaledHeight,
                        });
                    } catch (sigErr) {
                        console.warn('Error drawing signature on certificate page:', sigErr);
                    }
                }
            } catch (err) {
                console.warn('Error handling signature on certificate page:', err);
            }
        }

        // 7. Draw white background box and signature image ABSOLUTELY LAST (right before saving)
        // Draw directly on the original PDF to ensure it's the last thing in the content stream
        if (signatureImageData) {
            try {
                // Draw white background box first (to cover whatever is behind the signature)
                // Much larger margins, especially in width to block everything behind it
                const widthMargin = 40; // 40px on each side = 80px total width margin
                const heightMargin = 20; // 20px on top and bottom = 40px total height margin
                
                const whiteBoxX = signatureImageData.x - widthMargin; // Large margin on left
                const whiteBoxY = signatureImageData.y - (heightMargin / 2); // Margin on bottom
                const whiteBoxWidth = signatureImageData.width + (widthMargin * 2); // Much wider (20px on each side)
                const whiteBoxHeight = signatureImageData.height + heightMargin; // Taller (10px on top and bottom)
                
                // Draw white rectangle behind signature to block everything
                signatureImageData.page.drawRectangle({
                    x: whiteBoxX,
                    y: whiteBoxY,
                    width: whiteBoxWidth,
                    height: whiteBoxHeight,
                    color: rgb(1, 1, 1), // White
                });
                
                // Draw the signature image on top of the white box
                signatureImageData.page.drawImage(signatureImageData.image, {
                    x: signatureImageData.x,
                    y: signatureImageData.y,
                    width: signatureImageData.width,
                    height: signatureImageData.height,
                });
                
                console.log(`White box drawn at: x=${whiteBoxX}, y=${whiteBoxY}, width=${whiteBoxWidth}, height=${whiteBoxHeight}`);
                console.log(`Signature image drawn on top at: x=${signatureImageData.x}, y=${signatureImageData.y}, width=${signatureImageData.width}, height=${signatureImageData.height}`);
            } catch (err) {
                console.warn('Error drawing signature image on top:', err);
            }
        }

        // 7. Remove target page if results are positive (XHR reports only)
        // The target page is the one with new form fields (originally 6th page, index 5)
        if (reportType === 'XHR' && targetPageIndex !== null && data.fullExcelData && data.fullExcelData.length > 0) {
            try {
                const headerRow = data.fullExcelData[data.headerRowIndex || 0] || [];
                const isPositive = detectPositiveNegative(
                    data.fullExcelData,
                    headerRow,
                    data.headerRowIndex || 0
                );
                
                if (isPositive) {
                    // After Excel pages are inserted, the page indices may have shifted
                    // Excel pages are inserted before the last page, so pages before that remain at the same index
                    // Since targetPageIndex is from the original template (before Excel pages), it should still be correct
                    const totalPages = pdfDoc.getPageCount();
                    
                    // Make sure the target page index is still valid
                    if (targetPageIndex < totalPages) {
                        console.log(`Results are positive. Removing page at index ${targetPageIndex} (6th page from original template, contains new form fields)`);
                        pdfDoc.removePage(targetPageIndex);
                        console.log(`Page removed. New total pages: ${pdfDoc.getPageCount()}`);
                    } else {
                        console.warn(`Target page index ${targetPageIndex} is out of range. Total pages: ${totalPages}`);
                    }
                } else {
                    console.log('Results are negative. Keeping page with new form fields.');
                }
            } catch (err) {
                console.warn('Error checking positive/negative or removing page:', err);
                // Don't fail the whole generation if this check fails
            }
        }

        // 8. Save and Download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${config.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error: any) {
        console.error('PDF Generation failed:', error);
        const errorMessage = error?.message || 'Unknown error occurred';
        // Re-throw the error so it can be caught by the caller
        throw new Error(errorMessage);
    }
};
