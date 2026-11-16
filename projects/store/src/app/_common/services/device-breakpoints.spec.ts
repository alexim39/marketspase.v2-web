import { deviceTypeForWidth } from '@marketspase/shared/core/ui/device.service';

describe('deviceTypeForWidth', () => {
  it('uses the phone breakpoint below 600px', () => {
    expect(deviceTypeForWidth(360)).toBe('mobile');
    expect(deviceTypeForWidth(599)).toBe('mobile');
  });

  it('treats 600px through 959px as tablet', () => {
    expect(deviceTypeForWidth(600)).toBe('tablet');
    expect(deviceTypeForWidth(768)).toBe('tablet');
    expect(deviceTypeForWidth(959)).toBe('tablet');
  });

  it('switches to desktop at 960px', () => {
    expect(deviceTypeForWidth(960)).toBe('desktop');
    expect(deviceTypeForWidth(1440)).toBe('desktop');
  });
});
