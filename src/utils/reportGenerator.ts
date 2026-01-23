import * as XLSX from 'xlsx';
import type { ExtractedData } from '../App';

export const generateReport = (data: ExtractedData) => {
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // 1. Create a Summary Sheet
    const summaryData = [
        ['Lead Inspection Report'],
        ['Generated Date', new Date().toLocaleDateString()],
        [],
        ['Property Address', data.address],
        ['Inspector Name', data.inspectorName],
        ['Source File', data.fileName],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Report Summary');

    // 2. Add the Raw Data Sheet
    // If rawData is valid 2D array
    if (data.rawData && data.rawData.length > 0) {
        const rawSheet = XLSX.utils.aoa_to_sheet(data.rawData);
        XLSX.utils.book_append_sheet(wb, rawSheet, 'Raw Data');
    }

    // 3. Write file and trigger download
    XLSX.writeFile(wb, `LeadReport_${data.address.replace(/\s+/g, '_')}_XHR.xlsx`);
};
