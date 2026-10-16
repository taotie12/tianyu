import {defineConfig} from 'vite';
export default defineConfig({optimizeDeps:{include:['exceljs']},test:{include:['tests/**/*.test.js']},build:{chunkSizeWarningLimit:1000}});
