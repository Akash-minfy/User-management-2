const request = require('supertest');
const express = require('express');
jest.mock('../src/services/otpService');
const otpService = require('../src/services/otpService');
const { sendOtp } = require('../src/controllers/otpController');

const app = express();
app.use(express.json());
app.post('/api/otp/send', sendOtp);

describe('POST /api/otp/send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/otp/send').send({});
    expect(res.status).toBe(400);
  });

  it('calls otpService.sendOtp on success', async () => {
    otpService.sendOtp.mockResolvedValue();
    const res = await request(app).post('/api/otp/send').send({ to: 'x@y.com', otp: '123456' });
    expect(res.status).toBe(200);
    expect(otpService.sendOtp).toHaveBeenCalledWith({ toEmail: 'x@y.com', otp: '123456' });
  });
});
