import React, { act } from 'react';
import { JSDOM } from 'jsdom';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element) => {
    render: (element: React.ReactNode) => void;
    unmount: () => void;
  };
};
type Root = ReturnType<typeof createRoot>;
import { SmartPlugDevice } from '../../../types';
import { INITIAL_SMART_PLUGS } from '../../../lib/smartPlugSimulator';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: require('../../../constants/theme').THEMES.warm,
    mode: 'warm',
    fontScale: 1.0,
    language: 'english',
  }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const makeComp = (tag: string) => {
    const Comp = ({
      children,
      onPress,
      accessibilityRole: _ar,
      accessibilityLabel: _al,
      showsVerticalScrollIndicator: _sv,
      activeOpacity: _ao,
      ...props
    }: any) => React.createElement(tag, { ...props, onClick: onPress }, children);
    Comp.displayName = `Mock_${tag}`;
    return Comp;
  };

  return {
    Modal: ({ visible, children }: any) => (visible ? React.createElement('div', null, children) : null),
    View: makeComp('div'),
    Text: makeComp('span'),
    TouchableOpacity: makeComp('button'),
    TextInput: (props: any) => React.createElement('input', props),
    ScrollView: makeComp('div'),
    KeyboardAvoidingView: makeComp('div'),
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Platform: { OS: 'web' },
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const makeSvg = (tag: string) => {
    const Comp = ({ children, ...props }: any) => React.createElement(tag, props, children);
    Comp.displayName = `MockSvg_${tag}`;
    return Comp;
  };
  return {
    __esModule: true,
    default: makeSvg('svg'),
    Svg: makeSvg('svg'),
    Circle: makeSvg('circle'),
    Path: makeSvg('path'),
  };
});

jest.mock('../ApplianceIcon', () => ({
  ApplianceIcon: () => null,
}));

import { PlugDiscoveryModal } from '../PlugDiscoveryModal';

describe('PlugDiscoveryModal scanning loop regression', () => {
  let dom: JSDOM;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (globalThis as any).document = dom.window.document;
    (globalThis as any).Node = dom.window.Node;
    (globalThis as any).Element = dom.window.Element;
    (globalThis as any).HTMLElement = dom.window.HTMLElement;
    container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    dom.window.close();
    jest.useRealTimers();
  });

  it('does not loop back to scanning when existingPlugs updates on telemetry ticks', () => {
    const initialPlugs: SmartPlugDevice[] = INITIAL_SMART_PLUGS.slice(0, 2);
    const onClose = jest.fn();
    const onAddPlug = jest.fn();

    act(() => {
      root.render(
        <PlugDiscoveryModal
          visible={true}
          existingPlugs={initialPlugs}
          onClose={onClose}
          onAddPlug={onAddPlug}
        />
      );
    });

    expect(container.textContent).toContain('Scanning nearby BLE & Wi-Fi smart plugs...');

    // Advance past the 1250ms simulated scan delay
    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(container.textContent).toContain('nearby devices ready to pair');
    expect(container.textContent).not.toContain('Scanning nearby BLE & Wi-Fi smart plugs...');

    // Simulate a 1-second telemetry tick creating a new existingPlugs array reference
    const tickedPlugs: SmartPlugDevice[] = initialPlugs.map((plug) => ({
      ...plug,
      powerWatts: plug.powerWatts + 5,
      accumulatedKwh: plug.accumulatedKwh + 0.01,
    }));

    act(() => {
      root.render(
        <PlugDiscoveryModal
          visible={true}
          existingPlugs={tickedPlugs}
          onClose={onClose}
          onAddPlug={onAddPlug}
        />
      );
    });

    // Must remain on candidates, never looping back to scanning
    expect(container.textContent).toContain('nearby devices ready to pair');
    expect(container.textContent).not.toContain('Scanning nearby BLE & Wi-Fi smart plugs...');
  });
});
