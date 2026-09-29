import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useTripBuilder } from './TripBuilder.jsx';

const ISLAND_ORDER = ['Oahu', 'Maui', 'Big Island', 'Kauai'];

const CATEGORY_EMOJI = {
  'Restaurants & Food': '🍽️',
  Beaches: '🏖️',
  'Hikes & Trails': '🥾',
  'Ocean & Water': '🌊',
  Experiences: '🎭',
  'Hidden Gems': '💎',
  'Where to Stay': '🏡',
  'Getting Around': '🚗',
};

function firstPhoto(photos) {
  if (Array.isArray(photos)) {
    return photos.map((url) => String(url).trim()).find(Boolean) || '';
  }
  if (typeof photos === 'string' && photos.trim()) {
    return (
      photos
        .split(',')
        .map((url) => url.trim())
        .find(Boolean) || ''
    );
  }
  return '';
}

function islandsForTabs(selectedIslands) {
  const selected = (selectedIslands || []).filter((island) =>
    ISLAND_ORDER.includes(island),
  );
  return selected.length
    ? ISLAND_ORDER.filter((island) => selected.includes(island))
    : ISLAND_ORDER;
}

function MiniDirectory({ isOpen, onClose, selectedIslands }) {
  const { tripItems, addToTrip, isInTrip, removeFromTrip } = useTripBuilder();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const tabIslands = useMemo(
    () => islandsForTabs(selectedIslands),
    [selectedIslands],
  );
  const showTabs = tabIslands.length > 1;
  const [activeIsland, setActiveIsland] = useState(tabIslands[0] || 'Oahu');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!tabIslands.includes(activeIsland)) {
      setActiveIsland(tabIslands[0] || 'Oahu');
    }
  }, [tabIslands, activeIsland]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('recommendations')
        .select(
          'id, name, island, category, description, neighborhood, photos, my_note, featured, priority, active',
        )
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('priority', { ascending: false })
        .order('name', { ascending: true });

      if (cancelled) return;

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
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const visibleListings = useMemo(
    () => listings.filter((listing) => listing.island === activeIsland),
    [listings, activeIsland],
  );

  if (!isOpen) return null;

  const overlay = (
    <div
      className="pmh-mini-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pmh-mini-title"
    >
      <button
        type="button"
        className="pmh-mini-close"
        onClick={onClose}
        aria-label="Close directory"
      >
        ×
      </button>
      <div className="pmh-mini-shell">
        <header className="pmh-mini-header">
          <div className="pmh-mini-header-copy">
            <h2 id="pmh-mini-title" className="pmh-mini-title">
              Find Your Must-Do Experiences 🌺
            </h2>
            <p className="pmh-mini-subtitle">
              Browse and add anything that catches your eye
            </p>
          </div>
        </header>

        {showTabs && (
          <div className="pmh-mini-tabs" role="tablist" aria-label="Islands">
            {tabIslands.map((island) => (
              <button
                key={island}
                type="button"
                role="tab"
                aria-selected={activeIsland === island}
                className={`pmh-mini-tab${
                  activeIsland === island ? ' pmh-mini-tab--active' : ''
                }`}
                onClick={() => setActiveIsland(island)}
              >
                {island}
              </button>
            ))}
          </div>
        )}

        <div className="pmh-mini-body">
          {loading && <p className="pmh-mini-status">Loading local picks…</p>}
          {error && (
            <p className="pmh-mini-status pmh-mini-status--error" role="alert">
              Couldn&apos;t load listings. {error}
            </p>
          )}
          {!loading && !error && visibleListings.length === 0 && (
            <p className="pmh-mini-status">
              No listings yet for {activeIsland}. Try another island, or keep going
              with the quiz.
            </p>
          )}
          {!loading && !error && visibleListings.length > 0 && (
            <ul className="pmh-mini-list">
              {visibleListings.map((listing) => {
                const photo = firstPhoto(listing.photos);
                const added = isInTrip(listing.id);

                return (
                  <li key={listing.id} className="pmh-mini-card">
                    <div className="pmh-mini-photo" aria-hidden="true">
                      {photo ? (
                        <img src={photo} alt="" />
                      ) : (
                        <span className="pmh-mini-photo-placeholder">🌺</span>
                      )}
                    </div>
                    <div className="pmh-mini-card-copy">
                      <div className="pmh-mini-card-title-row">
                        <span className="pmh-mini-emoji" aria-hidden="true">
                          {CATEGORY_EMOJI[listing.category] || '🌺'}
                        </span>
                        <h3 className="pmh-mini-card-name">{listing.name}</h3>
                      </div>
                      {listing.neighborhood && (
                        <p className="pmh-mini-neighborhood">
                          {listing.neighborhood}
                        </p>
                      )}
                      {listing.description && (
                        <p className="pmh-mini-description">{listing.description}</p>
                      )}
                    </div>
                    {added ? (
                      <button
                        type="button"
                        className="pmh-mini-add pmh-mini-add--added"
                        onClick={() => removeFromTrip(listing.id)}
                      >
                        ✓ Added
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pmh-mini-add"
                        onClick={() => addToTrip(listing)}
                      >
                        + Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pmh-mini-footer">
          <button
            type="button"
            className="pmh-button-primary pmh-mini-done"
            onClick={onClose}
          >
            {tripItems.length}{' '}
            {tripItems.length === 1 ? 'place' : 'places'} added — Done, back to my
            quiz →
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default MiniDirectory;
