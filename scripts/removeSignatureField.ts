import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function removeSignatureField() {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Certif Template.pdf');

    try {
        // Load the existing PDF
        const pdfBuffer = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();
        
        // Get the Signature field
        try {
            const signatureField = form.getTextField('Signature');
            if (signatureField) {
                // Remove the field from the form
                form.removeField(signatureField);
                console.log('Signature field removed from PDF template');
            }
        } catch (e) {
            console.log('Signature field not found or already removed');
        }

        // Save the modified PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(templatePath, pdfBytes);
        
        console.log(`\n✅ Successfully removed Signature field from template!`);
        console.log(`   File: ${templatePath}`);
        console.log(`   Signature image will be placed directly at: x=594.72, y=86.56, width=83.4, height=50`);
    } catch (error) {
        console.error('Error removing Signature field:', error);
        process.exit(1);
    }
}

removeSignatureField();
