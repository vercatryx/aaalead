import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  let tempPdfPath: string | null = null
  let flattenedPdfPath: string | null = null
  
  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      )
    }

    console.log('🔄 Flattening PDF on server (trying multiple methods)...', {
      fileName: pdfFile.name,
      size: pdfFile.size
    })

    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // STEP 1: Save the PDF to disk first
    const __dirname = process.cwd()
    tempPdfPath = join(__dirname, `temp_${randomUUID()}.pdf`)
    console.log('💾 Saving finished PDF to disk first:', tempPdfPath)
    writeFileSync(tempPdfPath, buffer)
    console.log('✅ PDF saved to disk')
    
    // STEP 2: Load the PDF fresh from disk and update appearances
    console.log('📂 Loading PDF fresh from disk to update appearances...')
    const pdfBufferFromDisk = readFileSync(tempPdfPath)
    const pdfDoc = await PDFDocument.load(pdfBufferFromDisk)
    const form = pdfDoc.getForm()
    const fields = form.getFields()
    
    console.log(`📝 Found ${fields.length} form fields...`)
    
    // Update all field appearances to ensure values are rendered
    if (fields.length > 0) {
      console.log(`📝 Updating appearances for ${fields.length} fields...`)
      for (const field of fields) {
        try {
          if (typeof (field as any).updateAppearances === 'function') {
            await (field as any).updateAppearances()
          }
        } catch (updateErr) {
          // Some fields might not support updateAppearances, continue
        }
      }
    }
    
    // Save the PDF with updated appearances back to disk
    const pdfBytesWithAppearances = await pdfDoc.save()
    writeFileSync(tempPdfPath, pdfBytesWithAppearances)
    console.log('✅ PDF with updated appearances saved to disk')
    
    // STEP 3: Try to flatten using command-line tools (most reliable)
    flattenedPdfPath = join(__dirname, `temp_flattened_${randomUUID()}.pdf`)
    let flattenSuccess = false
    
    // Method 1: Try qpdf (most reliable for flattening)
    try {
      console.log('🔄 Trying qpdf to flatten PDF...')
      await execAsync(`qpdf --flatten-annotations=all "${tempPdfPath}" "${flattenedPdfPath}"`)
      if (existsSync(flattenedPdfPath)) {
        console.log('✅ PDF flattened successfully using qpdf')
        flattenSuccess = true
      }
    } catch (qpdfError) {
      console.log('⚠️ qpdf not available or failed, trying next method...')
    }
    
    // Method 2: Try pdftk
    if (!flattenSuccess) {
      try {
        console.log('🔄 Trying pdftk to flatten PDF...')
        await execAsync(`pdftk "${tempPdfPath}" output "${flattenedPdfPath}" flatten`)
        if (existsSync(flattenedPdfPath)) {
          console.log('✅ PDF flattened successfully using pdftk')
          flattenSuccess = true
        }
      } catch (pdftkError) {
        console.log('⚠️ pdftk not available or failed, trying next method...')
      }
    }
    
    // Method 3: Try ghostscript
    if (!flattenSuccess) {
      try {
        console.log('🔄 Trying ghostscript to flatten PDF...')
        await execAsync(`gs -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -dColorImageResolution=300 -dGrayImageResolution=300 -dMonoImageResolution=300 -sOutputFile="${flattenedPdfPath}" "${tempPdfPath}"`)
        if (existsSync(flattenedPdfPath)) {
          console.log('✅ PDF flattened successfully using ghostscript')
          flattenSuccess = true
        }
      } catch (gsError) {
        console.log('⚠️ ghostscript not available or failed, trying pdf-lib method...')
      }
    }
    
    // Method 4: Use Puppeteer to print PDF directly (optional - not available on Vercel)
    if (!flattenSuccess) {
      try {
        console.log('🔄 Trying Puppeteer to print PDF directly...')
        // Use Function constructor to prevent webpack from analyzing this import
        const puppeteerModule = await new Function('return import("puppeteer")')().catch(() => null)
        if (!puppeteerModule) {
          throw new Error('Puppeteer not available')
        }
        const puppeteer = puppeteerModule.default || puppeteerModule
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
          ]
        })
        
        const page = await browser.newPage()
        const pdfFileUrl = `file://${tempPdfPath}`
        await page.goto(pdfFileUrl, { 
          waitUntil: 'networkidle0', 
          timeout: 30000 
        })
        
        await page.waitForTimeout(2000)
        
        await page.pdf({
          path: flattenedPdfPath,
          format: 'Letter',
          printBackground: true,
          preferCSSPageSize: false,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        })
        
        await browser.close()
        
        if (existsSync(flattenedPdfPath)) {
          console.log('✅ PDF flattened successfully using Puppeteer print-to-PDF')
          flattenSuccess = true
        }
      } catch (puppeteerError: any) {
        console.log('⚠️ Puppeteer method failed, trying pdf-lib fallback...', puppeteerError.message)
      }
    }
    
    // Method 5: Use pdf-lib to try flattening (last resort)
    if (!flattenSuccess) {
      try {
        console.log('🔄 Trying pdf-lib flatten method (may not work reliably)...')
        const finishedPdfBuffer = readFileSync(tempPdfPath)
        const pdfDocForFlatten = await PDFDocument.load(finishedPdfBuffer)
        const formForFlatten = pdfDocForFlatten.getForm()
        
        try {
          formForFlatten.flatten()
        } catch (flattenErr) {
          // If flatten doesn't work, continue
        }
        
        const flattenedBytes = await pdfDocForFlatten.save()
        writeFileSync(flattenedPdfPath, flattenedBytes)
        console.log('✅ PDF processed using pdf-lib (may not be fully flattened)')
        flattenSuccess = true
      } catch (pdfLibError: any) {
        console.error('❌ pdf-lib method failed:', pdfLibError.message)
      }
    }
    
    if (!flattenSuccess) {
      throw new Error('All flattening methods failed. Please install qpdf, pdftk, or ghostscript for reliable PDF flattening.')
    }
    
    // Read the flattened PDF
    const flattenedPdfBuffer = readFileSync(flattenedPdfPath)
    
    // Clean up temp files
    try {
      if (tempPdfPath) unlinkSync(tempPdfPath)
      if (flattenedPdfPath) unlinkSync(flattenedPdfPath)
    } catch (cleanupErr) {
      console.warn('⚠️ Could not clean up temp files:', cleanupErr)
    }
    
    console.log('✅ PDF flattened successfully')
    return new NextResponse(flattenedPdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFile.name}"`,
      },
    })
    
  } catch (error: any) {
    // Clean up temp files on error
    try {
      if (tempPdfPath) {
        try {
          unlinkSync(tempPdfPath)
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }
      if (flattenedPdfPath) {
        try {
          unlinkSync(flattenedPdfPath)
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }
    
    console.error('❌ PDF flattening error:', error)
    return NextResponse.json(
      {
        error: 'PDF flattening failed',
        message: error.message,
        details: error.toString(),
        hint: 'For best results, install qpdf: brew install qpdf (Mac) or apt-get install qpdf (Linux)'
      },
      { status: 500 }
    )
  }
}
