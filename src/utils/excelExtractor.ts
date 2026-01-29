import * as XLSX from 'xlsx';

export interface ExtractedSheetInfo {
    date?: string;
    address?: string;
    rawData: any[];
    headerRow?: any[];
    headerRowIndex?: number;
    isPositive?: boolean;
    totalReadings?: number;
    positiveReadings?: number;
    fullExcelData?: any[][]; // Full Excel data including header row
}

// Helper to format date with time preserved (YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS)
const formatDate = (dateStr: string | number | Date): string => {
    if (!dateStr) return '';

    let dateObj: Date | null = null;

    if (dateStr instanceof Date) {
        dateObj = dateStr;
    } else if (typeof dateStr === 'number') {
        // Excel serial date - includes time component
        dateObj = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
    } else {
        // String parsing - handles dates with or without time
        dateObj = new Date(dateStr);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
        // Return ISO format with time: YYYY-MM-DDTHH:MM:SS
        // This preserves the time component
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        
        // Return format: YYYY-MM-DDTHH:MM:SS
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    // Fallback: if it's already a string with time, preserve it
    if (typeof dateStr === 'string') {
        // If it already has time component, return as is
        if (dateStr.includes('T') || (dateStr.includes(' ') && dateStr.match(/\d{1,2}:\d{2}/))) {
            return dateStr;
        }
        // If it's just a date, try to preserve any time that might be in the original
        // For now, return the string as is - let the PDF formatter handle it
        return dateStr;
    }

    return String(dateStr);
};

export const extractSheetInfo = (sheet: XLSX.WorkSheet): ExtractedSheetInfo => {
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return { rawData: [] };
    }

    // Find Header Row (scan first 5 rows)
    let headerRowIndex = -1;
    let headerRow: any[] = [];

    for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
        const row = jsonData[i];
        // Simple heuristic: Row with "Date" or "Sample" or "Location"
        if (row.some((cell: any) =>
            String(cell).match(/(Date|Time|Collected|Sample|Location|Client)/i)
        )) {
            headerRowIndex = i;
            headerRow = row.map((cell: any) => String(cell).trim().toLowerCase());
            break;
        }
    }

    if (headerRowIndex === -1) {
        // Fallback: Use first row
        headerRowIndex = 0;
        headerRow = jsonData[0].map((cell: any) => String(cell).trim().toLowerCase());
    }

    const rawData = jsonData.slice(headerRowIndex + 1);
    let date = '';
    let address = '';

    // Identify Column Indices
    const dateColIdx = headerRow.findIndex(h => h.includes('date') || h.includes('time') || h.includes('collected'));
    const addressColIdx = headerRow.findIndex(h => h.includes('sample') || h.includes('location') || h.includes('address'));

    // Extract from first available data row
    if (rawData.length > 0) {
        const firstRow = rawData[0];

        if (dateColIdx !== -1) {
            date = formatDate(firstRow[dateColIdx]);
        }

        if (addressColIdx !== -1) {
            // Address logic: "26 Eglantine Ave" from Sample ID
            address = String(firstRow[addressColIdx] || '').trim();
        }
    }

    // Detect positive/negative status and calculate counts
    const isPositive = detectPositiveNegative(jsonData, headerRow, headerRowIndex);
    const { totalReadings, positiveReadings } = calculateReadingsCounts(jsonData, headerRow, headerRowIndex);

    return {
        date,
        address,
        rawData,
        headerRow,
        headerRowIndex,
        isPositive,
        totalReadings,
        positiveReadings,
        fullExcelData: jsonData // Store full Excel data including headers
    };
};

/**
 * Detects if a sheet is positive or negative based on the "Pb P/F" column
 * Rules:
 * - If any value in "Pb P/F" column is positive, the sheet is positive
 * - Ignore rows where the calibration column contains "PCS Cal" or similar calibration values
 * - Calibration rows: first 4 rows are always calibration, plus any row with calibration values in calibration column
 */
