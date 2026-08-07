import fs from 'fs';
import PDFDocument from 'pdfkit';

/**
 * Generates a standard, ATS-friendly PDF from text.
 * @param {string} text The resume text (tailored or original)
 * @param {string} outputPath Absolute path to save the PDF
 * @returns {Promise<void>}
 */
export function generateResumePDF(text, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Simple ATS-friendly styling
      doc.font('Helvetica').fontSize(11).lineGap(4);

      // Write text, handling basic markdown-like structures if present
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          doc.font('Helvetica-Bold').fontSize(16).text(line.replace('# ', '').trim());
          doc.moveDown(0.5);
        } else if (line.startsWith('## ')) {
          doc.font('Helvetica-Bold').fontSize(14).text(line.replace('## ', '').trim());
          doc.moveDown(0.3);
        } else if (line.startsWith('### ')) {
          doc.font('Helvetica-Bold').fontSize(12).text(line.replace('### ', '').trim());
          doc.moveDown(0.2);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.font('Helvetica').fontSize(11).text(`• ${line.substring(2).trim()}`, { indent: 15 });
        } else if (line.trim() === '') {
          doc.moveDown(0.5);
        } else {
          doc.font('Helvetica').fontSize(11).text(line);
        }
      }

      doc.end();

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
