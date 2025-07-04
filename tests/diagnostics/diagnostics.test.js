const request = require('supertest');
const diagnosticsApp = require('../../diagnostics/diagnostics-server');

describe('Diagnostics Server', () => {
    test('Health check should return 200', async () => {
        const response = await request(diagnosticsApp).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
    });
});