export const detectPositiveNegative = (
    jsonData: any[][],
    headerRow: any[],
    headerRowIndex: number
): boolean => {
    if (!jsonData || jsonData.length === 0 || !headerRow || headerRow.length === 0) {
        return false;
    }

    // Find the "Pb P/F" column index
    const pbPfColIndex = headerRow.findIndex((h: any) => {
        const headerStr = String(h).trim().toLowerCase();
        return headerStr.includes('pb p/f');
    });

    if (pbPfColIndex === -1) {
        // Column not found, default to negative
        return false;
    }

    // Find the calibration column index (if it exists)
    const calibrationColIndex = headerRow.findIndex((h: any) => 
        String(h).toLowerCase().includes('calibration')
    );

    // Get data rows (skip header row)
    const dataRows = jsonData.slice(headerRowIndex + 1);
    
    if (dataRows.length === 0) {
        return false;
    }

    // Check each data row (excluding calibration rows)
    for (let i = 0; i < dataRows.length; i++) {
        // Skip first 4 rows (always calibration)
        if (i < 4) {
            continue;
        }

        // Check if this row is a calibration row by looking at the calibration column
        if (calibrationColIndex !== -1) {
            const calibrationValue = String(dataRows[i][calibrationColIndex] || '').trim().toLowerCase();
            // If calibration column contains "pcs cal", "calibration", "cal", etc., skip this row
            if (calibrationValue.includes('pcs cal') || 
                calibrationValue.includes('calibration') || 
                calibrationValue.includes('cal')) {
                continue;
            }
        }

        // Now check the Pb P/F value for this non-calibration row
        const pbPfValue = String(dataRows[i][pbPfColIndex] || '').trim().toLowerCase();
        
        // Check if the value indicates positive
        // Common positive indicators: "positive", "pos", "p", "+", "fail", "f"
        if (pbPfValue === 'positive' || 
            pbPfValue === 'pos' || 
            pbPfValue === 'p' || 
            pbPfValue === '+' ||
            pbPfValue === 'fail' ||
            pbPfValue === 'f') {
            return true;
        }
    }

    return false;
};

/**
 * Calculates total readings and positive readings counts (excluding calibration rows)
 */
export const calculateReadingsCounts = (
    jsonData: any[][],
    headerRow: any[],
    headerRowIndex: number
): { totalReadings: number; positiveReadings: number } => {
    if (!jsonData || jsonData.length === 0 || !headerRow || headerRow.length === 0) {
        return { totalReadings: 0, positiveReadings: 0 };
    }

    // Find the "Pb P/F" column index
    const pbPfColIndex = headerRow.findIndex((h: any) => {
        const headerStr = String(h).trim().toLowerCase();
        return headerStr.includes('pb p/f');
    });

    if (pbPfColIndex === -1) {
        // Column not found
        return { totalReadings: 0, positiveReadings: 0 };
    }

    // Find the calibration column index (if it exists)
    const calibrationColIndex = headerRow.findIndex((h: any) => 
        String(h).toLowerCase().includes('calibration')
    );

    // Get data rows (skip header row)
    const dataRows = jsonData.slice(headerRowIndex + 1);
    
    if (dataRows.length === 0) {
        return { totalReadings: 0, positiveReadings: 0 };
    }

    let totalReadings = 0;
    let positiveReadings = 0;

    // Check each data row
    for (let i = 0; i < dataRows.length; i++) {
        // Count all rows for total readings (including calibration)
        totalReadings++;

        // Check if this is a calibration row
        let isCalibrationRow = false;
        
        // First 4 rows are always calibration
        if (i < 4) {
            isCalibrationRow = true;
        }
        
        // Check if this row is a calibration row by looking at the calibration column
        if (!isCalibrationRow && calibrationColIndex !== -1) {
            const calibrationValue = String(dataRows[i][calibrationColIndex] || '').trim().toLowerCase();
            // If calibration column contains "pcs cal", "calibration", "cal", etc., it's a calibration row
            if (calibrationValue.includes('pcs cal') || 
                calibrationValue.includes('calibration') || 
                calibrationValue.includes('cal')) {
                isCalibrationRow = true;
            }
        }

        // Only count positive readings from non-calibration rows
        if (!isCalibrationRow) {
            // Check if the Pb P/F value is positive
            const pbPfValue = String(dataRows[i][pbPfColIndex] || '').trim().toLowerCase();
            
            // Check if the value indicates positive
            if (pbPfValue === 'positive' || 
                pbPfValue === 'pos' || 
                pbPfValue === 'p' || 
                pbPfValue === '+' ||
                pbPfValue === 'fail' ||
                pbPfValue === 'f') {
                positiveReadings++;
            }
        }
    }

    return { totalReadings, positiveReadings };
};
