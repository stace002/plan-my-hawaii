import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const ISLANDS = ['Oahu', 'Maui', 'Big Island', 'Kauai'];

const CATEGORIES = [
  'Restaurants & Food',
  'Beaches',
  'Hikes & Trails',
  'Ocean & Water',
  'Experiences',
  'Hidden Gems',
  'Where to Stay',
  'Getting Around',
];

const VIBE_OPTIONS = [
  'Adventure',
  'Relaxation',
  'Culture',
  'Food',
  'Nature',
  'Romance',
];

const BUDGET_LEVELS = ['Budget', 'Mid-Range', 'Luxury'];

const EMPTY_FILTERS = {
  island: '',
  category: '',
  vibes: [],
  kidFriendly: false,
  rainyDay: false,
  budget: '',
  pmhApproved: false,
};

function asVibes(vibes) {
  return Array.isArray(vibes) ? vibes.filter(Boolean) : [];
}

function firstPhoto(photos) {
  if (Array.isArray(photos)) {
    return photos.map((url) => String(url).trim()).find(Boolean) || '';
  }
  if (typeof photos === 'string' && photos.trim()) {
    return photos
      .split(',')
      .map((url) => url.trim())
      .find(Boolean) || '';
  }
  return '';
}

function listingHref(listing) {
  return listing.affiliate_url || listing.website_url || '';
}

function DirectoryPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    document.title = 'Local Directory – Plan My Hawaii';
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
        return el;
      })();
    meta.content =
      'Hand-picked places, experiences and hidden gems — curated by Plan My Hawaii.';
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('recommendations')
        .select(
          'id, name, island, category, description, my_note, neighborhood, photos, pmh_approved, featured, rainy_day, kid_friendly, budget_level, vibes, website_url, affiliate_url, google_maps_url, priority, active',
        )
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('priority', { ascending: false })
        .order('name', { ascending: true });

      if (!isMounted) return;

      if (err) {
        setError(err.message);
        setListings([]);
      } else {
        setListings(data ?? []);
      }
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const results = useMemo(() => {
    return listings.filter((listing) => {
      if (filters.island && listing.island !== filters.island) return false;
      if (filters.category && listing.category !== filters.category) return false;
      if (filters.budget && listing.budget_level !== filters.budget) return false;
      if (filters.kidFriendly && !listing.kid_friendly) return false;
      if (filters.rainyDay && !listing.rainy_day) return false;
      if (filters.pmhApproved && !listing.pmh_approved) return false;
      if (filters.vibes.length > 0) {
        const listingVibes = asVibes(listing.vibes);
        const matchesVibe = filters.vibes.some((vibe) => listingVibes.includes(vibe));
        if (!matchesVibe) return false;
      }
      return true;
    });
  }, [listings, filters]);

  const handleToggleVibe = (vibe) => {
    setFilters((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(vibe)
        ? prev.vibes.filter((item) => item !== vibe)
        : [...prev.vibes, vibe],
    }));
  };

  const hasActiveFilters =
    Boolean(filters.island) ||
    Boolean(filters.category) ||
    Boolean(filters.budget) ||
    filters.kidFriendly ||
    filters.rainyDay ||
    filters.pmhApproved ||
    filters.vibes.length > 0;

  return (
    <div className="pmh-container">
      <header className="pmh-directory-hero">
        <div className="pmh-pill">
          <span className="pmh-pill-dot" />
          Curated local picks
        </div>
        <h1 className="pmh-hero-title">Local Directory</h1>
        <p className="pmh-hero-body">
          Hand-picked places, experiences and hidden gems — curated by Plan My Hawaii
        </p>
      </header>

      <section className="pmh-directory-filters" aria-label="Directory filters">
        <div className="pmh-directory-filters-row">
          <div className="pmh-field">
            <label htmlFor="directory-island">Island</label>
            <select
              id="directory-island"
              className="pmh-input"
              value={filters.island}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, island: e.target.value }))
              }
            >
              <option value="">All Islands</option>
              {ISLANDS.map((island) => (
                <option key={island} value={island}>
                  {island}
                </option>
              ))}
            </select>
          </div>
          <div className="pmh-field">
            <label htmlFor="directory-category">Category</label>
            <select
              id="directory-category"
              className="pmh-input"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="pmh-field">
            <label htmlFor="directory-budget">Budget</label>
            <select
              id="directory-budget"
              className="pmh-input"
              value={filters.budget}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, budget: e.target.value }))
              }
            >
              <option value="">All</option>
              {BUDGET_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pmh-field">
          <label>Vibe</label>
          <div className="pmh-multi-toggle">
            {VIBE_OPTIONS.map((vibe) => (
              <button
                key={vibe}
                type="button"
                className={`pmh-toggle-pill ${
                  filters.vibes.includes(vibe) ? 'pmh-toggle-pill--active' : ''
                }`}
                onClick={() => handleToggleVibe(vibe)}
                aria-pressed={filters.vibes.includes(vibe)}
              >
                {vibe}
              </button>
            ))}
          </div>
        </div>

        <div className="pmh-directory-toggles">
          <button
            type="button"
            className={`pmh-filter-pill ${
              filters.kidFriendly ? 'pmh-filter-pill--active' : ''
            }`}
            onClick={() =>
              setFilters((prev) => ({ ...prev, kidFriendly: !prev.kidFriendly }))
            }
            aria-pressed={filters.kidFriendly}
          >
            👨‍👩‍👧‍👦 Kid Friendly
          </button>
          <button
            type="button"
            className={`pmh-filter-pill ${
              filters.rainyDay ? 'pmh-filter-pill--active' : ''
            }`}
            onClick={() =>
              setFilters((prev) => ({ ...prev, rainyDay: !prev.rainyDay }))
            }
            aria-pressed={filters.rainyDay}
          >
            ☔ Rainy Day
          </button>
          <button
            type="button"
            className={`pmh-filter-pill ${
              filters.pmhApproved ? 'pmh-filter-pill--active' : ''
            }`}
            onClick={() =>
              setFilters((prev) => ({ ...prev, pmhApproved: !prev.pmhApproved }))
            }
            aria-pressed={filters.pmhApproved}
          >
            PMH Approved
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="pmh-button-ghost"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {loading && <p className="pmh-empty-state">Loading local picks…</p>}
      {error && !loading && (
        <p className="pmh-empty-state">
          Couldn&apos;t load the directory just now. Try refreshing.
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="pmh-directory-count">
            Showing {results.length} {results.length === 1 ? 'place' : 'places'}
          </p>

          {results.length === 0 && (
            <div className="pmh-directory-empty">
              <p className="pmh-empty-state" style={{ marginTop: 0 }}>
                No places match these filters. Try another island, category, or vibe —
                or clear the filters to see everything.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="pmh-button-outline"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <section className="pmh-directory-grid" aria-label="Directory listings">
              {results.map((listing) => {
                const photo = firstPhoto(listing.photos);
                const website = listingHref(listing);
                const vibes = asVibes(listing.vibes);
                const locationBits = [listing.neighborhood, listing.island].filter(
                  Boolean,
                );

                return (
                  <article key={listing.id} className="pmh-directory-card">
                    <div className="pmh-directory-card-image">
                      {photo ? (
                        <img src={photo} alt={listing.name} />
                      ) : (
                        <div className="pmh-directory-placeholder" aria-hidden="true">
                          🌺
                        </div>
                      )}
                      <div className="pmh-directory-badges">
                        {listing.pmh_approved && (
                          <span className="pmh-directory-badge pmh-directory-badge--approved">
                            PMH Approved
                          </span>
                        )}
                        {listing.featured && (
                          <span className="pmh-directory-badge pmh-directory-badge--featured">
                            Featured
                          </span>
                        )}
                        {listing.rainy_day && (
                          <span className="pmh-directory-badge">☔ Rainy Day</span>
                        )}
                        {listing.kid_friendly && (
                          <span className="pmh-directory-badge">👨‍👩‍👧‍👦 Kid Friendly</span>
                        )}
                      </div>
                    </div>

                    <div className="pmh-directory-card-body">
                      {listing.category && (
                        <span className="pmh-card-pill">
                          <span>●</span>
                          {listing.category}
                        </span>
                      )}
                      <h2 className="pmh-directory-card-title">{listing.name}</h2>
                      {locationBits.length > 0 && (
                        <p className="pmh-directory-location">
                          {locationBits.join(' · ')}
                        </p>
                      )}
                      {listing.description && (
                        <p className="pmh-directory-description">{listing.description}</p>
                      )}
                      {listing.my_note && (
                        <p className="pmh-directory-note">🌺 {listing.my_note}</p>
                      )}
                      {listing.budget_level && (
                        <p className="pmh-directory-budget">{listing.budget_level}</p>
                      )}
                      {vibes.length > 0 && (
                        <div className="pmh-directory-vibes">
                          {vibes.map((vibe) => (
                            <span key={vibe} className="pmh-chip">
                              {vibe}
                            </span>
                          ))}
                        </div>
                      )}
                      {(website || listing.google_maps_url) && (
                        <div className="pmh-directory-card-actions">
                          {website && (
                            <a
                              className="pmh-button-primary pmh-directory-link-btn"
                              href={website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Website
                            </a>
                          )}
                          {listing.google_maps_url && (
                            <a
                              className="pmh-button-outline pmh-directory-link-btn"
                              href={listing.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Google Maps
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default DirectoryPage;
