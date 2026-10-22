import { AccessibilityInfo } from 'react-native';

import { announce } from './announce';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('announce', () => {
  it('lo dice a los lectores de pantalla', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();

    announce('Casa descartada');

    expect(spy).toHaveBeenCalledWith('Casa descartada');
  });
});
