import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function createDummyTemplate() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]); // Standard Page
    const form = pdfDoc.getForm();

    page.drawText('NJ Lead Inspection Report (Template)', { x: 50, y: 750, size: 20 });

    // Field: Performed_at
    page.drawText('Property Address:', { x: 50, y: 700, size: 12 });
    const addressField = form.createTextField('Performed_at');
    addressField.setText('Enter Address Here');
    addressField.addToPage(page, { x: 150, y: 685, width: 300, height: 20 });

    // Field: Performed_on
    page.drawText('Inspection Date:', { x: 50, y: 650, size: 12 });
    const dateField = form.createTextField('Performed_on');
    dateField.setText('MM/DD/YYYY');
    dateField.addToPage(page, { x: 150, y: 635, width: 200, height: 20 });

    // Field: Serial_Number
    page.drawText('Serial Number:', { x: 50, y: 600, size: 12 });
    const serialField = form.createTextField('Serial_Number');
    serialField.addToPage(page, { x: 150, y: 585, width: 200, height: 20 });

    // Field: Total_Readings
    page.drawText('Total Readings:', { x: 50, y: 550, size: 12 });
    const totalReadings = form.createTextField('Total_Readings');
    totalReadings.addToPage(page, { x: 150, y: 535, width: 100, height: 20 });

    // Field: Conclusion
    page.drawText('Conclusion:', { x: 50, y: 500, size: 12 });
    const conclusion = form.createTextField('Conclusion');
    conclusion.addToPage(page, { x: 150, y: 485, width: 200, height: 20 });

    const pdfBytes = await pdfDoc.save();

    const outputPath = path.join(process.cwd(), 'public', 'templates', 'NJ_Lead_Inspection_Report.pdf');
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`Dummy template created at: ${outputPath}`);
}

createDummyTemplate().catch(err => console.error(err));
