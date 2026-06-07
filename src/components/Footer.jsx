import { Link } from 'react-router-dom';

const BLOG_CATEGORIES = [
  'Restaurants & Food',
  'Beaches',
  'Hikes & Trails',
  'Ocean & Water',
  'Hidden Gems',
  'Where to Stay',
  'Getting Around',
];

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="pmh-footer">
      <div className="pmh-footer-inner">
        <div>
          <div className="pmh-footer-brand-title">🌺 Plan My Hawaii</div>
          <p className="pmh-footer-brand-body">
            Thoughtful, local-feeling itineraries for Oahu, Maui, Big Island, and
            Kauai. Less time doomscrolling, more time in the water.
          </p>
        </div>

        <div>
          <div className="pmh-footer-heading">Pages</div>
          <div className="pmh-footer-links">
            <Link className="pmh-footer-link" to="/">
              Home
            </Link>
            <Link className="pmh-footer-link" to="/plan">
              Plan My Trip
            </Link>
            <Link className="pmh-footer-link" to="/blog">
              Local Blog
            </Link>
            <Link className="pmh-footer-link" to="/admin">
              Admin
            </Link>
          </div>
        </div>

        <div>
          <div className="pmh-footer-heading">Blog categories</div>
          <div className="pmh-footer-links">
            {BLOG_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                className="pmh-footer-link"
                to={`/blog?category=${encodeURIComponent(cat)}`}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="pmh-footer-bottom">
        <span>© {year} Plan My Hawaii</span>
        <span>Made with aloha 🤙</span>
      </div>
    </footer>
  );
}

export default Footer;

