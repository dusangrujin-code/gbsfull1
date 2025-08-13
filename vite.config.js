import { defineConfig } from 'vite';
import { glob } from 'glob';
import { resolve } from 'path';

// Find all HTML files in the src directory, including subdirectories
const htmlFiles = glob.sync('src/**/*.html');

// Create the input object for Rollup
const input = htmlFiles.reduce((acc, file) => {
  // Create a name for the entry point based on its path
  // e.g., 'src/rpo-training/index.html' becomes 'rpo-training/index'
  // and 'src/index.html' becomes 'index'
  const name = file
    .replace('src/', '')
    .replace('.html', '')
    .replace(/\/index$/, '') || 'index'; // Handle root index

  acc[name] = resolve(__dirname, file);
  return acc;
}, {});


export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: input,
    },
  },
});
