import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function getFieldCoordinates() {
    // Use XHR template
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'XHRTEMP.pdf');

    if (!fs.existsSync(templatePath)) {
        console.error(`❌ Template not found at: ${templatePath}`);
        return;
    }

    try {
        const pdfBuffer = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log(`\n=== PDF Field Coordinates ===`);
        console.log(`File: ${templatePath}`);
        console.log(`Total Fields Found: ${fields.length}\n`);

        // Find Numb1 and Numb2 fields
        const targetFields = ['Numb1', 'Numb2'];
        
        for (const fieldName of targetFields) {
            const field = fields.find(f => f.getName() === fieldName);
            
            if (!field) {
                console.log(`❌ Field "${fieldName}" not found`);
                continue;
            }

            try {
                // Get the field's widgets (a field can have multiple widgets on different pages)
                const acroField = (field as any).acroField;
                const widgets = acroField.getWidgets();
                
                console.log(`\n📋 Field: "${fieldName}"`);
                console.log(`   Widgets found: ${widgets.length}`);
                
                for (let i = 0; i < widgets.length; i++) {
                    const widget = widgets[i];
                    const rect = widget.getRectangle();
                    
                    // Get page number
                    const pageRef = (widget.dict as any).get('P');
                    let pageNumber = 'unknown';
                    
                    if (pageRef) {
                        const pages = pdfDoc.getPages();
                        for (let p = 0; p < pages.length; p++) {
                            if (pages[p].ref === pageRef) {
                                pageNumber = (p + 1).toString();
                                break;
                            }
                        }
                    }
                    
                    console.log(`   Widget ${i + 1} (Page ${pageNumber}):`);
                    console.log(`      X: ${rect.x}`);
                    console.log(`      Y: ${rect.y}`);
                    console.log(`      Width: ${rect.width}`);
                    console.log(`      Height: ${rect.height}`);
                    console.log(`      Bottom-Left Corner: (${rect.x}, ${rect.y})`);
                    console.log(`      Top-Right Corner: (${rect.x + rect.width}, ${rect.y + rect.height})`);
                }
            } catch (err: any) {
                console.error(`   ❌ Error getting coordinates for "${fieldName}":`, err.message);
            }
        }

    } catch (error: any) {
        console.error('❌ Error inspecting PDF:', error.message);
    }
}

getFieldCoordinates();
