import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Export jobs to text file
export async function exportToText(jobs, filename = null) {
  try {
    // Generate filename if not provided
    if (!filename) {
      const jobTitle = jobs[0]?.jobTitle || 'Jobs';
      const date = new Date().toISOString().split('T')[0];
      
      // Create clean, short filename
      let cleanTitle = jobTitle
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special characters
        .replace(/\s+/g, '_')             // Replace spaces with underscores
        .replace(/_+/g, '_')              // Replace multiple underscores with single
        .trim();
      
      // Limit length for cleaner filenames
      if (cleanTitle.length > 25) {
        cleanTitle = cleanTitle.substring(0, 25).trim();
      }
      
      filename = `${cleanTitle}_${date}.txt`;
    }
    
    // Ensure downloads directory exists
    const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    const filePath = path.join(downloadsDir, filename);
    
    // Format jobs for text export
    let content = `Job Search Results - ${new Date().toLocaleDateString()}\n`;
    content += '='.repeat(50) + '\n\n';
    
    jobs.forEach((job, index) => {
      content += `Job ${index + 1}:\n`;
      content += `🏢 Company: ${job.company || 'N/A'}\n`;
      content += `💼 Position: ${job.jobTitle || 'N/A'}\n`;
      content += `📍 Location: ${job.location || job.companyAddress || 'N/A'}\n`;
      content += `🌐 Work Type: ${job.remoteOnsite || 'N/A'}\n`;
      content += `💻 Technologies: ${job.languageRequirements || 'N/A'}\n`;
      content += `📅 Posted: ${job.postedDate || 'N/A'}\n`;
      content += `💰 Salary: ${job.salary || 'N/A'}\n`;
      content += `📋 Requirements: ${job.requirements || 'N/A'}\n`;
      content += `🎁 Benefits: ${job.benefits || 'N/A'}\n`;
      if (job.url) content += `🔗 URL: ${job.url}\n`;
      content += '\n' + '-'.repeat(30) + '\n\n';
    });
    
    // Write to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Text file saved: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('❌ Error exporting to text:', error);
    throw error;
  }
}

// Export jobs to CSV
export async function exportToCSV(jobs) {
  try {
    const headers = [
      'Company', 'Job Title', 'Location', 'Work Type', 'Technologies', 
      'Posted Date', 'Salary', 'Requirements', 'Benefits', 'URL'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    jobs.forEach(job => {
      const row = [
        `"${(job.company || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.jobTitle || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.companyAddress || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.remoteOnsite || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.languageRequirements || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.postedDate || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.salary || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.requirements || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.benefits || 'N/A').replace(/"/g, '""')}"`,
        `"${(job.url || 'N/A').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });
    
    return Buffer.from(csvContent, 'utf8');
  } catch (error) {
    console.error('❌ Error exporting to CSV:', error);
    throw error;
  }
}

// Export jobs to Excel
export async function exportToExcel(jobs) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Job Search Results');
    
    // Add headers
    worksheet.columns = [
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Job Title', key: 'jobTitle', width: 25 },
      { header: 'Location', key: 'companyAddress', width: 20 },
      { header: 'Work Type', key: 'remoteOnsite', width: 15 },
      { header: 'Technologies', key: 'languageRequirements', width: 25 },
      { header: 'Posted Date', key: 'postedDate', width: 15 },
      { header: 'Salary', key: 'salary', width: 15 },
      { header: 'Requirements', key: 'requirements', width: 30 },
      { header: 'Benefits', key: 'benefits', width: 25 },
      { header: 'URL', key: 'url', width: 40 }
    ];
    
    // Add data
    jobs.forEach(job => {
      worksheet.addRow({
        company: job.company || 'N/A',
        jobTitle: job.jobTitle || 'N/A',
        companyAddress: job.companyAddress || 'N/A',
        remoteOnsite: job.remoteOnsite || 'N/A',
        languageRequirements: job.languageRequirements || 'N/A',
        postedDate: job.postedDate || 'N/A',
        salary: job.salary || 'N/A',
        requirements: job.requirements || 'N/A',
        benefits: job.benefits || 'N/A',
        url: job.url || 'N/A'
      });
    });
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    throw error;
  }
}

// Export jobs to PDF
export async function exportToPDF(jobs) {
  try {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    // Add title
    doc.fontSize(20).text('Job Search Results', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);
    
    // Add job listings
    jobs.forEach((job, index) => {
      doc.fontSize(16).text(`Job ${index + 1}: ${job.jobTitle || 'N/A'}`, { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(12).text(`Company: ${job.company || 'N/A'}`);
      doc.text(`Location: ${job.companyAddress || 'N/A'}`);
      doc.text(`Work Type: ${job.remoteOnsite || 'N/A'}`);
      doc.text(`Technologies: ${job.languageRequirements || 'N/A'}`);
      doc.text(`Posted: ${job.postedDate || 'N/A'}`);
      doc.text(`Salary: ${job.salary || 'N/A'}`);
      
      if (job.requirements) {
        doc.moveDown(0.5);
        doc.text(`Requirements: ${job.requirements}`);
      }
      
      if (job.benefits) {
        doc.text(`Benefits: ${job.benefits}`);
      }
      
      if (job.url) {
        doc.text(`URL: ${job.url}`);
      }
      
      doc.moveDown(2);
      doc.lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(1);
    });
    
    doc.end();
    
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      
      doc.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error exporting to PDF:', error);
    throw error;
  }
} 