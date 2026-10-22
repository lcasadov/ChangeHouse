import { breakpointForWidth } from './useBreakpoint';

describe('breakpointForWidth', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [1023, 'medium'],
    [1024, 'expanded'],
    [1920, 'expanded'],
  ] as const)('%i px es %s', (width, expected) => {
    expect(breakpointForWidth(width)).toBe(expected);
  });
});
