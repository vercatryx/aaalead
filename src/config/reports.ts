import type { ReportConfig } from '../types/reportStructure';

export const REPORTS: ReportConfig[] = [
    {
        id: 'XHR',
        name: 'XHR Lead Inspection Report',
        templateUrl: '/templates/XHRTEMP.pdf',
        mappings: [
            // 1. Address - user enters once, fills Address and address fields (Inspection Location stays blank)
            {
                pdfFieldId: 'Inspection Location',
                source: 'static',
                staticValue: '' // Leave blank on page 4
            },
            {
                pdfFieldId: 'Address',
                source: 'user_input',
                label: 'Property Address',
                inputType: 'text',
                required: true
            },
            {
                pdfFieldId: 'address',
                source: 'user_input', // Not shown as input field - auto-filled from Address field
                label: 'Property Address', // Reuses same value as Address
                inputType: 'text',
                required: false
            },
            {
                pdfFieldId: 'county',
                source: 'user_input',
                label: 'county',
                inputType: 'text'
            },
            {
                pdfFieldId: 'block',
                source: 'user_input',
                label: 'block',
                inputType: 'text'
            },
            {
                pdfFieldId: 'lot',
                source: 'user_input',
                label: 'lot',
                inputType: 'text'
            },
            {
                pdfFieldId: 'Units areas',
                source: 'user_input',
                label: 'Units areas',
                inputType: 'text'
            },
            // Building Type - default to "single family home" but editable
            {
                pdfFieldId: 'Building Type',
                source: 'user_input',
                label: 'Building Type',
                inputType: 'text',
                required: false
            },
            // Inspection Date (fills Date, insp date, insp date end, and Inspection Result date fields)
            {
                pdfFieldId: 'Date',
                source: 'user_input',
                label: 'Inspection Date',
                inputType: 'date',
                required: true
            },
            {
                pdfFieldId: 'insp date',
                source: 'static',
                staticValue: '' // Reuses same value as Date (filled automatically)
            },
            {
                pdfFieldId: 'insp date end',
                source: 'static',
                staticValue: '' // Reuses same value as Date (filled automatically)
            },
            {
                pdfFieldId: 'Today',
                source: 'user_input',
                label: 'Today (Report Date)',
                inputType: 'date',
                required: true
            },
            {
                pdfFieldId: 'cert date',
                source: 'static',
                staticValue: '' // Reuses same value as Date (filled automatically)
            },
            {
                pdfFieldId: 'cert date 2',
                source: 'static',
                staticValue: '' // Reuses same value as Today (Report Date) (filled automatically)
            },
            {
                pdfFieldId: 'Inspection Result',
                source: 'user_input',
                label: 'Inspection Result',
                inputType: 'text'
            },
            {
                pdfFieldId: 'Numb1',
                source: 'user_input',
                label: 'Amount of total readings',
                inputType: 'number'
            },
            {
                pdfFieldId: 'Numb2',
                source: 'user_input',
                label: 'Amount of positive readings',
                inputType: 'number'
            },
            // Note: Numb1 and Numb2 default to 0 if not provided (handled in StepConfirmation)
            // Inspector name (auto-filled from inspector dropdown, fills Inspector name and inpector name fields)
            {
                pdfFieldId: 'Inspector name',
                source: 'user_input', // Not shown as input field - auto-filled from dropdown in StepConfirmation
                label: 'Inspector name',
                inputType: 'text'
            },
            {
                pdfFieldId: 'inpector name ',
                source: 'user_input', // Not shown as input field - auto-filled from Inspector name
                label: 'Inspector name', // Reuses same value as Inspector name
                inputType: 'text',
                required: false
            },
            // Inspector sig - signature image is placed directly on page 5 from inspector documents, not a text input
            {
                pdfFieldId: 'Inspector sig',
                source: 'static',
                staticValue: '' // Image is handled separately in pdfGenerator
            },
            // 14. Contractor name - always static
            {
                pdfFieldId: 'contractor name ',
                source: 'static',
                staticValue: 'AAA Lead Professionals'
            },
            // 15. Contractor address - always static
            {
                pdfFieldId: 'contactor address',
                source: 'static',
                staticValue: '6 White Dove Court, Lakewood, NJ, 08701'
            },
            // 16. njdoh - filled from inspector variable (per inspector)
            {
                pdfFieldId: 'njdoh',
                source: 'static',
                staticValue: '' // Filled from inspector variable when inspector is selected
            },
            // 17. njdca - filled from general variable (shared across all reports)
            {
                pdfFieldId: 'njdca',
                source: 'static',
                staticValue: '' // Filled from general variable
            },
            {
                pdfFieldId: 'phone',
                source: 'static',
                staticValue: '732-719-5649'
            },
            {
                pdfFieldId: 'Inspection Info 1',
                source: 'user_input',
                label: 'Inspection Info 1',
                inputType: 'text'
            }
        ]
    }
];

export const getReportConfig = (id: string | null): ReportConfig | undefined => {
    return REPORTS.find(r => r.id === id);
};
