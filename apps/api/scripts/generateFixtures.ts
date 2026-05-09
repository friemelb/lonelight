import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

async function generateSimpleDoc() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun('This is a simple test document'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('It contains some basic text.'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Used for testing the DOCX parser.'),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'data/corpus/simple.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Created ${outputPath}`);
}

async function generateComplexDoc() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: 'Loan Application',
              bold: true,
              size: 32,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(''),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Borrower Information',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Name: John Doe'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('SSN: 123-45-6789'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Date of Birth: January 15, 1985'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(''),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Employment Information',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Employer: Acme Corporation'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Position: Senior Engineer'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Annual Income: $120,000'),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'data/corpus/complex.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Created ${outputPath}`);
}

async function main() {
  console.log('Generating DOCX fixture files...');

  // Ensure corpus directory exists
  const corpusDir = path.join(process.cwd(), 'data/corpus');
  if (!fs.existsSync(corpusDir)) {
    fs.mkdirSync(corpusDir, { recursive: true });
  }

  await generateSimpleDoc();
  await generateComplexDoc();

  console.log('✅ All fixture files generated successfully!');
}

main().catch((error) => {
  console.error('Error generating fixtures:', error);
  process.exit(1);
});
