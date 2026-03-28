import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFReportOptions {
  title?: string;
  subtitle?: string;
  sections?: PDFSection[];
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  appIconUrl?: string;
  generatedDate?: Date;
}

export interface PDFSection {
  title: string;
  content: string | HTMLElement;
  isMarkdown?: boolean;
}

/**
 * Generate a professional PDF report with structure, page breaks, and styling
 */
export async function generateProfessionalPDF(
  options: PDFReportOptions,
  filename: string
): Promise<void> {
  const {
    title = 'MuniLens Report',
    subtitle = 'Municipal Infrastructure Report',
    sections = [],
    includeTableOfContents = true,
    includePageNumbers = true,
    appIconUrl,
    generatedDate = new Date()
  } = options;

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let currentPage = 1;
  let y = margin;

  // Helper to set font with sizes
  const setHeading1 = () => {
    pdf.setFontSize(24);
    pdf.setTextColor(11, 13, 45); // Dark blue
    pdf.setFont('helvetica', 'bold');
  };

  const setHeading2 = () => {
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235); // Blue
    pdf.setFont('helvetica', 'bold');
  };

  const setHeading3 = () => {
    pdf.setFontSize(12);
    pdf.setTextColor(37, 99, 235);
    pdf.setFont('helvetica', 'bold');
  };

  const setBody = () => {
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81); // Gray
    pdf.setFont('helvetica', 'normal');
  };

  const setMetadata = () => {
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128); // Light gray
    pdf.setFont('helvetica', 'normal');
  };

  // Helper to add page break
  const addPageBreak = () => {
    pdf.addPage();
    currentPage++;
    y = margin;
  };

  // Helper to check if we need a page break
  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded > pageHeight - margin) {
      addPageBreak();
    }
  };

  // Helper to add text with wrapping
  const addWrappedText = (text: string, maxWidth: number, isHeading: boolean = false) => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    const lineHeight = isHeading ? 8 : 5.5;
    const totalHeight = lines.length * lineHeight;

    checkPageBreak(totalHeight + 5);

    pdf.text(lines, margin, y);
    y += totalHeight + 3;
    return y;
  };

  // ============ PAGE 1: COVER PAGE ============
  setHeading1();
  
  // Add app icon if provided
  if (appIconUrl) {
    try {
      const img = new Image();
      img.src = appIconUrl;
      await new Promise((resolve) => {
        img.onload = () => {
          const iconSize = 30;
          const iconX = pageWidth / 2 - iconSize / 2;
          pdf.addImage(img, 'PNG', iconX, y, iconSize, iconSize);
          y += iconSize + 10;
          resolve(null);
        };
        img.onerror = () => {
          y += 10;
          resolve(null);
        };
      });
    } catch (err) {
      console.error('Failed to load app icon:', err);
      y += 10;
    }
  }

  // Title
  y += 30;
  checkPageBreak(30);
  pdf.text(title, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Subtitle
  setHeading2();
  pdf.text(subtitle, pageWidth / 2, y, { align: 'center' });
  y += 25;

  // Generated info
  setMetadata();
  const generatedText = `Generated on ${generatedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  pdf.text(generatedText, pageWidth / 2, y, { align: 'center' });
  y += 10;

  const versionText = 'MuniLens v1.0 • Municipal Infrastructure Intelligence';
  pdf.text(versionText, pageWidth / 2, y, { align: 'center' });

  // ============ PAGE 2: TABLE OF CONTENTS ============
  if (includeTableOfContents && sections.length > 0) {
    addPageBreak();

    setHeading2();
    pdf.text('Table of Contents', margin, y);
    y += 12;

    setBody();
    sections.forEach((section, idx) => {
      pdf.text(`${idx + 1}. ${section.title}`, margin + 5, y);
      y += 7;
    });

    y += 5;
  }

  // ============ PAGE: SECTIONS/CONTENT ============
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    addPageBreak();

    // Section title
    setHeading2();
    pdf.text(`${i + 1}. ${section.title}`, margin, y);
    y += 12;

    // Separator line
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Section content
    setBody();

    if (typeof section.content === 'string') {
      if (section.isMarkdown) {
        // Simple markdown parsing for basic formatting
        const lines = section.content.split('\n');
        lines.forEach(line => {
          if (line.startsWith('## ')) {
            setHeading3();
            addWrappedText(line.replace('## ', ''), contentWidth, true);
            setBody();
          } else if (line.startsWith('### ')) {
            setHeading3();
            addWrappedText(line.replace('### ', ''), contentWidth);
            setBody();
          } else if (line.startsWith('- ')) {
            checkPageBreak(8);
            pdf.text('•', margin + 3, y);
            pdf.text(line.replace('- ', ''), margin + 8, y, { maxWidth: contentWidth - 8 });
            y += 6;
          } else if (line.startsWith('* ')) {
            checkPageBreak(8);
            pdf.text('•', margin + 3, y);
            pdf.text(line.replace('* ', ''), margin + 8, y, { maxWidth: contentWidth - 8 });
            y += 6;
          } else if (line.trim()) {
            if (line.match(/^\d+\./)) {
              // Numbered list
              checkPageBreak(8);
              pdf.text(line, margin + 3, y, { maxWidth: contentWidth - 3 });
              y += 6;
            } else {
              // Regular paragraph
              const lines = pdf.splitTextToSize(line, contentWidth);
              checkPageBreak(lines.length * 5.5 + 5);
              pdf.text(lines, margin, y);
              y += lines.length * 5.5 + 3;
            }
          } else {
            y += 3; // Blank line
          }
        });
      } else {
        // Plain text content
        const lines = pdf.splitTextToSize(section.content, contentWidth);
        checkPageBreak(lines.length * 5.5 + 5);
        pdf.text(lines, margin, y);
        y += lines.length * 5.5 + 3;
      }
    } else if (section.content instanceof HTMLElement) {
      // Convert HTML to canvas then to image
      const canvas = await html2canvas(section.content, {
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

      checkPageBreak(imgHeight + 10);
      pdf.addImage(imgData, 'PNG', margin, y, contentWidth, imgHeight);
      y += imgHeight + 8;
    }

    y += 10; // Space after section
  }

  // ============ FOOTER: PAGE NUMBERS ============
  if (includePageNumbers) {
    // Add page numbers to all pages
    const pageCount = pdf.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      setMetadata();
      const pageNum = `Page ${p} of ${pageCount}`;
      pdf.text(pageNum, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  // Save PDF
  pdf.save(filename);
}

/**
 * Convert HTML element to PDF with professional formatting
 */
export async function exportHTMLElementToPDF(
  element: HTMLElement,
  filename: string,
  options?: {
    appIconUrl?: string;
    title?: string;
  }
): Promise<void> {
  const title = options?.title || 'MuniLens Report';
  const appIconUrl = options?.appIconUrl;

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Add header with icon
  if (appIconUrl) {
    try {
      const img = new Image();
      img.src = appIconUrl;
      await new Promise((resolve) => {
        img.onload = () => {
          pdf.addImage(img, 'PNG', pageWidth / 2 - 10, margin, 20, 20);
          resolve(null);
        };
        img.onerror = () => resolve(null);
      });
    } catch (err) {
      console.error('Failed to load app icon:', err);
    }
  }

  // Add title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(11, 13, 45);
  pdf.text(title, pageWidth / 2, margin + 35, { align: 'center' });

  // Add content image
  const imgProps = pdf.getImageProperties(imgData);
  const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
  
  let y = margin + 45;
  let pageCount = 1;

  if (y + imgHeight > pageHeight - margin) {
    pdf.addPage();
    y = margin;
    pageCount++;
  }

  pdf.addImage(imgData, 'PNG', margin, y, contentWidth, imgHeight);

  // Add page numbers
  const totalPages = Math.ceil((y + imgHeight) / pageHeight);
  for (let p = 1; p <= pdf.getNumberOfPages(); p++) {
    pdf.setPage(p);
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Page ${p}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  pdf.save(filename);
}

/**
 * Format date for PDF headers
 */
export function formatDateForPDF(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate report filename with timestamp
 */
export function generateReportFilename(prefix: string = 'MuniLens_Report'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/:/g, '-');
  return `${prefix}_${timestamp}_${time}.pdf`;
}
