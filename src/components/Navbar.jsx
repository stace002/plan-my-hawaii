import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handlePlanClick = () => {
    setOpen(false);
    navigate('/plan');
  };

  const isActivePath = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="pmh-navbar">
      <div className="pmh-navbar-inner">
        <Link to="/" className="pmh-brand">
          <div className="pmh-brand-text">
            <span className="pmh-brand-title">🌺 Plan My Hawaii</span>
            <span className="pmh-brand-subtitle">Day-by-day island itineraries</span>
          </div>
        </Link>

        <nav className="pmh-nav-links" aria-label="Main">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `pmh-nav-link ${isActive || isActivePath('/') ? 'pmh-nav-link--active' : ''}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/plan"
            className={({ isActive }) =>
              `pmh-nav-link ${isActive ? 'pmh-nav-link--active' : ''}`
            }
          >
            Plan My Trip
          </NavLink>
          <NavLink
            to="/blog"
            className={({ isActive }) =>
              `pmh-nav-link ${isActive ? 'pmh-nav-link--active' : ''}`
            }
          >
            Local Blog
          </NavLink>
          <button type="button" className="pmh-nav-cta" onClick={handlePlanClick}>
            Start planning
          </button>
        </nav>

        <button
          type="button"
          className="pmh-nav-menu-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <div className="pmh-nav-menu-lines" aria-hidden="true">
            <span className="pmh-nav-menu-line" />
            <span className="pmh-nav-menu-line" />
            <span className="pmh-nav-menu-line" />
          </div>
        </button>
      </div>

      {open && (
        <div className="pmh-nav-drawer">
          <div className="pmh-nav-drawer-inner">
            <div className="pmh-nav-drawer-links">
              <Link to="/" onClick={() => setOpen(false)}>
                Home
              </Link>
              <Link to="/plan" onClick={() => setOpen(false)}>
                Plan My Trip
              </Link>
              <Link to="/blog" onClick={() => setOpen(false)}>
                Local Blog
              </Link>
              <Link to="/admin" onClick={() => setOpen(false)}>
                Admin
              </Link>
            </div>
            <button
              type="button"
              className="pmh-nav-cta pmh-nav-drawer-cta"
              onClick={handlePlanClick}
            >
              Start planning
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;

