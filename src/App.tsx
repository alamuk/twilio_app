import { BrowserRouter } from 'react-router-dom';
import { DialerProvider } from './context/DialerContext';
import { AuthProvider } from './context/AuthContext';
import AppShell from './routes/AppRoute';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <DialerProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </DialerProvider>
    </AuthProvider>
  );
}
