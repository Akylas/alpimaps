import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '~': fileURLToPath(new URL('./app', import.meta.url)),
            '@shared': fileURLToPath(new URL('./tools/app', import.meta.url)),
            'kiss-orm': fileURLToPath(new URL('./node_modules/@akylas/kiss-orm', import.meta.url))
        }
    },
    test: {
        environment: 'node',
        include: ['app/**/*.test.ts', 'tools/app/**/*.test.ts']
    }
});
