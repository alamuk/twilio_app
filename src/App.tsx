import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import ServerCallPage from "./pages/ServerCallPage";
import WebCallPage from "./pages/WebCallPage";
import { DialerProvider } from "./context/DialerContext";
import "./App.css";
import TestPage from "./pages/TestPage";

export default function App() {
  return (
    <DialerProvider>
      <BrowserRouter>
        <div className="page">
          <header className="header">
            <h1 className="title">📞 Talentpull Dialer</h1>
            <small className="subtitle">Talenpull UK Ltd</small>
          </header>

          <nav className="tabs">
            <NavLink to="/web-call" className={({isActive}) => isActive ? "tab active" : "tab"}>
              Hello Web Call
            </NavLink>
            <NavLink to="/make-call" className={({isActive}) => isActive ? "tab active" : "tab"}>
              Make a Call
            </NavLink>
          </nav>

          <Routes>
            <Route path="/" element={<Navigate to="/web-call" replace />} />
            <Route path="/web-call" element={<WebCallPage />} />
            <Route path="/make-call" element={<ServerCallPage />} />
             <Route path="/test" element={<TestPage />} />
            <Route path="*" element={<Navigate to="/web-call" replace />} />
          </Routes>

          <footer className="footer">
           @ talentpull.uk
            <br />
            2025 Talentpull.uk Ltd
            <br />
          </footer>
        </div>
      </BrowserRouter>
    </DialerProvider>
  );
}
