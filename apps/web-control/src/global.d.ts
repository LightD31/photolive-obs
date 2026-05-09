// React 19 dropped the global JSX namespace; re-export from React.JSX so existing
// `JSX.Element` annotations keep working without rewriting every component.
import type { JSX as ReactJSX } from 'react';

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }

  // Surface exposed by apps/desktop/src/preload.ts via contextBridge.
  // Present only when the page is running inside the Electron host;
  // absent in a plain browser (including the OBS browser source).
  interface PhotoliveBootstrap {
    token: string;
    dataDir: string;
    resolvedDataDirSource: 'override' | 'next-to-exe' | 'userData' | 'dev';
    serverUrl: string;
  }

  interface PhotoliveWindow {
    isElectron: true;
    bootstrap: PhotoliveBootstrap | null;
    app: {
      relaunch: () => Promise<void>;
      revealDataDir: () => Promise<void>;
      openLogs: () => Promise<void>;
      pickFolder: (current?: string) => Promise<string | null>;
    };
  }

  interface Window {
    photolive?: PhotoliveWindow;
  }
}
