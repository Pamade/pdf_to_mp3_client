import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { Toaster } from 'react-hot-toast';
import { LoginForm } from './components/auth/LoginForm/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm/RegisterForm';
import { Navigation } from './components/Navigation/Navigation';
import { Home } from './pages/Home';
import { Pricing } from './pages/Pricing';
import { Profile } from './pages/Profile';
import styles from './App.module.scss';
import './styles/index.scss';
import { Success } from './pages/Success';
import { Cancel } from './pages/Cancel';
import { ForgotPasswordForm } from './components/auth/ForgotPassword/ForgotPasswordForm';
import { ResetPassword } from './components/auth/ResetPassword/ResetPassword';
import DocumentReaderWrapper from "./pages/DocumentReaderWrapper";
function App() {

  const [downloadBarHeight, setDownloadBarHeight] = useState(0);

  useEffect(() => {
    const updatePadding = () => {
      const portal = document.getElementById('download-bar-portal');
      const firstChild = portal?.children[0] as HTMLElement;

      if (firstChild) {
        const height = firstChild.offsetHeight;
        setDownloadBarHeight(height);
      } else {
        setDownloadBarHeight(0);
      }
    };

    // Initial check
    updatePadding();

    // Watch for changes in the portal
    const observer = new MutationObserver(updatePadding);
    const resizeObserver = new ResizeObserver(updatePadding);

    const portal = document.getElementById('download-bar-portal');
    if (portal) {
      observer.observe(portal, { childList: true, subtree: true });

      // Also observe the first child if it exists
      const firstChild = portal.children[0];
      if (firstChild) {
        resizeObserver.observe(firstChild);
      }
    }

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, []);


  return (
    <Router>
      <UserProvider>
        <Routes>
          {/* Layout routes */}
          <Route
            path="/*"
            element={
              <div
                style={{
                  paddingBottom: downloadBarHeight
                    ? `${downloadBarHeight}px`
                    : "auto",
                }}
                className={styles.app}
              >
                <Toaster />
                <Navigation />
                <main className={styles.main}>
                  <Routes>
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/register" element={<RegisterForm />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/" element={<Home />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                    <Route path="/checkout/success" element={<Success />} />
                    <Route path="/checkout/cancel" element={<Cancel />} />
                  </Routes>
                </main>
              </div>
            }
          />

          {/* Standalone route without layout */}
          <Route path="/document-reader" element={<DocumentReaderWrapper />} />
        </Routes>
      </UserProvider>
    </Router>
  );
}

export default App;