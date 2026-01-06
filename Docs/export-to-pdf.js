import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Configuration
const STORE_DIR = './src/app/store';
const OUTPUT_FILE = 'store-typescript-code.pdf';

// Font configuration
const FONT_SIZE = 8;
const LINE_HEIGHT = 10;
const MARGIN = 50;
const SECTION_SPACING = 30;
const CHARS_PER_LINE = 100;

// Color scheme for syntax highlighting (grayscale for PDF)
const COLORS = {
  comment: '#6A737D',
  keyword: '#D73A49',
  string: '#032F62',
  function: '#6F42C1',
  number: '#005CC5',
  decorator: '#E36209',
  type: '#005CC5',
  default: '#24292E'
};

// Clean text to avoid encoding issues
function cleanText(text) {
  // Replace problematic characters that might appear as "Ð"
  // This handles common encoding issues
  return text
    .replace(/\u00D0/g, '') // Remove Ð if it appears
    .replace(/\uFFFD/g, '') // Remove replacement character
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // Remove control characters
}

// Simple syntax highlighter for TypeScript
function highlightCode(line) {
  const trimmed = line.trim();
  
  // Comments
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return { text: cleanText(line), color: COLORS.comment };
  }
  
  // Decorators
  if (trimmed.startsWith('@')) {
    return { text: cleanText(line), color: COLORS.decorator };
  }
  
  // Strings
  if (line.includes("'") || line.includes('"') || line.includes('`')) {
    return { text: cleanText(line), color: COLORS.string };
  }
  
  // TypeScript/JavaScript Keywords
  const keywords = [
    'function', 'async', 'await', 'const', 'let', 'var', 'if', 'else', 'return', 
    'try', 'catch', 'for', 'while', 'switch', 'case', 'break', 'continue',
    'class', 'interface', 'type', 'enum', 'export', 'import', 'from', 'extends',
    'implements', 'public', 'private', 'protected', 'static', 'readonly', 'abstract',
    'constructor', 'ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'Component', 'Injectable',
    'Input', 'Output', 'EventEmitter', 'Observable', 'Subject', 'BehaviorSubject'
  ];
  for (const keyword of keywords) {
    if (new RegExp(`\\b${keyword}\\b`).test(line)) {
      return { text: cleanText(line), color: COLORS.keyword };
    }
  }
  
  // Type annotations
  if (line.includes(': ') && (line.includes('string') || line.includes('number') || 
      line.includes('boolean') || line.includes('any') || line.includes('void') ||
      line.includes('Promise') || line.includes('Observable'))) {
    return { text: cleanText(line), color: COLORS.type };
  }
  
  // Functions
  if (trimmed.includes('function ') || trimmed.includes('=>') || 
      trimmed.includes('()') || trimmed.match(/^\s*\w+\s*\(/)) {
    return { text: cleanText(line), color: COLORS.function };
  }
  
  return { text: cleanText(line), color: COLORS.default };
}

// Recursively find all TypeScript files in a directory
function findTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common ignore directories
      if (!['node_modules', '.git', 'dist', 'build', '.angular'].includes(file)) {
        findTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
      // Include .ts files but exclude test files
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Get relative path from store directory
function getRelativePath(fullPath) {
  const normalizedPath = path.normalize(fullPath);
  const storeIndex = normalizedPath.indexOf('store');
  if (storeIndex !== -1) {
    return normalizedPath.substring(storeIndex);
  }
  return fullPath;
}

// Organize files by folder structure
function organizeFiles(files) {
  const organized = {};
  
  files.forEach(filePath => {
    const relativePath = getRelativePath(filePath);
    const parts = relativePath.split(path.sep);
    const folder = parts.slice(0, -1).join(path.sep) || 'root';
    const fileName = parts[parts.length - 1];
    
    if (!organized[folder]) {
      organized[folder] = [];
    }
    
    organized[folder].push({
      name: fileName,
      path: filePath,
      relativePath: relativePath
    });
  });
  
  // Sort folders and files
  const sortedFolders = Object.keys(organized).sort();
  const result = {};
  
  sortedFolders.forEach(folder => {
    result[folder] = organized[folder].sort((a, b) => a.name.localeCompare(b.name));
  });
  
  return result;
}

// Add file content to PDF
function addFileToPDF(doc, fileInfo, startYPosition) {
  return new Promise((resolve, reject) => {
    try {
      // Read file content with explicit UTF-8 encoding
      let fileContent = fs.readFileSync(fileInfo.path, { encoding: 'utf8' });
      
      // Normalize line endings and clean content
      fileContent = fileContent
        .replace(/\r\n/g, '\n') // Normalize Windows line endings
        .replace(/\r/g, '\n')   // Normalize Mac line endings
        .replace(/\u00D0/g, '')  // Remove Ð characters
        .replace(/\uFFFD/g, ''); // Remove replacement characters
      
      const lines = fileContent.split('\n');
      const pageHeight = 792; // A4 height in points
      const bottomMargin = 50;
      let yPosition = startYPosition;
      
      // Add file header
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(`📄 ${fileInfo.relativePath}`, MARGIN, yPosition, { align: 'left' });
      
      yPosition += 20;
      
      // Add separator line
      doc.moveTo(MARGIN, yPosition)
         .lineTo(550 - MARGIN, yPosition)
         .stroke();
      
      yPosition += 15;
      
      // Use Courier font which has better character support
      doc.fontSize(FONT_SIZE)
         .font('Courier');
      
      lines.forEach((line, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - bottomMargin) {
          doc.addPage();
          yPosition = MARGIN;
        }
        
        const lineNumber = (index + 1).toString().padStart(4, ' ');
        const highlighted = highlightCode(line);
        
        // Clean the line text to avoid encoding issues
        const cleanLine = cleanText(highlighted.text);
        
        // Line number (gray)
        doc.fillColor('#999999')
           .text(lineNumber, MARGIN, yPosition, {
             width: 50,
             align: 'right'
           });
        
        // Code line - ensure text is properly encoded
        try {
          doc.fillColor(highlighted.color)
             .text(cleanLine, MARGIN + 60, yPosition, {
               width: 450,
               align: 'left',
               encoding: 'utf8'
             });
        } catch (error) {
          // Fallback: if there's an encoding error, use a safe version
          const safeLine = cleanLine.replace(/[^\x20-\x7E\n\r\t]/g, '?');
          doc.fillColor(highlighted.color)
             .text(safeLine, MARGIN + 60, yPosition, {
               width: 450,
               align: 'left'
             });
        }
        
        yPosition += LINE_HEIGHT;
      });
      
      // Add spacing after file
      yPosition += SECTION_SPACING;
      
      resolve(yPosition);
    } catch (error) {
      reject(error);
    }
  });
}

