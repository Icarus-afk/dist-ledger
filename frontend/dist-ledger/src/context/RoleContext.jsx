import { createContext } from 'react';

export const RoleContext = createContext({
  currentRole: 'distributor',
  setCurrentRole: () => {}
});
