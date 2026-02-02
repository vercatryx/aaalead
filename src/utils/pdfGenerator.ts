import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ExtractedData } from '../App';
import { getReportConfig } from '../config/reports';
import type { Inspector, Document } from '../types/documents';
import { getTemplateUrl } from './apiConfig';
import { detectPositiveNegative } from './excelExtractor';

// Dynamic import for pdfjs-dist to avoid SSR issues
let pdfjsLib: any = null;
let pdfjsLibPromise: Promise<any> | null = null;

const getPdfjsLib = async () => {
  // Only load in browser environment
  if (typeof window === 'undefined') {
    throw new Error('pdfjs-dist can only be used in the browser');
  }
  
  // Return cached library if already loaded
  if (pdfjsLib) {
    return pdfjsLib;
  }
  
  // Return existing promise if already loading
  if (pdfjsLibPromise) {
    return pdfjsLibPromise;
  }
  
  // Load pdfjs-dist dynamically
  pdfjsLibPromise = (async () => {
    try {
      // Use dynamic import to avoid SSR bundling issues
      // Import the main module - Turbopack will handle it
      pdfjsLib = await import('pdfjs-dist');
      
      // Set up pdf.js worker
      if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
        const version = pdfjsLib.version || '5.4.530';
        // Use local worker file (available in public folder)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;
      }
      
      return pdfjsLib;
    } catch (error) {
      pdfjsLibPromise = null; // Reset on error
      throw error;
    }
  })();
  
  return pdfjsLibPromise;
};

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
    } catch (pngError: any) {
      try {
        image = await pdfDoc.embedJpg(arrayBuffer);
      } catch (jpgError: any) {
        throw new Error(`Failed to embed image. The file may not be a valid PNG or JPEG image. PNG error: ${pngError?.message || pngError}, JPEG error: ${jpgError?.message || jpgError}`);
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

// Helper to format date as MM/DD/YYYY HH:MM or MM/DD/YYYY HH:MM:SS (preserves time if present)
const formatDateForPDF = (dateStr: string | number | Date | undefined): string => {
    if (!dateStr) return '';

    let dateObj: Date | null = null;

    if (dateStr instanceof Date) {
        dateObj = dateStr;
    } else if (typeof dateStr === 'number') {
        // Excel serial date (includes time component)
        dateObj = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
    } else if (typeof dateStr === 'string') {
        // Handle date strings - parse manually to avoid timezone issues
        const trimmed = dateStr.trim();
        
        // Check if it's ISO format with time (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS)
        const isoWithTimeMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (isoWithTimeMatch) {
            const year = parseInt(isoWithTimeMatch[1], 10);
            const month = parseInt(isoWithTimeMatch[2], 10);
            const day = parseInt(isoWithTimeMatch[3], 10);
            const hours = parseInt(isoWithTimeMatch[4], 10);
            const minutes = parseInt(isoWithTimeMatch[5], 10);
            const seconds = isoWithTimeMatch[6] ? parseInt(isoWithTimeMatch[6], 10) : 0;
            // Create date in local timezone to avoid timezone conversion issues
            dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
        }
        // Check if it's ISO format without time (YYYY-MM-DD) from HTML5 date input
        else {
            const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1], 10);
                const month = parseInt(isoMatch[2], 10);
                const day = parseInt(isoMatch[3], 10);
                // Create date in local timezone to avoid timezone conversion issues
                dateObj = new Date(year, month - 1, day);
            }
            // Check if it's in MM/DD/YYYY HH:MM:SS or MM/DD/YYYY HH:MM format
            else {
                const dateWithTimeMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (dateWithTimeMatch) {
                    let month = parseInt(dateWithTimeMatch[1], 10);
                    let day = parseInt(dateWithTimeMatch[2], 10);
                    let year = parseInt(dateWithTimeMatch[3], 10);
                    const hours = parseInt(dateWithTimeMatch[4], 10);
                    const minutes = parseInt(dateWithTimeMatch[5], 10);
                    const seconds = dateWithTimeMatch[6] ? parseInt(dateWithTimeMatch[6], 10) : 0;
                    
                    // Handle 2-digit years (assume 2000-2099)
                    if (year < 100) {
                        year += 2000;
                    }
                    
                    // Create date in local timezone to avoid timezone conversion issues
                    dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
                }
                // Check if it's in MM/DD/YYYY or M/D/YY format (no time)
                else {
                    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
                    if (dateMatch) {
                        let month = parseInt(dateMatch[1], 10);
                        let day = parseInt(dateMatch[2], 10);
                        let year = parseInt(dateMatch[3], 10);
                        
                        // Handle 2-digit years (assume 2000-2099)
                        if (year < 100) {
                            year += 2000;
                        }
                        
                        // Create date in local timezone to avoid timezone conversion issues
                        dateObj = new Date(year, month - 1, day);
                        
                        // Validate the date is correct (handles invalid dates like Feb 30)
                        if (dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day || dateObj.getFullYear() !== year) {
                            // Invalid date, try standard parsing as fallback
                            dateObj = new Date(trimmed);
                        }
                    } else {
                        // Try parsing with standard Date constructor as fallback
                        dateObj = new Date(trimmed);
                    }
                }
            }
        }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
        // Use local date methods to avoid timezone issues
        const month = dateObj.getMonth() + 1; // getMonth() returns 0-11
        const day = dateObj.getDate(); // getDate() returns local day
        const year = dateObj.getFullYear(); // getFullYear() returns local year
        const hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        const seconds = dateObj.getSeconds();
        
        // Format time component if it's not midnight (00:00:00)
        // or if the original string had time information
        const hasTime = hours !== 0 || minutes !== 0 || seconds !== 0 || 
                       (typeof dateStr === 'string' && (dateStr.includes(':') || dateStr.includes('T')));
        
        if (hasTime) {
            // Format as MM/DD/YYYY HH:MM:SS or MM/DD/YYYY HH:MM
            if (seconds !== 0) {
                return `${month}/${day}/${year} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                return `${month}/${day}/${year} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        } else {
            // No time component, return just the date
            return `${month}/${day}/${year}`;
        }
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

// Helper function to fix text overflow in fields before flattening
// This ensures that long text is visible after flattening by reducing font size to fit within boundaries
const fixFieldTextOverflow = async (form: any, font: any): Promise<void> => {
    console.log('🔧 Fixing text overflow in fields before flattening...');
    
    try {
        const fields = form.getFields();
        let fixedCount = 0;
        
        for (const field of fields) {
            try {
                // Only process text fields
                if (field.constructor.name !== 'PDFTextField') {
                    continue;
                }
                
                const fieldName = field.getName();
                const text = field.getText() || '';
                
                if (!text || text.trim().length === 0) {
                    continue; // Skip empty fields
                }
                
                // Try to get field dimensions from widget annotations
                let fieldWidth = 0;
                let fieldHeight = 0;
                
                try {
                    const acroField = (field as any).acroField;
                    if (acroField) {
                        const kids = acroField.dict?.get('Kids');
                        if (kids && Array.isArray(kids) && kids.length > 0) {
                            const widget = kids[0];
                            const rect = widget.dict?.get('Rect');
                            if (rect && Array.isArray(rect) && rect.length >= 4) {
                                // Rect format: [x1, y1, x2, y2]
                                fieldWidth = Math.abs(rect[2] - rect[0]);
                                fieldHeight = Math.abs(rect[3] - rect[1]);
                            }
                        }
                    }
                } catch (dimErr) {
                    // If we can't get dimensions, continue with default handling
                }
                
                // If we have dimensions, check if text fits
                if (fieldWidth > 0 && fieldHeight > 0) {
                    // Estimate text width (approximate: 0.6 * fontSize per character for Helvetica)
                    // Use a conservative estimate with default font size of 12
                    const estimatedCharWidth = 7.2; // 0.6 * 12
                    const estimatedTextWidth = text.length * estimatedCharWidth;
                    
                    // If text is wider than field, reduce font size to fit
                    if (estimatedTextWidth > fieldWidth) {
                        // Calculate appropriate font size to fit text
                        // Leave some padding (10% on each side)
                        const availableWidth = fieldWidth * 0.8;
                        const calculatedFontSize = Math.max(6, Math.min(12, (availableWidth / text.length) / 0.6));
                        
                        try {
                            if (typeof (field as any).setFontSize === 'function') {
                                (field as any).setFontSize(calculatedFontSize);
                                fixedCount++;
                                console.log(`   ✓ Fixed field "${fieldName}": reduced font size to ${calculatedFontSize.toFixed(1)}`);
                            }
                        } catch (fontSizeErr) {
                            // If setFontSize fails, skip this field
                            console.warn(`   ⚠️ Could not set font size for field "${fieldName}"`);
                        }
                    }
                }
            } catch (fieldErr) {
                // Continue processing other fields if one fails
                console.warn(`   ⚠️ Could not fix field "${field.getName()}":`, fieldErr);
            }
        }
        
        if (fixedCount > 0) {
            console.log(`✅ Fixed text overflow in ${fixedCount} field(s) by reducing font size`);
        } else {
            console.log('✅ No text overflow issues found');
        }
    } catch (err: any) {
        console.warn('⚠️ Error fixing text overflow:', err.message);
        // Don't throw - continue with flattening even if overflow fix fails
    }
};

// Method 4: Manual text drawing - Extract field positions and draw text directly
// Flattening: Use pdf-lib's built-in flatten() method (like print to PDF)
// This makes the PDF non-editable by converting all form fields to static content
// Works regardless of who filled the document - universal flattening solution
// IMPORTANT: Must be called BEFORE any pages are removed, otherwise fields on removed pages cause errors
const flattenFormByRemovingFields = async (pdfDoc: PDFDocument, form: any): Promise<void> => {
    console.log('🔄 Flattening PDF using pdf-lib flatten() method (print-to-PDF style)...');
    
    try {
        // Get all fields first to see what we're working with
        const fields = form.getFields();
        const totalPages = pdfDoc.getPageCount();
        const pages = pdfDoc.getPages();
        const pageRefs = new Set(pages.map(p => p.ref));
        
        console.log(`📝 Found ${fields.length} form fields to flatten across ${totalPages} pages...`);
        
        if (fields.length === 0) {
            console.log('✅ No form fields to flatten - PDF is already non-editable');
            return;
        }
        
        // Check each field's page references before flattening
        // This helps identify problematic fields that might prevent flattening
        const problematicFields: any[] = [];
        const validFields: any[] = [];
        
        for (const field of fields) {
            try {
                const fieldName = field.getName();
                const acroField = (field as any).acroField;
                let hasInvalidRef = false;
                
                if (acroField) {
                    const kids = acroField.dict?.get('Kids');
                    if (kids && Array.isArray(kids)) {
                        for (const widget of kids) {
                            try {
                                const pageRef = widget.dict?.get('P');
                                if (pageRef && !pageRefs.has(pageRef)) {
                                    problematicFields.push(field);
                                    console.warn(`⚠️ Field "${fieldName}" references invalid page: ${pageRef}`);
                                    hasInvalidRef = true;
                                    break;
                                }
                            } catch (e) {
                                // Skip this widget check
                            }
                        }
                    }
                }
                
                if (!hasInvalidRef) {
                    validFields.push(field);
                }
            } catch (checkErr) {
                // If we can't check, assume it's valid
                validFields.push(field);
            }
        }
        
        if (problematicFields.length > 0) {
            console.warn(`⚠️ Found ${problematicFields.length} fields with invalid page references`);
            console.warn(`   Problematic fields: ${problematicFields.map((f: any) => f.getName()).join(', ')}`);
            console.warn(`   Valid fields: ${validFields.length}`);
            console.warn('   Attempting to flatten - pdf-lib may handle this gracefully or fail completely.');
        }
        
        // Fix text overflow issues before updating appearances
        // This ensures long text is visible after flattening
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        await fixFieldTextOverflow(form, font);
        
        // Update all field appearances first to ensure values are rendered
        // This helps ensure the flattened content looks correct
        console.log(`📝 Updating appearances for ${fields.length} fields before flattening...`);
        for (const field of fields) {
            try {
                if (typeof (field as any).updateAppearances === 'function') {
                    await (field as any).updateAppearances();
                }
            } catch (updateErr) {
                // Some fields might not support updateAppearances, continue
            }
        }
        
        // Use image-based flattening directly (print-to-PDF method)
        // This is the most reliable method - renders entire PDF as static images
        // Works regardless of form field issues and makes everything non-editable
        console.log(`🔄 Using image-based flattening (print-to-PDF method) - renders entire PDF as static images...`);
        await flattenFormAsImage(pdfDoc);
        console.log(`✅ PDF flattened successfully using image-based method - all content is now non-editable`);
    } catch (err: any) {
        // If flattening fails, log the error but don't throw
        // This allows the PDF to still be generated (just editable)
        console.warn('⚠️ Failed to flatten PDF:', err.message);
        if (err.message && err.message.includes('Could not find page')) {
            console.warn('   ERROR: Form fields reference a page that no longer exists!');
            console.warn('   This can happen when:');
            console.warn('   - Pages are removed before flattening');
            console.warn('   - Form fields reference pages from the original template that were modified');
            console.warn('   - Internal pdf-lib page reference issues');
            console.warn('   The PDF will be generated but will remain editable.');
        }
        // Don't throw - allow PDF to be generated even if not flattened
    }
};

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
                                                const fontSize = Math.min(9, height * 0.5);
                                                
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
                            fontSize: 9
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
                        size: fontSize || 9,
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
        // CRITICAL: Get page dimensions from pdf-lib BEFORE flattening to preserve exact dimensions
        // This is the most reliable way to preserve landscape/portrait orientation
        // IMPORTANT: If a page has rotation (90/270), we need to swap dimensions to get the actual page size
        const pages = pdfDoc.getPages();
        const originalPageDimensions: Array<{ width: number; height: number }> = [];
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageSize = page.getSize();
            
            // Check if page has rotation - if rotated 90/270, dimensions are swapped
            // We need to get the actual page dimensions (before rotation)
            let actualWidth = pageSize.width;
            let actualHeight = pageSize.height;
            
            // Try to get rotation - if page is rotated 90/270, swap dimensions
            try {
                const rotation = (page as any).rotation;
                const rotationAngle = (typeof rotation === 'object' && rotation?.angle) ? rotation.angle : (typeof rotation === 'number' ? rotation : 0);
                if (rotationAngle === 90 || rotationAngle === 270) {
                    // Dimensions are swapped due to rotation, swap them back
                    [actualWidth, actualHeight] = [actualHeight, actualWidth];
                    console.log(`Page ${i + 1}: Has ${rotationAngle}° rotation - swapped dimensions from ${pageSize.width}x${pageSize.height} to ${actualWidth}x${actualHeight}`);
                }
            } catch {
                // If we can't get rotation, use dimensions as-is
            }
            
            originalPageDimensions.push({ width: actualWidth, height: actualHeight });
            const isLandscape = actualWidth > actualHeight;
            console.log(`Page ${i + 1} original dimensions (from pdf-lib): ${actualWidth}x${actualHeight} (${isLandscape ? 'landscape' : 'portrait'})`);
        }
        
        // Save the PDF to bytes first
        const pdfBytes = await pdfDoc.save();
        
        // Use pdf.js to render pages to canvas, then convert to images
        const pdfjs = await getPdfjsLib();
        if (!pdfjs) {
            throw new Error('pdfjs-dist is not available in this environment');
        }
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        // Store images and page sizes - use original dimensions from pdf-lib
        const pageImages: Array<{ image: any; width: number; height: number }> = [];
        
        // Render each page to canvas and convert to image
        // Use high scale (3.0) for better quality - this prevents distortion
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pdfPage = await pdf.getPage(pageNum);
            
            // Get the page's rotation from pdf.js (more reliable than pdf-lib for rotation detection)
            const pageRotation = pdfPage.rotate || 0;
            
            // Use the original dimensions from pdf-lib, but check if pdf.js rotation indicates we need to swap
            let originalDims = originalPageDimensions[pageNum - 1];
            let originalWidth = originalDims.width;
            let originalHeight = originalDims.height;
            
            // If pdf.js shows 90/270 rotation, the dimensions from pdf-lib might be swapped
            // Double-check: if rotation is 90/270 and width < height, swap them
            if ((pageRotation === 90 || pageRotation === 270) && originalWidth < originalHeight) {
                [originalWidth, originalHeight] = [originalHeight, originalWidth];
                console.log(`Page ${pageNum}: pdf.js shows ${pageRotation}° rotation, swapped dimensions to ${originalWidth}x${originalHeight}`);
            }
            
            const isLandscape = originalWidth > originalHeight;
            console.log(`Page ${pageNum}: Using original dimensions ${originalWidth}x${originalHeight} (${isLandscape ? 'landscape' : 'portrait'})${pageRotation ? `, PDF rotation: ${pageRotation}°` : ''}`);
            
            // Get viewport - use rotation 0 to get natural page dimensions
            // We'll render with the page's rotation, but use original dimensions for the final page
            const scale = 3.0; // High scale for quality
            const viewport = pdfPage.getViewport({ scale: scale, rotation: pageRotation });
            
            // Create canvas with viewport dimensions
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');
            
            // Set canvas size to exactly match viewport (maintains aspect ratio)
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render PDF page to canvas with high quality
            // Using the page's rotation (including our added rotation for page 6) ensures content is rendered correctly
            await pdfPage.render({
                canvasContext: context,
                viewport: viewport,
                canvas: canvas
            } as any).promise;
            
            // Convert canvas to PNG with high quality
            const imageData = canvas.toDataURL('image/png', 1.0); // Maximum quality
            
            // Convert data URL to bytes
            const response = await fetch(imageData);
            const imageBytes = await response.arrayBuffer();
            
            // Embed image and store it with ORIGINAL dimensions from pdf-lib (preserves landscape/portrait)
            const image = await pdfDoc.embedPng(imageBytes);
            pageImages.push({ 
                image, 
                width: originalWidth,   // Use original width from pdf-lib (preserves orientation)
                height: originalHeight  // Use original height from pdf-lib (preserves orientation)
            });
            console.log(`Page ${pageNum} flattened: stored with dimensions ${originalWidth}x${originalHeight} (${isLandscape ? 'landscape' : 'portrait'})`);
        }
        
        // Remove ALL old pages first (from end to beginning to avoid index issues)
        const originalPageCount = pdfDoc.getPageCount();
        for (let i = originalPageCount - 1; i >= 0; i--) {
            pdfDoc.removePage(i);
        }
        
        // Add new pages with images - one page per image, no doubling
        // CRITICAL: Use original [width, height] to preserve landscape/portrait orientation
        for (const { image, width, height } of pageImages) {
            // Create page with exact original dimensions - landscape pages will have width > height
            const newPage = pdfDoc.addPage([width, height]);
            
            // The image was rendered at 3x scale, so imageWidth = width * 3, imageHeight = height * 3
            // When we draw it back, we need to scale it down by 1/3 to fit the original page size
            // pdf-lib's drawImage will use the image's natural dimensions unless we specify
            // So we explicitly set width and height to the original page dimensions
            newPage.drawImage(image, {
                x: 0,
                y: 0,
                width: width,   // Original page width - this scales the 3x image down correctly
                height: height, // Original page height - this scales the 3x image down correctly
            });
        }
        
        console.log('✅ Image-based flattening completed');
    } catch (err: any) {
        console.warn('⚠️ Image-based flattening failed:', err.message);
        throw err;
    }
};

