import pdfParse from 'pdf-parse-new';

const MIN_TEXT_CHARS = 40;
const defaultMaxPages = () => (Number(process.env.PDF_MAX_PAGES) > 0 ? Number(process.env.PDF_MAX_PAGES) : 60);

const STATUS_MESSAGES = {
  empty: 'The PDF file is empty.',
  malformed: 'The file is not a readable PDF. It may be corrupted or password-protected.',
  scanned: 'The PDF has no extractable text. It looks like a scanned document; OCR is not supported, so upload a text-based PDF.',
};

/**
 * Extracts text page by page with the existing pdf-parse-new dependency.
 * Returns an explicit status instead of throwing for empty, malformed, or
 * scanned (image-only) PDFs.
 */
export async function extractPdfPages(buffer, { maxPages = defaultMaxPages(), parse = pdfParse } = {}) {
  if (!buffer || buffer.length === 0) {
    return { status: 'empty', message: STATUS_MESSAGES.empty, pages: [], numPages: 0, truncated: false };
  }
  if (buffer.subarray(0, 1024).toString('latin1').indexOf('%PDF-') === -1) {
    return { status: 'malformed', message: STATUS_MESSAGES.malformed, pages: [], numPages: 0, truncated: false };
  }

  const byPage = [];
  const renderPage = parse.DEFAULT_OPTIONS?.pagerender;
  let result;
  try {
    result = await parse(buffer, {
      max: maxPages,
      verbosityLevel: 0,
      pagerender: async (pageData) => {
        const text = renderPage ? await renderPage(pageData) : '';
        byPage[(pageData.pageNumber ?? byPage.length + 1) - 1] = text;
        return text;
      },
    });
  } catch {
    return { status: 'malformed', message: STATUS_MESSAGES.malformed, pages: [], numPages: 0, truncated: false };
  }

  const numPages = Number(result?.numpages) || byPage.length;
  const rendered = Math.min(numPages, maxPages);
  const pages = Array.from({ length: rendered }, (_, i) => ({ page: i + 1, text: (byPage[i] ?? '').replace(/\u0000/g, '') }));
  const textChars = pages.reduce((sum, p) => sum + p.text.replace(/\s/g, '').length, 0);

  if (textChars < MIN_TEXT_CHARS) {
    return { status: 'scanned', message: STATUS_MESSAGES.scanned, pages, numPages, truncated: numPages > maxPages };
  }
  return { status: 'ok', message: null, pages, numPages, truncated: numPages > maxPages };
}