// Create PDF with all files
function createPDF(organizedFiles) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        margin: MARGIN,
        size: 'A4',
        info: {
          Title: 'Store TypeScript Code',
          Author: 'TradeSwitch',
          Subject: 'TypeScript Source Code Export from Store Folder',
          Creator: 'TradeSwitch Export Script'
        }
      });
      
      // Output file path
      const outputPath = path.join(process.cwd(), OUTPUT_FILE);
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      const pageHeight = 792; // A4 height in points
      let yPosition = MARGIN;
      
      // Add title page
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('TradeSwitch App', MARGIN, yPosition + 100, { align: 'center', width: 450 });
      
      doc.fontSize(16)
         .font('Helvetica')
         .text('Store TypeScript Code', MARGIN, yPosition + 140, { align: 'center', width: 450 });
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#666666')
         .text(`Generated: ${new Date().toLocaleString()}`, MARGIN, yPosition + 180, { align: 'center', width: 450 });
      
      // Count total files
      let totalFiles = 0;
      Object.values(organizedFiles).forEach(files => {
        totalFiles += files.length;
      });
      
      doc.fontSize(10)
         .fillColor('#666666')
         .text(`Total Files: ${totalFiles}`, MARGIN, yPosition + 210, { align: 'center', width: 450 });
      
      // Add table of contents
      yPosition = pageHeight - 200;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Table of Contents', MARGIN, yPosition, { align: 'left' });
      
      yPosition += 25;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#333333');
      
      Object.keys(organizedFiles).forEach((folder, index) => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = MARGIN;
        }
        doc.text(`${index + 1}. ${folder || 'Root'} (${organizedFiles[folder].length} files)`, MARGIN + 20, yPosition);
        yPosition += 15;
      });
      
      // Add new page for content
      doc.addPage();
      yPosition = MARGIN;
      
      // Process each folder synchronously
      const folders = Object.keys(organizedFiles);
      
      const processNextFolder = (folderIndex) => {
        if (folderIndex >= folders.length) {
          // All folders processed, add footer and finalize
          const pageCount = doc.bufferedPageRange().count;
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#666666')
             .text(
               `Page ${pageCount} | TradeSwitch Store TypeScript Code`,
               MARGIN,
               pageHeight - 30,
               { align: 'center', width: 450 }
             );
          
          // Finalize PDF
          doc.end();
          return;
        }
        
        const folder = folders[folderIndex];
        const files = organizedFiles[folder];
        
        // Add folder header
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = MARGIN;
        }
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(`📁 ${folder || 'Root'}`, MARGIN, yPosition, { align: 'left' });
        
        yPosition += 25;
        
        // Process each file in folder
        let fileIndex = 0;
        
        const processNextFile = () => {
          if (fileIndex >= files.length) {
            // All files in folder processed, move to next folder
            yPosition += SECTION_SPACING;
            processNextFolder(folderIndex + 1);
            return;
          }
          
          const fileInfo = files[fileIndex];
          
          addFileToPDF(doc, fileInfo, yPosition)
            .then(newYPosition => {
              yPosition = newYPosition;
              
              // Add page break if too close to bottom
              if (yPosition > pageHeight - 100) {
                doc.addPage();
                yPosition = MARGIN;
              }
              
              fileIndex++;
              processNextFile();
            })
            .catch(error => {
              console.error(`Error processing ${fileInfo.path}:`, error.message);
              fileIndex++;
              processNextFile();
            });
        };
        
        processNextFile();
      };
      
      // Start processing
      processNextFolder(0);
      
      stream.on('finish', () => {
        resolve(outputPath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Main function
async function exportToPDF() {
  
  try {
    // Check if store directory exists
    if (!fs.existsSync(STORE_DIR)) {
      console.error(`❌ Directory not found: ${STORE_DIR}`);
      process.exit(1);
    }
    
    // Find all TypeScript files
    const allFiles = findTypeScriptFiles(STORE_DIR);
    
    if (allFiles.length === 0) {
      return;
    }
    
    // Organize files by folder structure
    const organizedFiles = organizeFiles(allFiles);
    
    // Create PDF
    await createPDF(organizedFiles);
    
  } catch (error) {
    console.error('❌ Error during export:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
exportToPDF().catch(console.error);

