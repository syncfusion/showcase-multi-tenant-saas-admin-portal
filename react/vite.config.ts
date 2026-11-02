import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'syncfusion-base': [
            '@syncfusion/ej2-react-base',
          ],
          'syncfusion-charts': [
            '@syncfusion/ej2-react-charts',
          ],
          'syncfusion-grids': [
            '@syncfusion/ej2-react-grids',
            '@syncfusion/ej2-react-gantt',
          ],
        },
      },
    },
  },
});