import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName, pdfBase64, folderId = '1cnL1IpOBCGGdMzNPWmG1Ekq3IIPMC7G3' } = req.body;

  if (!fileName || !pdfBase64) {
    return res.status(400).json({ error: 'Missing fileName or pdfBase64' });
  }

  try {
    // 1. Setup Auth
    const authJSON = JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_JSON || '{}');
    if (!authJSON.client_email) {
      throw new Error('DRIVE_SERVICE_ACCOUNT_JSON environment variable is not configured or invalid.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: authJSON.client_email,
        private_key: authJSON.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 2. Checking for existing files & handle REV numbering
    let finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const baseName = finalFileName.replace(/\.pdf$/, '');
    
    // Search for all files starting with same name to find the latest version
    const listResponse = await drive.files.list({
      q: `'${folderId}' in parents and name contains '${baseName}' and trashed = false`,
      fields: 'files(id, name)',
    });

    const existingFiles = listResponse.data.files || [];
    
    // Check for exact duplicates or REV matches
    const exactMatch = existingFiles.find(f => f.name === finalFileName);
    if (exactMatch) {
      // Logic for REV increments
      let counter = 1;
      let newName = `${baseName} (REV${counter}).pdf`;
      while (existingFiles.find(f => f.name === newName)) {
        counter++;
        newName = `${baseName} (REV${counter}).pdf`;
      }
      finalFileName = newName;
    }

    // 3. Upload File
    const buffer = Buffer.from(pdfBase64, 'base64');
    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [folderId],
      },
      media: media,
      fields: 'id, name, webViewLink',
    });

    return res.status(200).json({ 
      success: true, 
      fileId: response.data.id, 
      fileName: response.data.name,
      link: response.data.webViewLink 
    });

  } catch (error) {
    console.error('Drive Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Minimal Readable stream helper for Node.js
import { Readable } from 'stream';
