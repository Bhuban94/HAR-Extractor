const assert = require('assert');

(async () => {
    const imported = await import('har-extract-core');
    const HarExtractCore = imported.default ?? imported;

    // Polyfill atob for Node runtimes where it is unavailable.
    if (typeof globalThis.atob === 'undefined') {
        globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary');
    }

    // Provide JSZip global expected by createZipArchive.
    globalThis.JSZip = require('jszip');

    const tests = [];

    function test(name, fn) {
        tests.push({ name, fn });
    }

    test('exports all expected API functions/constants', () => {
        const expectedKeys = [
            'sanitizeSegment',
            'extensionFromMime',
            'normalizeQueryString',
            'buildRelativeOutputPath',
            'decodeContentBytes',
            'extractFilesFromHar',
            'createZipArchive',
            'extractFilesFromHarAsZip',
            'hashString',
            'WINDOWS_RESERVED_NAMES',
            'MIME_EXTENSIONS',
        ];

        for (const key of expectedKeys) {
            assert.ok(key in HarExtractCore, `Missing export: ${key}`);
        }
    });

    test('sanitizeSegment handles illegal chars and reserved names', () => {
        assert.strictEqual(HarExtractCore.sanitizeSegment('file<name>.txt'), 'file_name_.txt');
        assert.strictEqual(HarExtractCore.sanitizeSegment('CON'), '_CON');
        assert.strictEqual(HarExtractCore.sanitizeSegment('  value. '), 'value');
    });

    test('extensionFromMime resolves known and unknown types', () => {
        assert.strictEqual(HarExtractCore.extensionFromMime('application/json'), '.json');
        assert.strictEqual(HarExtractCore.extensionFromMime('text/javascript; charset=utf-8'), '.js');
        assert.strictEqual(HarExtractCore.extensionFromMime('application/x-custom'), '');
    });

    test('normalizeQueryString sorts parameters', () => {
        assert.strictEqual(HarExtractCore.normalizeQueryString('?b=2&a=1'), '?a=1&b=2');
        assert.strictEqual(HarExtractCore.normalizeQueryString('z=3&y=2'), '?y=2&z=3');
        assert.strictEqual(HarExtractCore.normalizeQueryString('?'), '');
    });

    test('hashString is deterministic', () => {
        const one = HarExtractCore.hashString('?a=1&b=2');
        const two = HarExtractCore.hashString('?a=1&b=2');
        assert.strictEqual(one, two);
        assert.ok(one.length >= 16, 'Hash length appears too short');
    });

    test('buildRelativeOutputPath maps url and query hash', () => {
        const base = HarExtractCore.buildRelativeOutputPath('https://example.com/api/data', 'application/json', false);
        assert.strictEqual(base, 'https/example.com/api/data.json');

        const withQuery = HarExtractCore.buildRelativeOutputPath('https://example.com/api/data?b=2&a=1', 'application/json', true);
        assert.ok(withQuery.startsWith('https/example.com/api/data__q_'));
        assert.ok(withQuery.endsWith('.json'));
    });

    test('decodeContentBytes supports utf-8 and base64', () => {
        const utf8 = HarExtractCore.decodeContentBytes({ text: 'hello', encoding: 'utf-8' });
        assert.strictEqual(Buffer.from(utf8).toString('utf8'), 'hello');

        const b64 = HarExtractCore.decodeContentBytes({
            text: Buffer.from('world', 'utf8').toString('base64'),
            encoding: 'base64',
        });
        assert.strictEqual(Buffer.from(b64).toString('utf8'), 'world');
    });

    test('extractFilesFromHar returns files/stats/queryMap/queryManifest/processingLog', async () => {
        const harData = {
            log: {
                entries: [
                    {
                        request: { method: 'GET', url: 'https://example.com/app.js?b=2&a=1' },
                        response: {
                            status: 200,
                            content: {
                                mimeType: 'application/javascript',
                                text: 'console.log("a")',
                                encoding: 'utf-8',
                            },
                        },
                    },
                    {
                        request: { method: 'GET', url: 'https://example.com/app.js?a=1&b=2' },
                        response: {
                            status: 200,
                            content: {
                                mimeType: 'application/javascript',
                                text: 'console.log("b")',
                                encoding: 'utf-8',
                            },
                        },
                    },
                    {
                        request: { method: 'GET', url: '' },
                        response: { status: 200, content: { mimeType: 'text/plain', text: 'x' } },
                    },
                    {
                        request: { method: 'GET', url: 'https://example.com/empty' },
                        response: { status: 204, content: { mimeType: 'text/plain' } },
                    },
                ],
            },
        };

        const progress = [];
        const result = await HarExtractCore.extractFilesFromHar(harData, {
            includeQuerySuffix: true,
            generateQueryManifest: true,
            harName: 'unit-test',
            onProgress: (p) => progress.push(p),
        });

        assert.strictEqual(result.stats.extracted, 1);
        assert.strictEqual(result.stats.skipped, 3);
        assert.strictEqual(result.stats.failed, 0);
        assert.strictEqual(result.stats.harName, 'unit-test');
        assert.strictEqual(result.files.size, 1);
        assert.strictEqual(result.queryMap.size, 1);
        assert.ok(result.queryManifest);
        assert.strictEqual(result.queryManifest.totalEntries, 1);
        assert.strictEqual(result.processingLog.length, 4);
        assert.strictEqual(progress.length, 4);

        const extractedPath = [...result.files.keys()][0];
        assert.ok(extractedPath.includes('__q_'));
    });

    test('createZipArchive creates zip with optional manifests', async () => {
        const files = new Map([['https/example.com/index.html', new Uint8Array([65, 66])]]);
        const queryManifest = {
            version: '1.0',
            generatedAt: new Date().toISOString(),
            harName: 'zip-test',
            totalEntries: 0,
            queryParameters: [],
        };
        const processingLog = [{ index: 0, url: 'https://example.com/', status: 'extracted' }];

        const zip = await HarExtractCore.createZipArchive(files, 'zip-test', queryManifest, processingLog);
        const data = await zip.generateAsync({ type: 'nodebuffer' });
        assert.ok(Buffer.isBuffer(data));
        assert.ok(data.length > 0);
    });

    test('extractFilesFromHarAsZip returns zip and metadata', async () => {
        const harData = {
            log: {
                entries: [
                    {
                        request: { method: 'GET', url: 'https://example.com/' },
                        response: {
                            status: 200,
                            content: {
                                mimeType: 'text/html',
                                text: '<html></html>',
                                encoding: 'utf-8',
                            },
                        },
                    },
                ],
            },
        };

        const result = await HarExtractCore.extractFilesFromHarAsZip(harData, {
            includeQuerySuffix: true,
            generateQueryManifest: true,
            harName: 'zip-flow',
        });

        assert.strictEqual(result.fileCount, 1);
        assert.strictEqual(result.stats.extracted, 1);
        assert.ok(result.zip);
    });

    let passed = 0;
    let failed = 0;

    for (const { name, fn } of tests) {
        try {
            await fn();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            failed++;
            console.error(`FAIL ${name}`);
            console.error(error.message || error);
        }
    }

    console.log(`\nSummary: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
})();
