const request = require('supertest');
const app = require('../../backend/server');

describe('Backend Server', () => {
    test('Health check should return 200', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
    });
});
