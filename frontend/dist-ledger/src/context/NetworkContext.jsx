import { createContext } from 'react';

export const NetworkContext = createContext({
  networkStatus: {},
  loading: true
});
