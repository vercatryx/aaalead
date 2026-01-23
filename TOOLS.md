# PDF Form Field Editing Tools

## Recommended Tools for Viewing/Editing PDF Form Fields

### 1. **Adobe Acrobat Pro** (Best for GUI editing)
- **Free trial available**
- Open PDF → Tools → Prepare Form
- View all form fields with their names
- Edit field names, types, and properties
- **Download**: https://www.adobe.com/products/acrobat-pro.html

### 2. **PDFtk** (Command line, free)
- Open source tool for manipulating PDFs
- Can view and edit form fields
- **Install**: `brew install pdftk-java` (macOS) or download from pdftk.com

### 3. **Online Tools** (Quick inspection)
- **PDF24**: https://tools.pdf24.org/en/pdf-form-fields
- Upload PDF and view all form fields
- Limited editing capabilities

### 4. **Built-in Inspection Script** (Recommended)
Run this command to see all fields in your PDF template:

```bash
npm run inspect-pdf
```

This will:
- List all form fields with their exact names
- Show field types
- Generate a config snippet you can copy to `reports.ts`
- Save a JSON file with all field details to `scripts/pdf-fields.json`

## How to Use the Inspection Script

1. Make sure your PDF template is in `public/templates/XHR TEMPLATE.pdf`
2. Run: `npm run inspect-pdf`
3. The script will output:
   - All field names (exact strings to use in `pdfFieldId`)
   - Field types
   - A ready-to-copy config snippet
4. Copy the field names to `src/config/reports.ts` in the `pdfFieldId` field

## Current Field Mappings

Your current mappings are in `src/config/reports.ts`. Each field has:
- `pdfFieldId`: The exact field name in the PDF (must match exactly)
- `label`: What shows to the user
- `source`: Where the value comes from
- `inputType`: Type of input field

## Tips

- Field names in PDF are **case-sensitive** and must match exactly
- If a field name changes in the PDF, update `pdfFieldId` in `reports.ts`
- Use the inspection script after updating your PDF template
- The generated JSON file (`scripts/pdf-fields.json`) is a reference for all available fields
