const { ftpSettingsSchema } = require('../../src/validation/schemas');

describe('ftpSettingsSchema', () => {
  test('accepts valid complete FTP settings', () => {
    const input = {
      enabled: true,
      port: 2121,
      username: 'photolive',
      password: 'photolive',
      pasv_min: 1024,
      pasv_max: 1048,
    };
    const result = ftpSettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  test('accepts partial FTP settings', () => {
    const result = ftpSettingsSchema.safeParse({ enabled: true });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ enabled: true });
  });

  test('accepts empty object', () => {
    const result = ftpSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('rejects invalid port (0)', () => {
    const result = ftpSettingsSchema.safeParse({ port: 0 });
    expect(result.success).toBe(false);
  });

  test('rejects invalid port (> 65535)', () => {
    const result = ftpSettingsSchema.safeParse({ port: 70000 });
    expect(result.success).toBe(false);
  });

  test('rejects negative port', () => {
    const result = ftpSettingsSchema.safeParse({ port: -1 });
    expect(result.success).toBe(false);
  });

  test('rejects empty username', () => {
    const result = ftpSettingsSchema.safeParse({ username: '' });
    expect(result.success).toBe(false);
  });

  test('rejects empty password', () => {
    const result = ftpSettingsSchema.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });

  test('rejects unknown fields (strict mode)', () => {
    const result = ftpSettingsSchema.safeParse({ enabled: true, unknownField: 'test' });
    expect(result.success).toBe(false);
  });

  test('rejects non-boolean enabled', () => {
    const result = ftpSettingsSchema.safeParse({ enabled: 'yes' });
    expect(result.success).toBe(false);
  });

  test('rejects non-integer port', () => {
    const result = ftpSettingsSchema.safeParse({ port: 21.5 });
    expect(result.success).toBe(false);
  });

  test('accepts port at boundary (1)', () => {
    const result = ftpSettingsSchema.safeParse({ port: 1 });
    expect(result.success).toBe(true);
  });

  test('accepts port at boundary (65535)', () => {
    const result = ftpSettingsSchema.safeParse({ port: 65535 });
    expect(result.success).toBe(true);
  });

  test('rejects pasv_min below 1024', () => {
    const result = ftpSettingsSchema.safeParse({ pasv_min: 100 });
    expect(result.success).toBe(false);
  });

  test('rejects pasv_max below 1024', () => {
    const result = ftpSettingsSchema.safeParse({ pasv_max: 500 });
    expect(result.success).toBe(false);
  });
});

describe('FtpService', () => {
  let FtpService;

  beforeAll(() => {
    // Mock ftp-srv to avoid actual server creation in tests
    jest.mock('ftp-srv', () => {
      return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        listen: jest.fn().mockResolvedValue(),
        close: jest.fn(),
      }));
    });

    FtpService = require('../../src/services/ftpService');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('constructor initializes with default settings', () => {
    const service = new FtpService({});
    const status = service.getStatus();

    expect(status.enabled).toBe(false);
    expect(status.running).toBe(false);
    expect(status.port).toBe(2121);
    expect(status.connections).toBe(0);
    expect(status.totalUploads).toBe(0);
  });

  test('constructor uses config values', () => {
    const service = new FtpService({
      ftp: {
        enabled: true,
        port: 9999,
        username: 'user',
        password: 'pass',
        pasv_min: 2000,
        pasv_max: 3000,
      }
    });
    const settings = service.getSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.port).toBe(9999);
    expect(settings.username).toBe('user');
    expect(settings.password).toBe('pass');
    expect(settings.pasv_min).toBe(2000);
    expect(settings.pasv_max).toBe(3000);
  });

  test('does not start when disabled', async () => {
    const service = new FtpService({});
    await service.start('./photos');
    expect(service.isRunning).toBe(false);
  });

  test('getStatus returns correct structure', () => {
    const service = new FtpService({});
    const status = service.getStatus();

    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('port');
    expect(status).toHaveProperty('username');
    expect(status).toHaveProperty('connections');
    expect(status).toHaveProperty('totalUploads');
  });

  test('getSettings returns correct structure', () => {
    const service = new FtpService({});
    const settings = service.getSettings();

    expect(settings).toHaveProperty('enabled');
    expect(settings).toHaveProperty('port');
    expect(settings).toHaveProperty('username');
    expect(settings).toHaveProperty('password');
    expect(settings).toHaveProperty('pasv_min');
    expect(settings).toHaveProperty('pasv_max');
  });

  test('_handleUploadComplete emits imageAdded for supported formats', () => {
    const service = new FtpService({
      supportedFormats: ['.jpg', '.png'],
    });
    service.photosPath = '/photos';
    
    const emitSpy = jest.spyOn(service, 'emit');
    service._handleUploadComplete('/photos/test.jpg');
    
    expect(emitSpy).toHaveBeenCalledWith('imageAdded', '/photos/test.jpg', 'test.jpg');
    expect(service.totalUploads).toBe(1);
  });

  test('_handleUploadComplete ignores unsupported formats', () => {
    const service = new FtpService({
      supportedFormats: ['.jpg', '.png'],
    });
    service.photosPath = '/photos';
    
    const emitSpy = jest.spyOn(service, 'emit');
    service._handleUploadComplete('/photos/test.txt');
    
    expect(emitSpy).not.toHaveBeenCalledWith('imageAdded', expect.anything(), expect.anything());
    expect(service.totalUploads).toBe(0);
  });

  test('stop does nothing when no server', async () => {
    const service = new FtpService({});
    // Should not throw
    await service.stop();
    expect(service.isRunning).toBe(false);
  });

  test('updateSettings enables server', async () => {
    const service = new FtpService({});
    service.photosPath = './photos';

    // Mock start to avoid real FTP server
    service.start = jest.fn().mockResolvedValue();

    await service.updateSettings({ enabled: true });
    expect(service.start).toHaveBeenCalled();
  });

  test('updateSettings disables server', async () => {
    const service = new FtpService({ ftp: { enabled: true } });
    service.isRunning = true;

    service.stop = jest.fn().mockResolvedValue();

    await service.updateSettings({ enabled: false });
    expect(service.stop).toHaveBeenCalled();
  });
});
