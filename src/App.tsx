import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
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

function App() {
  return (
    <Router>
      <UserProvider>
        <div className={styles.app}>
          <Navigation />
          <main className={styles.main}>
            <Routes>
              <Route path="/login" element={<LoginForm />} />
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
      </UserProvider>
    </Router>
  );
}

export default App;