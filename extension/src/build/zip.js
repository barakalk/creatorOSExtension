import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'creator-os-extension.zip');

async function createZip() {
  console.log('📦 Creating extension package...');
  
  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  // Remove existing zip file
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
    console.log('🗑️  Removed existing zip file');
  }
  
  // Create write stream for zip file
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Best compression
  });
  
  // Handle archive events
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('⚠️ ', err);
    } else {
      throw err;
    }
  });
  
  archive.on('error', (err) => {
    console.error('❌ Archive error:', err);
    throw err;
  });
  
  output.on('close', () => {
    const sizeInKB = (archive.pointer() / 1024).toFixed(2);
    console.log(`✅ Extension packaged successfully!`);
    console.log(`📁 File: ${OUTPUT_FILE}`);
    console.log(`📏 Size: ${sizeInKB} KB`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Go to chrome://extensions/');
    console.log('2. Enable Developer mode');
    console.log('3. Drag and drop the zip file or click "Load unpacked" and select the dist/ folder');
  });
  
  // Pipe archive data to the file
  archive.pipe(output);
  
  // Add files from dist directory
  console.log(`📂 Adding files from ${DIST_DIR}...`);
  
  // Copy manifest.json to dist if it doesn't exist
  const manifestSrc = path.join(PROJECT_ROOT, 'src/manifest.json');
  const manifestDest = path.join(DIST_DIR, 'manifest.json');
  
  if (fs.existsSync(manifestSrc) && !fs.existsSync(manifestDest)) {
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log('📋 Copied manifest.json to dist/');
  }
  
  // Add all files from dist directory
  archive.directory(DIST_DIR, false);
  
  // Finalize the archive
  await archive.finalize();
}

// Run the zip creation
createZip().catch((error) => {
  console.error('❌ Failed to create zip:', error);
  process.exit(1);
});