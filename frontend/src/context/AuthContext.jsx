import { createContext } from 'react';

// Centralized AuthContext so components and App can import the same context
// Default shape is minimal; App will provide the real values via Provider
const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {}
});

// Export the Provider as a named export for convenience
export const AuthProvider = AuthContext.Provider;

export default AuthContext;
