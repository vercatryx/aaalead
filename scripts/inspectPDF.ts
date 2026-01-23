import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function inspectPDF() {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Certif Template.pdf');

    try {
        const pdfBuffer = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log(`\n=== PDF Template Field Inspection ===`);
        console.log(`File: ${templatePath}`);
        console.log(`Total Fields Found: ${fields.length}\n`);

        const fieldList: { name: string; type: string; id: string }[] = [];

        fields.forEach(field => {
            const type = field.constructor.name.replace('PDF', '').replace('Field', ''); // Clean up type name
            const name = field.getName();
            fieldList.push({ name, type, id: name });
            
            // Try to get the value if it's a text field
            let value = '';
            try {
                if ('getText' in field) {
                    value = (field as any).getText() || '';
                }
            } catch (e) {
                // Field might not have a value
            }
            
            console.log(`Field: "${name}"`);
            console.log(`  Type: ${type}`);
            if (value) {
                console.log(`  Current Value: "${value}"`);
            }
            console.log('');
        });

        // Generate config snippet
        console.log('\n=== Copy this to reports.ts ===\n');
        console.log('mappings: [');
        fieldList.forEach((field, index) => {
            const comma = index < fieldList.length - 1 ? ',' : '';
            console.log(`    {`);
            console.log(`        pdfFieldId: '${field.name}',`);
            console.log(`        source: 'user_input',`);
            console.log(`        label: '${field.name.replace(/([A-Z])/g, ' $1').trim()}',`);
            console.log(`        inputType: 'text',`);
            console.log(`        required: false`);
            console.log(`    }${comma}`);
        });
        console.log(']\n');

        // Save to JSON file for easy reference
        const outputPath = path.join(process.cwd(), 'scripts', 'pdf-fields.json');
        fs.writeFileSync(outputPath, JSON.stringify(fieldList, null, 2));
        console.log(`✅ Field list saved to: ${outputPath}`);
        console.log(`   You can open this file to see all fields in a structured format.\n`);

    } catch (error) {
        console.error('Error inspecting PDF:', error);
    }
}

inspectPDF();
