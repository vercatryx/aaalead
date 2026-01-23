import type { ReportConfig } from '../types/reportStructure';

export const REPORTS: ReportConfig[] = [
    {
        id: 'XHR',
        name: 'XHR Lead Inspection Report',
        templateUrl: '/templates/XHRTEMP.pdf',
        mappings: [
            // 1. Address - user enters once, fills Address field (Inspection Location stays blank)
            {
                pdfFieldId: 'Inspection Location',
                source: 'static',
                staticValue: '' // Leave blank on page 4
            },
            {
                pdfFieldId: 'Address',
                source: 'user_input',
                label: '1. Property Address',
                inputType: 'text',
                required: true
            },
            {
                pdfFieldId: 'address',
                source: 'user_input',
                label: '1. Property Address', // Reuses same value as Address
                inputType: 'text',
                required: false
            },
            {
                pdfFieldId: 'county',
                source: 'user_input',
                label: '2. county',
                inputType: 'text'
            },
            {
                pdfFieldId: 'block',
                source: 'user_input',
                label: '3. block',
                inputType: 'text'
            },
            {
                pdfFieldId: 'lot',
                source: 'user_input',
                label: '4. lot',
                inputType: 'text'
            },
            {
                pdfFieldId: 'Units areas',
                source: 'user_input',
                label: '5. Units areas',
                inputType: 'text'
            },
            // 6. Building Type - default to "single family home"
            {
                pdfFieldId: 'Building Type',
                source: 'static',
                staticValue: 'single family home'
            },
            // 7. Inspection Date (fills Date, insp date, insp date end, and Inspection Result date fields)
            {
                pdfFieldId: 'Date',
                source: 'user_input',
                label: '6. Inspection Date',
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
                label: '7. Today (Report Date)',
                inputType: 'date',
                required: true
            },
            {
                pdfFieldId: 'cert date',
                source: 'static',
                staticValue: '' // Reuses same value as Date (filled automatically)
            },
            {
                pdfFieldId: 'Inspection Result',
                source: 'user_input',
                label: '9. Inspection Result',
                inputType: 'text'
            },
            {
                pdfFieldId: 'Numb1',
                source: 'user_input',
                label: '10. Numb1',
                inputType: 'number'
            },
            {
                pdfFieldId: 'Numb2',
                source: 'user_input',
                label: '11. Numb2',
                inputType: 'number'
            },
            // Note: Numb1 and Numb2 default to 0 if not provided (handled in StepConfirmation)
            // 12. Inspector name (fills Inspector name and inpector name fields - from dropdown or manual entry)
            {
                pdfFieldId: 'Inspector name',
                source: 'user_input',
                label: '12. Inspector name',
                inputType: 'text'
            },
            {
                pdfFieldId: 'inpector name ',
                source: 'user_input',
                label: '12. Inspector name', // Reuses same value as Inspector name
                inputType: 'text',
                required: false
            },
            {
                pdfFieldId: 'Inspector sig',
                source: 'user_input',
                label: '13. Inspector sig',
                inputType: 'text'
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
            {
                pdfFieldId: 'njdoh',
                source: 'user_input',
                label: '16. njdoh',
                inputType: 'text'
            },
            {
                pdfFieldId: 'njdca',
                source: 'user_input',
                label: '17. njdca',
                inputType: 'text'
            },
            {
                pdfFieldId: 'phone',
                source: 'static',
                staticValue: '732-719-5649'
            },
            {
                pdfFieldId: 'Inspection Info 1',
                source: 'user_input',
                label: '19. Inspection Info 1',
                inputType: 'text'
            },
            {
                pdfFieldId: 'Inspection Info 2',
                source: 'user_input',
                label: '20. Inspection Info 2',
                inputType: 'text'
            }
        ]
    },
    {
        id: 'CERTIF',
        name: 'Certificate Report',
        templateUrl: '/templates/Certif Template.pdf',
        mappings: [
            // Fields 1 & 2 - removed as inputs (not filled)
            {
                pdfFieldId: 'BHI Registration Number',
                source: 'static',
                staticValue: ''
            },
            {
                pdfFieldId: 'Facility ID',
                source: 'static',
                staticValue: ''
            },
            // Field 3
            {
                pdfFieldId: 'Site Address',
                source: 'user_input',
                label: 'Site Address',
                inputType: 'text',
                required: false
            },
            // Field 4
            {
                pdfFieldId: 'County',
                source: 'user_input',
                label: 'County',
                inputType: 'text',
                required: false
            },
            // Field 5
            {
                pdfFieldId: 'Block',
                source: 'user_input',
                label: 'Block',
                inputType: 'text',
                required: false
            },
            // Field 6
            {
                pdfFieldId: 'Lot',
                source: 'user_input',
                label: 'Lot',
                inputType: 'text',
                required: false
            },
            // Fields 7 & 8 - one input that can split to two lines if long
            {
                pdfFieldId: 'Applicable Units or Common Areas 1',
                source: 'user_input',
                label: 'Applicable Units or Common Areas',
                inputType: 'text',
                required: false
            },
            {
                pdfFieldId: 'Applicable Units or Common Areas 2',
                source: 'static',
                staticValue: '' // Will be filled from field 1 if text is long
            },
            // Field 9
            {
                pdfFieldId: 'Name of Inspector  Risk Assessor',
                source: 'user_input',
                label: 'Name of Inspector',
                inputType: 'text',
                required: false
            },
            // Field 10
            {
                pdfFieldId: 'NJDOH ID',
                source: 'user_input',
                label: 'NJDOH ID #',
                inputType: 'text',
                required: false
            },
            // Field 11 - always static
            {
                pdfFieldId: 'Name of Evaluation Contractor',
                source: 'static',
                staticValue: 'AAA Lead Professionals'
            },
            // Field 12
            {
                pdfFieldId: 'NJDCA CERT',
                source: 'user_input',
                label: 'NJDCA CERT',
                inputType: 'text',
                required: false
            },
            // Field 13 - always static
            {
                pdfFieldId: 'Address of Evaluation Contractor',
                source: 'static',
                staticValue: '6 White Dove Court, Lakewood, NJ, 08701'
            },
            // Field 14 - always static
            {
                pdfFieldId: 'Phone',
                source: 'static',
                staticValue: '732-719-5649'
            },
            // Fields 15-17: First date group - split into MM, DD, YYYY
            {
                pdfFieldId: 'Dates of Inspection',
                source: 'user_input',
                label: 'Inspection Date',
                inputType: 'date',
                required: false
            },
            {
                pdfFieldId: 'undefined',
                source: 'static',
                staticValue: '' // Will be filled with DD from Inspection Date
            },
            {
                pdfFieldId: 'undefined_2',
                source: 'static',
                staticValue: '' // Will be filled with YYYY from Inspection Date
            },
            // Fields 18-20: Second date group - split into MM, DD, YYYY
            {
                pdfFieldId: 'TO',
                source: 'static',
                staticValue: '' // Will be filled with MM from Inspection Date
            },
            {
                pdfFieldId: 'undefined_3',
                source: 'static',
                staticValue: '' // Will be filled with DD from Inspection Date
            },
            {
                pdfFieldId: 'undefined_4',
                source: 'static',
                staticValue: '' // Will be filled with YYYY from Inspection Date
            },
            // Fields 21-24: Third date group - split into MM, DD, YYYY
            {
                pdfFieldId: 'Date Certificate Issued',
                source: 'static',
                staticValue: '' // Will be filled with MM from Inspection Date
            },
            {
                pdfFieldId: 'undefined_5',
                source: 'static',
                staticValue: '' // Will be filled with DD from Inspection Date
            },
            {
                pdfFieldId: 'undefined_6a',
                source: 'static',
                staticValue: '' // Will be filled with YYYY from Inspection Date
            },
            // Signature field - image is placed directly on page from inspector documents, not a text input
            {
                pdfFieldId: 'Signature of Inspector  Risk Assessor',
                source: 'static',
                staticValue: '' // Image is handled separately in pdfGenerator
            },
            // Signature - handled separately, image placed directly on page (field removed from template)
            // Check Box8 - removed from user inputs, leave blank
            {
                pdfFieldId: 'Check Box8',
                source: 'static',
                staticValue: ''
            }
        ]
    }
];

export const getReportConfig = (id: string | null): ReportConfig | undefined => {
    return REPORTS.find(r => r.id === id);
};
