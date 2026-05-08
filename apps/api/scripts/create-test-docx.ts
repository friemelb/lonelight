import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as fs from 'fs/promises';
import * as path from 'path';

async function createTestDocxFiles() {
  const corpusDir = path.join(process.cwd(), 'data/corpus');

  // Create simple.docx - basic document with paragraphs
  const simpleDoc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'This is a simple test document.',
                bold: false,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'It contains multiple paragraphs to test the DOCX parser.',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'This is the third paragraph with some content.',
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Generate buffer and write to file
  const simpleBuffer = await Packer.toBuffer(simpleDoc);
  await fs.writeFile(path.join(corpusDir, 'simple.docx'), simpleBuffer);
  console.log('✅ Created simple.docx');

  // Create complex.docx - document with more content
  const complexDoc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Loan Application Document',
                bold: true,
                size: 28,
              }),
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
              new TextRun({
                text: 'Name: John Doe',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Address: 123 Main Street, Anytown, USA',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Loan Details',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Amount: $250,000',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Term: 30 years',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Interest Rate: 4.5%',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const complexBuffer = await Packer.toBuffer(complexDoc);
  await fs.writeFile(path.join(corpusDir, 'complex.docx'), complexBuffer);
  console.log('✅ Created complex.docx');

  console.log('\n✅ All test DOCX files created successfully!');
}

createTestDocxFiles().catch(console.error);
