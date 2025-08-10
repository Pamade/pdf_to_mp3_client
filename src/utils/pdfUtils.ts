import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set worker source to the bundled worker file
GlobalWorkerOptions.workerSrc = window.location.origin + "/pdf.worker.min.mjs";

interface PDFPage {
  pageNumber: number;
  text: string;
}

function filterInvalidUTF8(text: string): string {
  // Remove invalid UTF-8 characters and clean up whitespace
  return text.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ.,;:?!\s\-]/g, '').replace(/\s+/g, ' ').trim();
}

export async function extractTextFromPDF(file: File): Promise<PDFPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  console.log('Total pages:', pdf.numPages);
  
  const pages: PDFPage[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(' ');
    pages.push({
      pageNumber: i,
      text: filterInvalidUTF8(text)
    });
  }

  return pages;
}