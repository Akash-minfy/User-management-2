const otpService = require('../src/services/otpService');
const mailer = require('../src/lib/mailer');
const rabbit = require('../src/lib/rabbit');

jest.mock('../src/lib/mailer');
jest.mock('../src/lib/rabbit');

describe('otpService.sendOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should publish a job with rabbit', async () => {
    rabbit.publishEmailJob.mockResolvedValue(true);
    await otpService.sendOtp({ toEmail: 'x@y.com', otp: '123456' });
    expect(rabbit.publishEmailJob).toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('should fallback to direct mailer when rabbit fails', async () => {
    rabbit.publishEmailJob.mockRejectedValue(new Error('rabbit fail'));
    mailer.sendMail.mockResolvedValue(true);
    await otpService.sendOtp({ toEmail: 'x@y.com', otp: '123456' });
    expect(mailer.sendMail).toHaveBeenCalled();
  });
});