// Export function to flatten a PDF file and download it
export const flattenPdf = async (file: File): Promise<void> => {
    try {
        console.log('🔄 Starting PDF flattening process...');
        
        // Validate file
        if (!file || file.size === 0) {
            throw new Error('Invalid PDF file: File is empty or not provided');
        }
        
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error('Invalid file type: Please select a PDF file');
        }
        
        // Use server-side API route for flattening (more reliable)
        const formData = new FormData();
        formData.append('pdf', file);
        
        console.log('📤 Sending PDF to server for flattening...');
        const response = await fetch('/api/flatten-pdf', {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
        }
        
        // Get flattened PDF as blob
        const blob = await response.blob();
        console.log('✅ PDF flattened successfully on server');
        
        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        // Generate filename: add "_flattened" before .pdf extension
        const originalName = file.name.replace(/\.pdf$/i, '');
        const filename = `${originalName}_flattened.pdf`;
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the object URL
        URL.revokeObjectURL(link.href);
        
        console.log(`✅ Flattened PDF downloaded as: ${filename}`);
    } catch (error: any) {
        console.error('❌ PDF flattening failed:', error);
        const errorMessage = error?.message || 'Unknown error occurred while flattening PDF';
        throw new Error(errorMessage);
    }
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

        // 2. Fill form fields
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
                                // updateAppearances() may require arguments in some versions
                                try {
                                    (field.updateAppearances as any)();
                                } catch (_err: any) {
                                    // Ignore appearance update errors
                                }
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
                            try {
                                (secondField.updateAppearances as any)();
                            } catch (_err: any) {
                                // Ignore appearance update errors
                            }
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
        const otherMappings = config.mappings.filter(m => m.pdfFieldId !== 'Check Box8');
        
        // Embed font for black text (used for Numb1 and Numb2)
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        otherMappings.forEach(mapping => {
            try {
                // Skip fields that were already handled in special cases
                if (mapping.pdfFieldId === 'Dates of Inspection' || 
                    ['undefined', 'undefined_2', 'TO', 'undefined_3', 'undefined_4', 
                     'Date Certificate Issued', 'undefined_5', 'undefined_6a', 'Signature', 'Inspector sig'].includes(mapping.pdfFieldId) ||
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
                                    try {
                                        (field.updateAppearances as any)();
                                    } catch (_err: any) {
                                        // Ignore appearance update errors
                                    }
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
                            try {
                                (field.updateAppearances as any)();
                            } catch (_err: any) {
                                // Ignore appearance update errors
                            }
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
                        // cert date 2 reuses Today (Report Date) value
                        else if (mapping.pdfFieldId === 'cert date 2') {
                            valueToFill = data['Today'] || data[mapping.pdfFieldId] || '';
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
                        // cert date 2 reuses Today (Report Date) value
                        else if (mapping.pdfFieldId === 'cert date 2') {
                            valueToFill = data['Today'] || '';
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
                
                // Format cert date 2 that reuses Today value
                if (reportType === 'XHR' && valueToFill && mapping.pdfFieldId === 'cert date 2') {
                    valueToFill = formatDateForPDF(valueToFill);
                }
                
                // Skip filling Numb1 and Numb2 in regular form fields - they will be drawn as text overlay instead
                if (reportType === 'XHR' && (mapping.pdfFieldId === 'Numb1' || mapping.pdfFieldId === 'Numb2')) {
                    // Skip this field - don't fill it in the form, it will be drawn as text overlay later
                    return;
                }

                // Special handling for Inspector name on page 5: append Permit number
                // Find page 5 by checking all fields and finding which ones are on page 5 (index 4)
                if (reportType === 'XHR' && mapping.pdfFieldId === 'Inspector name' && valueToFill) {
                    try {
                        // Get all fields and find which page "Inspector name" is on
                        const widgets = field.acroField.getWidgets();
                        if (widgets.length > 0) {
                            const widget = widgets[0];
                            const fieldPageRef = (widget.dict as any).get('P');
                            const pages = pdfDoc.getPages();
                            
                            // Find which page this field is on by comparing references
                            let fieldPageIndex = -1;
                            for (let i = 0; i < pages.length; i++) {
                                try {
                                    if (fieldPageRef === pages[i].ref) {
                                        fieldPageIndex = i;
                                        break;
                                    }
                                } catch (e) {
                                    // Try alternative comparison
                                    try {
                                        if (fieldPageRef?.toString() === pages[i].ref?.toString()) {
                                            fieldPageIndex = i;
                                            break;
                                        }
                                    } catch (e2) {
                                        // Continue
                                    }
                                }
                            }
                            
                            // Alternative: List all fields on each page to debug
                            if (fieldPageIndex === -1) {
                                console.log(`🔍 Permit# Check - Could not determine page for Inspector name field. Listing all fields by page:`);
                                const allFields = form.getFields();
                                const fieldsByPage = new Map<number, string[]>();
                                
                                allFields.forEach(testField => {
                                    try {
                                        const testWidgets = testField.acroField.getWidgets();
                                        if (testWidgets.length > 0) {
                                            const testPageRef = (testWidgets[0].dict as any).get('P');
                                            for (let i = 0; i < pages.length; i++) {
                                                if (testPageRef === pages[i].ref) {
                                                    if (!fieldsByPage.has(i)) {
                                                        fieldsByPage.set(i, []);
                                                    }
                                                    fieldsByPage.get(i)!.push(testField.getName());
                                                    break;
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        // Skip
                                    }
                                });
                                
                                fieldsByPage.forEach((fieldNames, pageIdx) => {
                                    console.log(`  Page ${pageIdx + 1} (index ${pageIdx}): ${fieldNames.join(', ')}`);
                                });
                                
                                // Try to find page 5 by looking for fields we know are on page 5
                                // The signature image is placed on page 5, so look for fields near that area
                                // Or use page index 4 directly if we have 5+ pages
                                if (pages.length >= 5) {
                                    fieldPageIndex = 4; // Assume page 5 if we can't detect it
                                    console.log(`🔍 Permit# Check - Assuming page 5 (index 4) since template has ${pages.length} pages`);
                                }
                            }
                            
                            console.log(`🔍 Permit# Check - Inspector name field on page ${fieldPageIndex + 1} (index ${fieldPageIndex}), total pages: ${pages.length}`);
                            
                            // If this is page 5 (index 4), append Permit number
                            if (fieldPageIndex === 4 && data.selectedInspectorId && inspectors) {
                                const inspector = inspectors.find(ins => ins.id === data.selectedInspectorId);
                                if (inspector) {
                                    console.log(`🔍 Permit# Check - Inspector found: ${inspector.name}`);
                                    
                                    // Try both 'license number' and 'Permit number' as variable names
                                    const permitNumber = inspector.variableValues?.get('license number') || 
                                                         inspector.variableValues?.get('Permit number') ||
                                                         inspector.variableValues?.get('permit number');
                                    
                                    if (permitNumber && permitNumber.trim()) {
                                        valueToFill = `${valueToFill} Permit# ${permitNumber.trim()}`;
                                        console.log(`✅ Permit# appended: "${valueToFill}"`);
                                    } else {
                                        console.log(`⚠️ Permit# Check - No permit number found. Available variables:`, inspector.variableValues ? Array.from(inspector.variableValues.keys()) : 'none');
                                    }
                                } else {
                                    console.log(`⚠️ Permit# Check - Inspector with ID ${data.selectedInspectorId} not found`);
                                }
                            } else {
                                console.log(`ℹ️ Permit# Check - Inspector name field not on page 5 (pageIndex: ${fieldPageIndex}), skipping Permit# append`);
                            }
                        }
                    } catch (err) {
                        console.warn('❌ Permit# Check - Error:', err);
                    }
                }

                field.setText(String(valueToFill));
                
                // Set smaller font size for text fields only (skip if field is invalid)
                try {
                    // Only try to set font size on TextField types and if field is valid
                    if (field && 
                        field.constructor.name && 
                        field.constructor.name.includes('TextField') &&
                        typeof (field as any).setFontSize === 'function') {
                        (field as any).setFontSize(9); // Reduced font size
                    }
                } catch (fontSizeErr: any) {
                    // Some fields may not support setFontSize, that's okay
                    // Silently ignore - font size will be handled during flattening
                    if (fontSizeErr?.message && !fontSizeErr.message.includes('defineProperty')) {
                        // Only log if it's not the defineProperty error
                        console.warn(`Could not set font size for field ${mapping.pdfFieldId}:`, fontSizeErr.message);
                    }
                }
                
                // Note: Black numbers for Numb1 and Numb2 are drawn later (after all fields are filled)
                // These fields are NOT filled in the regular form - only drawn as text overlay
                
                // Store phone field reference for later use in signature positioning
                if (reportType === 'XHR' && (mapping.pdfFieldId === 'Phone' || mapping.pdfFieldId === 'phone')) {
                    try {
                        const widgets = field.acroField.getWidgets();
                        if (widgets.length > 0) {
                            const widget = widgets[0];
                            const pageRef = (widget.dict as any).get('P');
                            const pages = pdfDoc.getPages();
                            for (let i = 0; i < pages.length; i++) {
                                if (pageRef === pages[i].ref) {
                                    const rect = widget.getRectangle();
                                    phoneFieldRef = {
                                        field: field,
                                        page: pages[i],
                                        x: rect.x,
                                        y: rect.y,
                                        width: rect.width,
                                        height: rect.height || 20
                                    };
                                    console.log(`Stored phone field reference on page ${i + 1} at x=${rect.x}, y=${rect.y}`);
                                    break;
                                }
                            }
                        }
                    } catch (phoneErr) {
                        console.warn('Error storing phone field reference:', phoneErr);
                    }
                }
                
                // Ensure text appears on top by updating appearances
                // This ensures the text is properly rendered and visible
                try {
                    (field.updateAppearances as any)();
                } catch (e: any) {
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
                                // Set font size for checkbox text
                                try {
                                    // Only set font size if field is valid and supports it
                                    if (textField && 
                                        textField.constructor.name && 
                                        textField.constructor.name.includes('TextField') &&
                                        typeof textField.setFontSize === 'function') {
                                        textField.setFontSize(12); // Reduced font size
                                    }
                                } catch (fontErr: any) {
                                    // If setFontSize fails, silently ignore - font size will be handled during flattening
                                    if (fontErr?.message && !fontErr.message.includes('defineProperty')) {
                                        console.warn('Could not set font size for Check Box8:', fontErr.message);
                                    }
                                }
                                // Ensure it's visible and on top
                                (textField.updateAppearances as any)();
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

        // ==================== SIGNATURE POSITIONING CONFIGURATION ====================
        // Easy-to-change variables for signature positioning on page 6
        // Location: src/utils/pdfGenerator.ts - around line 1719
        const PAGE6_SIGNATURE_X = 600;  // X coordinate for signature on page 6
        const PAGE6_SIGNATURE_Y = 125;   // Y coordinate for signature on page 6
        // Note: These are PDF coordinates where (0,0) is bottom-left corner
        // =================================================================================
        
        // Store signature image info to draw last (on top of everything)
        let signatureImageData: { image: any; page: any; x: number; y: number; width: number; height: number } | null = null;
        let xhrSignatureImageData: { image: any; page: any; x: number; y: number; width: number; height: number } | null = null;
        let xhrPage6SignatureImageData: { image: any; page: any; x: number; y: number; width: number; height: number } | null = null;
        // Store phone field reference when we fill it, so we can use it later for signature positioning
        let phoneFieldRef: { field: any; page: any; x: number; y: number; width: number; height: number } | null = null;
        
        // 3. Prepare Signature image - will be drawn last to appear on top
        if (false && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments!.get(data.selectedInspectorId!) || [];
                // Find signature document (look for document type containing "signature")
                const signatureDoc = inspectorDocs.find((doc: any) => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                const signatureFile = signatureDoc?.file;
                if (signatureDoc && signatureFile) {
                    try {
                        // TypeScript narrowing: we've checked signatureFile exists above
                        // Use type assertion since we've verified it exists in the if condition
                        const file = signatureFile as File | Blob;
                        
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
                        const arrayBuffer = await file.arrayBuffer();
                        let image;
                        
                        if (file.type === 'image/png') {
                            image = await pdfDoc.embedPng(arrayBuffer);
                        } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
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

        // 3b. Prepare Signature image for XHR reports on page 5 - will be drawn last to appear on top
        if (reportType === 'XHR' && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments!.get(data.selectedInspectorId!) || [];
                console.log(`🔍 XHR Signature Check - Inspector ID: ${data.selectedInspectorId}, Docs found: ${inspectorDocs.length}`);
                // Find signature document (look for document type containing "signature")
                const signatureDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                console.log(`🔍 XHR Signature Check - Signature doc found: ${!!signatureDoc}, Has file: ${!!signatureDoc?.file}, Doc type: ${signatureDoc?.documentType}`);
                
                // Log file details including path/URL
                if (signatureDoc) {
                    const filePath = (signatureDoc as any).filePath;
                    console.log(`📋 Signature document details:`, {
                        id: signatureDoc.id,
                        fileName: signatureDoc.fileName,
                        documentType: signatureDoc.documentType,
                        hasFile: !!signatureDoc.file,
                        fileSize: signatureDoc.file?.size || 0,
                        fileType: signatureDoc.file?.type || 'N/A',
                        filePath: filePath || 'N/A',
                        fileUrl: filePath ? `R2: ${filePath}` : 'N/A'
                    });
                }

                if (signatureDoc?.file) {
                    try {
                        // Get page 5 (index 4) where Inspector sig field is located
                        const pages = pdfDoc.getPages();
                        // Page 5 is index 4 (0-indexed)
                        const targetPageIndex = 4;
                        if (pages.length > targetPageIndex) {
                            const targetPage = pages[targetPageIndex];
                            
                            // Try to get the Inspector sig field to find its position
                            let sigX = 0;
                            let sigY = 0;
                            let sigWidth = 100;
                            let sigHeight = 50;
                            
                            try {
                                const sigField = form.getTextField('Inspector sig');
                                if (sigField) {
                                    const widgets = sigField.acroField.getWidgets();
                                    if (widgets.length > 0) {
                                        const widget = widgets[0];
                                        const rect = widget.getRectangle();
                                        sigX = rect.x;
                                        sigY = rect.y;
                                        sigWidth = rect.width;
                                        sigHeight = rect.height || 50; // Default height if not specified
                                    }
                                }
                            } catch (fieldErr) {
                                console.warn('Could not get Inspector sig field position, using defaults:', fieldErr);
                                // Default position if field not found (adjust as needed)
                                sigX = 400;
                                sigY = 100;
                            }

                            // Validate file before embedding
                            const filePath = (signatureDoc as any).filePath;
                            console.log(`🖼️ Preparing to embed signature image:`, {
                                fileName: signatureDoc.fileName,
                                fileSize: signatureDoc.file.size,
                                fileType: signatureDoc.file.type,
                                filePath: filePath || 'N/A'
                            });
                            
                            if (!signatureDoc.file || signatureDoc.file.size === 0) {
                                throw new Error(`Signature file "${signatureDoc.fileName}" is empty or invalid (size: ${signatureDoc.file?.size || 0} bytes). File path: ${filePath || 'N/A'}`);
                            }
                            
                            // Embed the signature image
                            const arrayBuffer = await signatureDoc.file.arrayBuffer();
                            
                            // Validate arrayBuffer
                            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                                throw new Error(`Signature file "${signatureDoc.fileName}" has no data`);
                            }
                            
                            // Check minimum size for valid image (at least 8 bytes for header)
                            if (arrayBuffer.byteLength < 8) {
                                throw new Error(`Signature file "${signatureDoc.fileName}" is too small to be a valid image`);
                            }
                            
                            let image;
                            
                            // Try to determine image type from file extension or MIME type
                            const fileName = signatureDoc.fileName?.toLowerCase() || '';
                            const isPngFile = fileName.endsWith('.png') || signatureDoc.file.type === 'image/png';
                            const isJpegFile = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                             signatureDoc.file.type === 'image/jpeg' || signatureDoc.file.type === 'image/jpg';
                            
                            if (isPngFile) {
                                try {
                                    image = await pdfDoc.embedPng(arrayBuffer);
                                } catch (pngErr: any) {
                                    console.warn(`Failed to embed as PNG, trying JPEG:`, pngErr.message);
                                    image = await pdfDoc.embedJpg(arrayBuffer);
                                }
                            } else if (isJpegFile) {
                                try {
                                    image = await pdfDoc.embedJpg(arrayBuffer);
                                } catch (jpgErr: any) {
                                    console.warn(`Failed to embed as JPEG, trying PNG:`, jpgErr.message);
                                    image = await pdfDoc.embedPng(arrayBuffer);
                                }
                            } else {
                                // Try PNG first, then JPEG
                                try {
                                    image = await pdfDoc.embedPng(arrayBuffer);
                                } catch {
                                    try {
                                        image = await pdfDoc.embedJpg(arrayBuffer);
                                    } catch (embedErr: any) {
                                        throw new Error(`Failed to embed signature image "${signatureDoc.fileName}": ${embedErr.message || embedErr}. The file may be corrupted or in an unsupported format.`);
                                    }
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
                            xhrSignatureImageData = {
                                image,
                                page: targetPage,
                                x: imageX,
                                y: imageY,
                                width: scaledWidth,
                                height: scaledHeight
                            };
                            
                            console.log(`XHR signature image prepared for page 5 at: x=${imageX}, y=${imageY}, width=${scaledWidth}, height=${scaledHeight}`);
                        } else {
                            console.warn(`Page 5 (index ${targetPageIndex}) not found. Total pages: ${pages.length}`);
                        }
                    } catch (sigErr) {
                        console.warn('Error preparing XHR signature image:', sigErr);
                    }
                }
            } catch (err) {
                console.warn('Error handling XHR signature:', err);
            }
        }

        // 5. Add Excel data pages (for XHR reports)
        // Store number of Excel pages inserted so we can adjust page 6 index later
        let numExcelPagesInserted = 0;
        if (data.fullExcelData && data.fullExcelData.length > 0) {
            const totalPages = pdfDoc.getPageCount();
            // For XHR reports:
            // - Positive reports: insert after page 6 (index 7)
            // - Negative reports: insert before page 6 (index 5)
            // For other reports, insert before the last page
            let insertBeforeIndex: number;
            if (reportType === 'XHR') {
                // Check if report is positive
                const isPositive = data.isPositive ?? false;
                if (isPositive) {
                    // Insert at index 7 (after page 6) for positive reports
                    insertBeforeIndex = 7;
                } else {
                    // Insert at index 5 (before page 6) for negative reports
                    insertBeforeIndex = 5;
                }
            } else {
                // Insert before last page (original behavior)
                insertBeforeIndex = Math.max(0, totalPages - 1);
            }
            
            // Create a temporary PDF document to build Excel pages
            const tempPdfDoc = await PDFDocument.create();
            const excelPages = await createExcelDataPages(tempPdfDoc, data.fullExcelData, data.headerRowIndex || 0);
            
            // Copy Excel pages from temp document to main document at correct position
            const copiedPages = await pdfDoc.copyPages(tempPdfDoc, excelPages.map((_, i) => i));
            numExcelPagesInserted = copiedPages.length;
            
            // Insert them at the correct position (in reverse order to maintain indices)
            for (let i = copiedPages.length - 1; i >= 0; i--) {
                pdfDoc.insertPage(insertBeforeIndex, copiedPages[i]);
            }
        }

        // 5b. Prepare Signature image for XHR reports on page 6 - using hardcoded coordinates
        // NOTE: This must run AFTER Excel pages are added
        // Position is configured via PAGE6_SIGNATURE_X and PAGE6_SIGNATURE_Y variables at top of function
        if (reportType === 'XHR' && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments!.get(data.selectedInspectorId!) || [];
                console.log(`🔍 XHR Page 6 Signature Check - Inspector ID: ${data.selectedInspectorId}, Docs found: ${inspectorDocs.length}`);
                // Find signature document (look for document type containing "signature")
                const signatureDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                console.log(`🔍 XHR Page 6 Signature Check - Signature doc found: ${!!signatureDoc}, Has file: ${!!signatureDoc?.file}, Doc type: ${signatureDoc?.documentType}`);
                
                // Log file details including path/URL
                if (signatureDoc) {
                    const filePath = (signatureDoc as any).filePath;
                    console.log(`📋 Page 6 Signature document details:`, {
                        id: signatureDoc.id,
                        fileName: signatureDoc.fileName,
                        documentType: signatureDoc.documentType,
                        hasFile: !!signatureDoc.file,
                        fileSize: signatureDoc.file?.size || 0,
                        fileType: signatureDoc.file?.type || 'N/A',
                        filePath: filePath || 'N/A',
                        fileUrl: filePath ? `R2: ${filePath}` : 'N/A'
                    });
                }

                if (signatureDoc?.file) {
                    try {
                        // Get page 6 - this is the page with the phone field
                        const pages = pdfDoc.getPages();
                        // Calculate page 6 index based on where Excel pages were inserted:
                        // - Negative reports: Excel at index 5, so page 6 is at index 5 + numExcelPagesInserted
                        // - Positive reports: Excel at index 7 (after page 6), so page 6 stays at index 5
                        const isPositive = data.isPositive ?? false;
                        const targetPageIndex = isPositive ? 5 : (5 + numExcelPagesInserted); // Page 6 (0-indexed, adjusted for Excel pages)
                        
                        if (pages.length > targetPageIndex) {
                            const targetPage = pages[targetPageIndex];
                            // Embed the signature image (reuse the same image from page 5 if available, otherwise embed new)
                            let image;
                            if (xhrSignatureImageData && xhrSignatureImageData.image) {
                                // Reuse the same image object from page 5
                                image = xhrSignatureImageData.image;
                            } else {
                                // Validate file before embedding
                                const filePath = (signatureDoc as any).filePath;
                                console.log(`🖼️ Preparing to embed signature image for page 6:`, {
                                    fileName: signatureDoc.fileName,
                                    fileSize: signatureDoc.file.size,
                                    fileType: signatureDoc.file.type,
                                    filePath: filePath || 'N/A'
                                });
                                
                                if (!signatureDoc.file || signatureDoc.file.size === 0) {
                                    throw new Error(`Signature file "${signatureDoc.fileName}" is empty or invalid (size: ${signatureDoc.file?.size || 0} bytes). File path: ${filePath || 'N/A'}`);
                                }
                                
                                // Embed the signature image
                                const arrayBuffer = await signatureDoc.file.arrayBuffer();
                                
                                // Validate arrayBuffer
                                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                                    throw new Error(`Signature file "${signatureDoc.fileName}" has no data`);
                                }
                                
                                // Check minimum size for valid image
                                if (arrayBuffer.byteLength < 8) {
                                    throw new Error(`Signature file "${signatureDoc.fileName}" is too small to be a valid image`);
                                }
                                
                                // Try to determine image type from file extension or MIME type
                                const fileName = signatureDoc.fileName?.toLowerCase() || '';
                                const isPngFile = fileName.endsWith('.png') || signatureDoc.file.type === 'image/png';
                                const isJpegFile = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                                 signatureDoc.file.type === 'image/jpeg' || signatureDoc.file.type === 'image/jpg';
                                
                                if (isPngFile) {
                                    try {
                                        image = await pdfDoc.embedPng(arrayBuffer);
                                    } catch (pngErr: any) {
                                        console.warn(`Failed to embed as PNG, trying JPEG:`, pngErr.message);
                                        image = await pdfDoc.embedJpg(arrayBuffer);
                                    }
                                } else if (isJpegFile) {
                                    try {
                                        image = await pdfDoc.embedJpg(arrayBuffer);
                                    } catch (jpgErr: any) {
                                        console.warn(`Failed to embed as JPEG, trying PNG:`, jpgErr.message);
                                        image = await pdfDoc.embedPng(arrayBuffer);
                                    }
                                } else {
                                    // Try PNG first, then JPEG
                                    try {
                                        image = await pdfDoc.embedPng(arrayBuffer);
                                    } catch {
                                        try {
                                            image = await pdfDoc.embedJpg(arrayBuffer);
                                        } catch (embedErr: any) {
                                            throw new Error(`Failed to embed signature image "${signatureDoc.fileName}": ${embedErr.message || embedErr}. The file may be corrupted or in an unsupported format.`);
                                        }
                                    }
                                }
                            }

                            // Use the same dimensions as page 5 signature if available, otherwise calculate
                            let scaledWidth: number;
                            let scaledHeight: number;
                            
                            if (xhrSignatureImageData) {
                                // Reuse the same size as page 5
                                scaledWidth = xhrSignatureImageData.width;
                                scaledHeight = xhrSignatureImageData.height;
                            } else {
                                // Calculate image dimensions and scale to fit, then make 25% bigger
                                const imageDims = image.scale(1);
                                const sigWidth = 100; // Default signature width
                                const sigHeight = 50; // Default signature height
                                const scaleX = sigWidth / imageDims.width;
                                const scaleY = sigHeight / imageDims.height;
                                let scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
                                
                                // Make it 25% bigger (1.25x the size)
                                scale = scale * 1.25;
                                
                                scaledWidth = imageDims.width * scale;
                                scaledHeight = imageDims.height * scale;
                            }

                            // Position signature using hardcoded coordinates (configurable at top of function)
                            // See PAGE6_SIGNATURE_X and PAGE6_SIGNATURE_Y variables above (around line 1720)
                            const imageX = PAGE6_SIGNATURE_X;
                            const imageY = PAGE6_SIGNATURE_Y;

                            // Store image data to draw later (on top of everything)
                            xhrPage6SignatureImageData = {
                                image,
                                page: targetPage,
                                x: imageX,
                                y: imageY,
                                width: scaledWidth,
                                height: scaledHeight
                            };
                            
                            console.log(`XHR signature image prepared for page ${targetPageIndex + 1} at: x=${imageX}, y=${imageY}, width=${scaledWidth}, height=${scaledHeight}`);
                        } else {
                            console.warn(`Page 6 (index ${targetPageIndex}) not found. Total pages: ${pages.length}`);
                        }
                    } catch (sigErr) {
                        console.warn('Error preparing XHR signature image for page 6:', sigErr);
                    }
                }
            } catch (err) {
                console.warn('Error handling XHR signature for page 6:', err);
            }
        }

        // 6. Append documents at the end (General Certificate and Inspector License)
        // TEMPORARILY: Skip if documents don't exist instead of throwing errors
        {
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
            console.log(`🔍 XHR License Check - Inspector ID: ${data.selectedInspectorId}, License type: ${data.licenseDocumentType}, Docs found: ${inspectorDocs.length}`);
            const licenseDoc = inspectorDocs.find(doc => doc.documentType === data.licenseDocumentType);
            
            console.log(`🔍 XHR License Check - License doc found: ${!!licenseDoc}, Has file: ${!!licenseDoc?.file}, Doc type: ${licenseDoc?.documentType}`);
            
            // Log file details including path/URL
            if (licenseDoc) {
                const filePath = (licenseDoc as any).filePath;
                console.log(`📋 License document details:`, {
                    id: licenseDoc.id,
                    fileName: licenseDoc.fileName,
                    documentType: licenseDoc.documentType,
                    hasFile: !!licenseDoc.file,
                    fileSize: licenseDoc.file?.size || 0,
                    fileType: licenseDoc.file?.type || 'N/A',
                    filePath: filePath || 'N/A',
                    fileUrl: filePath ? `R2: ${filePath}` : 'N/A'
                });
            }
            
                if (licenseDoc && licenseDoc.file) {
                    if (!(licenseDoc.file instanceof File || licenseDoc.file instanceof Blob)) {
                        console.warn(`License document file is invalid for "${licenseDoc.fileName}". Skipping license append.`);
                    } else {
                        // Validate file size
                        const fileSize = licenseDoc.file.size;
                        if (fileSize === 0) {
                            console.warn(`License file "${licenseDoc.fileName}" is empty (0 bytes). Skipping license append.`);
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
        }


        // 6. Draw white background box and signature image on certificate page (for XHR reports)
        // REMOVED - certificate page no longer added to XHR reports
        let certificatePage: any = null;
        if (false && reportType === 'XHR' && certificatePage && data.selectedInspectorId && inspectorDocuments) {
            try {
                const inspectorDocs = inspectorDocuments!.get(data.selectedInspectorId!) || [];
                const signatureDoc = inspectorDocs.find(doc => 
                    doc.documentType?.toLowerCase().includes('signature')
                );

                const signatureFile2 = signatureDoc?.file;
                if (signatureDoc && signatureFile2) {
                    try {
                        const file2 = signatureFile2 as File | Blob;
                        const sigX = 594.72;
                        const sigY = 106.56;
                        const sigWidth = 83.4;
                        const sigHeight = 50;

                        const arrayBuffer = await file2.arrayBuffer();
                        let image;
                        
                        if (file2.type === 'image/png') {
                            image = await pdfDoc.embedPng(arrayBuffer);
                        } else if (file2.type === 'image/jpeg' || file2.type === 'image/jpg') {
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
                
                const whiteBoxX = (signatureImageData as any).x - widthMargin; // Large margin on left
                const whiteBoxY = (signatureImageData as any).y - (heightMargin / 2); // Margin on bottom
                const whiteBoxWidth = (signatureImageData as any).width + (widthMargin * 2); // Much wider (20px on each side)
                const whiteBoxHeight = (signatureImageData as any).height + heightMargin; // Taller (10px on top and bottom)
                
                // Draw white rectangle behind signature to block everything
                (signatureImageData as any).page.drawRectangle({
                    x: whiteBoxX,
                    y: whiteBoxY,
                    width: whiteBoxWidth,
                    height: whiteBoxHeight,
                    color: rgb(1, 1, 1), // White
                });
                
                // Draw the signature image on top of the white box
                (signatureImageData as any).page.drawImage((signatureImageData as any).image, {
                    x: (signatureImageData as any).x,
                    y: (signatureImageData as any).y,
                    width: (signatureImageData as any).width,
                    height: (signatureImageData as any).height,
                });
                
                console.log(`White box drawn at: x=${whiteBoxX}, y=${whiteBoxY}, width=${whiteBoxWidth}, height=${whiteBoxHeight}`);
                console.log(`Signature image drawn on top at: x=${(signatureImageData as any).x}, y=${(signatureImageData as any).y}, width=${(signatureImageData as any).width}, height=${(signatureImageData as any).height}`);
            } catch (err) {
                console.warn('Error drawing signature image on top:', err);
            }
        }

        // 7b. Draw white background box and signature image for XHR reports on page 5 ABSOLUTELY LAST
        if (xhrSignatureImageData) {
            try {
                // Draw white background box first (to cover whatever is behind the signature)
                const widthMargin = 40; // 40px on each side = 80px total width margin
                const heightMargin = 20; // 20px on top and bottom = 40px total height margin
                
                const whiteBoxX = xhrSignatureImageData.x - widthMargin; // Large margin on left
                const whiteBoxY = xhrSignatureImageData.y - (heightMargin / 2); // Margin on bottom
                const whiteBoxWidth = xhrSignatureImageData.width + (widthMargin * 2); // Much wider (40px on each side)
                const whiteBoxHeight = xhrSignatureImageData.height + heightMargin; // Taller (20px on top and bottom)
                
                // Draw white rectangle behind signature to block everything
                xhrSignatureImageData.page.drawRectangle({
                    x: whiteBoxX,
                    y: whiteBoxY,
                    width: whiteBoxWidth,
                    height: whiteBoxHeight,
                    color: rgb(1, 1, 1), // White
                });
                
                // Draw the signature image on top of the white box
                xhrSignatureImageData.page.drawImage(xhrSignatureImageData.image, {
                    x: xhrSignatureImageData.x,
                    y: xhrSignatureImageData.y,
                    width: xhrSignatureImageData.width,
                    height: xhrSignatureImageData.height,
                });
                
                console.log(`XHR: White box drawn at: x=${whiteBoxX}, y=${whiteBoxY}, width=${whiteBoxWidth}, height=${whiteBoxHeight}`);
                console.log(`XHR: Signature image drawn on page 5 at: x=${xhrSignatureImageData.x}, y=${xhrSignatureImageData.y}, width=${xhrSignatureImageData.width}, height=${xhrSignatureImageData.height}`);
            } catch (err) {
                console.warn('Error drawing XHR signature image on page 5:', err);
            }
        }

        // 7c. Draw white background box and signature image for XHR reports on page 6 ABSOLUTELY LAST
        if (xhrPage6SignatureImageData) {
            try {
                // Draw white background box first (to cover whatever is behind the signature)
                const widthMargin = 40; // 40px on each side = 80px total width margin
                const heightMargin = 20; // 20px on top and bottom = 40px total height margin
                
                const whiteBoxX = xhrPage6SignatureImageData.x - widthMargin; // Large margin on left
                const whiteBoxY = xhrPage6SignatureImageData.y - (heightMargin / 2); // Margin on bottom
                const whiteBoxWidth = xhrPage6SignatureImageData.width + (widthMargin * 2); // Much wider (40px on each side)
                const whiteBoxHeight = xhrPage6SignatureImageData.height + heightMargin; // Taller (20px on top and bottom)
                
                // Draw white rectangle behind signature to block everything
                xhrPage6SignatureImageData.page.drawRectangle({
                    x: whiteBoxX,
                    y: whiteBoxY,
                    width: whiteBoxWidth,
                    height: whiteBoxHeight,
                    color: rgb(1, 1, 1), // White
                });
                
                // Draw the signature image on top of the white box
                xhrPage6SignatureImageData.page.drawImage(xhrPage6SignatureImageData.image, {
                    x: xhrPage6SignatureImageData.x,
                    y: xhrPage6SignatureImageData.y,
                    width: xhrPage6SignatureImageData.width,
                    height: xhrPage6SignatureImageData.height,
                });
                
                console.log(`XHR: White box drawn on page 6 at: x=${whiteBoxX}, y=${whiteBoxY}, width=${whiteBoxWidth}, height=${whiteBoxHeight}`);
                console.log(`XHR: Signature image drawn on page 6 at: x=${xhrPage6SignatureImageData.x}, y=${xhrPage6SignatureImageData.y}, width=${xhrPage6SignatureImageData.width}, height=${xhrPage6SignatureImageData.height}`);
            } catch (err) {
                console.warn('Error drawing XHR signature image on page 6:', err);
            }
        }

        // 7. Flatten PDF for XHR reports - PAUSED
        // Flattening temporarily disabled
        /*
        if (reportType === 'XHR') {
            try {
                console.log('🔄 Flattening XHR PDF BEFORE page removal (to avoid stale page references)...');
                // Get a fresh form reference
                const freshForm = pdfDoc.getForm();
                await flattenFormByRemovingFields(pdfDoc, freshForm);
                console.log('✅ PDF flattened successfully');
            } catch (flattenErr: any) {
                console.warn('⚠️ Failed to flatten PDF, but continuing with generation:', flattenErr.message);
                // Continue anyway - PDF will just be editable
            }
        }
        */

        // 8. Remove target page if results are positive (XHR reports only)
        // The target page is the one with new form fields (originally 6th page, index 5)
        // NOTE: This happens AFTER flattening - the flattened content on this page will be removed,
        // but that's okay since we're removing the entire page anyway
        if (reportType === 'XHR' && targetPageIndex !== null && data.fullExcelData && data.fullExcelData.length > 0) {
            try {
                const headerRow = data.fullExcelData[data.headerRowIndex || 0] || [];
                const isPositive = detectPositiveNegative(
                    data.fullExcelData,
                    headerRow,
                    data.headerRowIndex || 0
                );
                
                if (isPositive) {
                    // For positive reports: Excel pages are inserted at index 7 (after page 6),
                    // so page 6 stays at index 5 (targetPageIndex)
                    const adjustedTargetPageIndex = targetPageIndex;
                    const totalPages = pdfDoc.getPageCount();
                    
                    // Make sure the target page index is still valid
                    if (adjustedTargetPageIndex < totalPages) {
                        console.log(`Results are positive. Removing page at index ${adjustedTargetPageIndex} (6th page from original template, contains new form fields, adjusted for ${numExcelPagesInserted} Excel pages)`);
                        console.log(`   Note: Fields on this page were already flattened, so removing the page is safe.`);
                        pdfDoc.removePage(adjustedTargetPageIndex);
                        console.log(`Page removed. New total pages: ${pdfDoc.getPageCount()}`);
                    } else {
                        console.warn(`Target page index ${adjustedTargetPageIndex} is out of range. Total pages: ${totalPages}`);
                    }
                } else {
                    console.log('Results are negative. Keeping page with new form fields.');
                }
            } catch (err) {
                console.warn('Error checking positive/negative or removing page:', err);
                // Don't fail the whole generation if this check fails
            }
        }

        // 8b. Move original page 7 to position 6 (for XHR negative reports only)
        // For negative reports: Excel pages are inserted at index 5, so page 7 needs to be moved to position 6 (index 5)
        // For positive reports: Excel pages are inserted at index 7 (after page 6), so page 7 stays in place
        // IMPORTANT: Use copyPages to preserve the original page dimensions (especially for landscape pages)
        const isPositive = data.isPositive ?? false;
        if (reportType === 'XHR' && numExcelPagesInserted > 0 && !isPositive) {
            try {
                const pages = pdfDoc.getPages();
                const totalPages = pages.length;
                
                // Original page 7 was at index 6 in the template
                // After Excel pages are inserted at index 5 (for negative reports), the original page 7 is now at index 6 + numExcelPagesInserted
                const originalPage7Index = 6 + numExcelPagesInserted;
                
                // Check if the original page 7 exists
                if (originalPage7Index < totalPages) {
                    console.log(`Moving original page 7 (currently at index ${originalPage7Index}) to position 6 (index 5, right after pages 1-5)`);
                    
                    // Get the page size BEFORE any operations to preserve dimensions
                    const pageToMove = pages[originalPage7Index];
                    const pageSize = pageToMove.getSize();
                    const isLandscape = pageSize.width > pageSize.height;
                    console.log(`Page 7 original dimensions: ${pageSize.width}x${pageSize.height} (${isLandscape ? 'landscape' : 'portrait'})`);
                    
                    // Create a temporary PDF document to preserve the page with its exact dimensions
                    const tempPdfBytes = await pdfDoc.save();
                    const tempPdfDoc = await PDFDocument.load(tempPdfBytes);
                    
                    // Copy the page from temp document (this preserves all dimensions and content)
                    const [copiedPage] = await pdfDoc.copyPages(tempPdfDoc, [originalPage7Index]);
                    
                    // Remove the original page from the main document
                    pdfDoc.removePage(originalPage7Index);
                    
                    // Insert the copied page at position 6 (index 5) - copyPages preserves dimensions
                    pdfDoc.insertPage(5, copiedPage);
                    
                    // Verify the dimensions were preserved
                    const insertedPage = pdfDoc.getPages()[5];
                    const insertedSize = insertedPage.getSize();
                    if (Math.abs(insertedSize.width - pageSize.width) > 0.1 || Math.abs(insertedSize.height - pageSize.height) > 0.1) {
                        console.warn(`⚠️ Page dimensions changed during move! Original: ${pageSize.width}x${pageSize.height}, After: ${insertedSize.width}x${insertedSize.height}`);
                    } else {
                        console.log(`✅ Page dimensions preserved: ${insertedSize.width}x${insertedSize.height} (${isLandscape ? 'landscape' : 'portrait'})`);
                    }
                    
                    // Note: We'll rotate page 6 during flattening to avoid distortion
                    // Don't set rotation here - it will be handled in flattenFormAsImage
                    
                    console.log(`✅ Successfully moved original page 7 to position 6. New total pages: ${pdfDoc.getPageCount()}`);
                } else {
                    console.warn(`Original page 7 index ${originalPage7Index} is out of range. Total pages: ${totalPages}`);
                }
            } catch (err) {
                console.warn('Error moving original page 7 to position 6:', err);
                // Don't fail the whole generation if this fails
            }
        }

        // 8.5. Flatten XHR reports (after all operations are complete to avoid reference errors)
        if (reportType === 'XHR') {
            console.log('🔄 Flattening XHR report after all operations are complete...');
            try {
                await flattenFormAsImage(pdfDoc);
                console.log('✅ XHR report flattened successfully');
            } catch (err: any) {
                // If flattening fails, log the error but don't throw
                // This allows the PDF to still be generated (just editable)
                console.warn('⚠️ Failed to flatten XHR PDF:', err.message);
                if (err.message && err.message.includes('Could not find page')) {
                    console.warn('   ERROR: Form fields reference a page that no longer exists!');
                    console.warn('   This can happen when:');
                    console.warn('   - Pages are removed before flattening');
                    console.warn('   - Form fields reference pages from the original template that were modified');
                    console.warn('   - Internal pdf-lib page reference issues');
                    console.warn('   The PDF will be generated but will remain editable.');
                }
                // Don't throw - allow PDF to be generated even if not flattened
            }
        }

        // Note: Page 6 rotation is handled during flattening by preserving correct dimensions
        // No additional rotation needed - dimensions are preserved correctly

        // 9. Draw black numbers for Numb1 and Numb2 fields on page 4 AFTER all processing (including flattening)
        // This ensures the numbers are not removed by the flattening process
        // These fields are NOT filled in the regular form fields - only drawn as text overlay
        if (reportType === 'XHR') {
            try {
                const pages = pdfDoc.getPages();
                // Page 4 is at index 3 (0-indexed) - Excel pages are inserted at index 5, so page 4 should still be at index 3
                // But let's be safe and check if we have enough pages
                const page4Index = 3;
                if (pages.length > page4Index) {
                    const page4 = pages[page4Index];
                    
                    // Get the actual values from the data
                    const numb1Value = String(data['Numb1'] || data.totalReadings || '0');
                    const numb2Value = String(data['Numb2'] || data.positiveReadings || '0');
                    
                    console.log(`🔍 Drawing black numbers on page 4 (index ${page4Index}) AFTER flattening: Numb1="${numb1Value}", Numb2="${numb2Value}"`);
                    
                    // Known coordinates from field inspection:
                    // Numb1: X: 188.475, Y: 364.472, Width: 21.465, Height: 13.319
                    // Numb2: X: 206.445, Y: 348.513, Width: 20.938, Height: 13.319
                    
                    // Draw Numb1 value with small offset: slightly to the right and slightly lower
                    // Y coordinate is from bottom, so moving "down" means subtracting from Y
                    const numb1X = 188.475 + 2.5; // Offset to the right (2.5 points)
                    const numb1Y = 364.472 + 13.319 - 12; // y + height - 12 points (moved down more)
                    
                    page4.drawText(numb1Value, {
                        x: numb1X,
                        y: numb1Y,
                        size: 10,
                        font: boldFont,
                        color: rgb(0, 0, 0), // Black color
                    });
                    
                    // Draw Numb2 value with small offset: slightly to the right and slightly lower
                    const numb2X = 206.445 + 2.5; // Offset to the right (2.5 points)
                    const numb2Y = 348.513 + 13.319 - 12; // y + height - 12 points (moved down more)
                    
                    page4.drawText(numb2Value, {
                        x: numb2X,
                        y: numb2Y,
                        size: 10,
                        font: boldFont,
                        color: rgb(0, 0, 0), // Black color
                    });
                    
                    console.log(`✅ Drew black "${numb1Value}" for Numb1 on page 4 (index ${page4Index}) at (${numb1X}, ${numb1Y}) AFTER flattening`);
                    console.log(`✅ Drew black "${numb2Value}" for Numb2 on page 4 (index ${page4Index}) at (${numb2X}, ${numb2Y}) AFTER flattening`);
                } else {
                    console.warn(`⚠️ Page 4 (index ${page4Index}) not found. Total pages: ${pages.length}`);
                }
            } catch (pErr: any) {
                console.error('❌ Error drawing black numbers on page 4 AFTER flattening:', pErr.message, pErr.stack);
            }
        }

        // 10. Save and Download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        // Generate filename: "Final Lead Inspection Report [ADDRESS]"
        const address = (data.Address || data.address || '').trim().toUpperCase();
        const sanitizedAddress = address.replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const filename = sanitizedAddress 
            ? `Final Lead Inspection Report ${sanitizedAddress}.pdf`
            : `Final Lead Inspection Report.pdf`;
        
        link.download = filename;
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
