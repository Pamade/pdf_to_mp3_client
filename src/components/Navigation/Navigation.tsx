import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navigation.module.scss';

import { useUser } from '../../context/UserContext';

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useUser();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const content_logged_in = (
    <>
      <Link
        to="/profile"
        className={`${styles.menuItem} ${location.pathname === '/profile' ? styles.active : ''}`}
      >
        Profile
      </Link>
      <Link
        to="/pricing"
        className={`${styles.menuItem} ${location.pathname === '/pricing' ? styles.active : ''}`}
      >
        Pricing
      </Link>
      <Link
        onClick={() => logout()}
        to="/"
        className={`${styles.menuItem}`}
      >
        Logout
      </Link>
    </>
  )

  const content_logged_out = (
    <>

      <Link
        to="/pricing"
        className={`${styles.menuItem} ${location.pathname === '/pricing' ? styles.active : ''}`}
      >
        Pricing
      </Link>
      <Link
        to="/login"
        className={`${styles.menuItem} ${location.pathname === '/login' ? styles.active : ''}`}
      >
        Login
      </Link>
    </>
  )

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <svg viewBox="0 0 24 24" fill="currentColor" className={styles.logoIcon}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z" />
          </svg>
          <span>Book to AI</span>
        </Link>

        <button
          className={styles.menuButton}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={styles.menuIcon}
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8h16M4 12h16M4 16h16"
              />
            )}
          </svg>
        </button>

        <div className={`${styles.menuItems} ${isMenuOpen ? styles.open : ''}`}>
          {user ? content_logged_in : content_logged_out}
        </div>
      </div>
    </nav>
  );
}; 