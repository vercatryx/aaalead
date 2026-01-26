export type FieldSource = 'user_input' | 'excel_cell' | 'static' | 'calculation';

export interface FieldMapping {
    pdfFieldId: string;    // The actual form field name in the PDF
    source: FieldSource;

    // For 'user_input'
    label?: string;        // Form label shown to user
    inputType?: 'text' | 'date' | 'number';
    required?: boolean;

    // For date fields that need to be split into multiple PDF fields (e.g., month/day/year)
    splitDateToFields?: string[];  // Array of additional PDF field IDs to populate from this date input

    // For 'excel_cell'
    excelColumn?: string;  // e.g. "B" or "Result" (header name)
    excelRow?: number;     // Fixed row number (optional)

    // For 'static'
    staticValue?: string;
}

export interface ReportConfig {
    id: string;
    name: string;
    templateUrl: string; // URL to the PDF template (e.g., /templates/file.pdf)
    certifTemplateUrl?: string; // Optional certificate template URL
    mappings: FieldMapping[];
}
