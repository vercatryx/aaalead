import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function addSignatureField() {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Certif Template.pdf');
    const outputPath = templatePath; // Save back to same file

    try {
        // Load the existing PDF
        const pdfBuffer = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();
        
        // Get the Phone field
        const phoneField = form.getTextField('Phone');
        if (!phoneField) {
            throw new Error('Phone field not found in PDF');
        }

        // Get all pages
        const pages = pdfDoc.getPages();
        
        // Try to find the Phone field's widget to get its position
        // pdf-lib doesn't directly expose widget coordinates, so we'll need to access the field's widget
        const phoneWidget = phoneField.acroField.getWidgets()[0];
        if (!phoneWidget) {
            throw new Error('Phone field widget not found');
        }

        // Get the phone field's rectangle (position and size)
        const phoneRect = phoneWidget.getRectangle();
        const phoneX = phoneRect.x;
        const phoneY = phoneRect.y;
        const phoneWidth = phoneRect.width;
        const phoneHeight = phoneRect.height;

        console.log(`Phone field found at: x=${phoneX}, y=${phoneY}, width=${phoneWidth}, height=${phoneHeight}`);

        // Calculate signature field position: same x, same width, 30px below Phone field
        // Note: PDF coordinates start from bottom-left, so "below" means smaller y value
        // Place signature field 30px below the bottom of the phone field
        const signatureHeight = 50; // Reasonable height for signature field
        const phoneBottom = phoneY; // phoneY is the bottom-left y coordinate of the phone field
        const gap = 30; // 30px gap between phone field and signature field
        const signatureY = phoneBottom - gap - signatureHeight; // Position so there's a 30px gap
        const signatureX = phoneX;
        const signatureWidth = phoneWidth;

        // Check if Signature field already exists
        let signatureField;
        try {
            signatureField = form.getTextField('Signature');
            console.log('Signature field already exists, updating position...');
            // If it exists, remove it first
            form.removeField(signatureField);
        } catch (e) {
            // Field doesn't exist, create new one
            console.log('Creating new Signature field...');
        }

        // Create the Signature field
        signatureField = form.createTextField('Signature');
        signatureField.setText(''); // Empty by default
        
        // Find which page the Phone field is on (usually first page for forms)
        const targetPage = pages[0]; // Assuming first page, adjust if needed
        
        // Add the Signature field to the page
        signatureField.addToPage(targetPage, {
            x: signatureX,
            y: signatureY,
            width: signatureWidth,
            height: signatureHeight,
        });

        console.log(`Signature field added at: x=${signatureX}, y=${signatureY}, width=${signatureWidth}, height=${signatureHeight}`);

        // Save the modified PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
        
        console.log(`\n✅ Successfully added Signature field to template!`);
        console.log(`   File: ${outputPath}`);
        console.log(`   Position: ${signatureWidth}px wide, 300px below Phone field`);
    } catch (error) {
        console.error('Error adding Signature field:', error);
        process.exit(1);
    }
}

addSignatureField();
