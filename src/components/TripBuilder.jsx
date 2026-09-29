import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'pmh_trip_items';
const EMPTY_TRIP = [];

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

let tripItems = loadTripItems();
const listeners = new Set();

function loadTripItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function emitTripChange(next) {
  tripItems = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tripItems));
  } catch {
    // Ignore quota / private-mode write failures.
  }
  listeners.forEach((listener) => listener());
}

function subscribeTrip(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getTripSnapshot() {
  return tripItems;
}

function getServerSnapshot() {
  return EMPTY_TRIP;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    tripItems = loadTripItems();
    listeners.forEach((listener) => listener());
  });
}

function toTripItem(listing) {
  return {
    id: listing.id,
    name: listing.name,
    island: listing.island || '',
    category: listing.category || '',
    my_note: listing.my_note || '',
  };
}

export function useTripBuilder() {
  const items = useSyncExternalStore(
    subscribeTrip,
    getTripSnapshot,
    getServerSnapshot,
  );

  const addToTrip = (listing) => {
    if (!listing?.id) return;
    if (tripItems.some((item) => item.id === listing.id)) return;
    emitTripChange([...tripItems, toTripItem(listing)]);
  };

  const removeFromTrip = (id) => {
    emitTripChange(tripItems.filter((item) => item.id !== id));
  };

  const clearTrip = () => {
    emitTripChange([]);
  };

  const isInTrip = (id) => tripItems.some((item) => item.id === id);

  return {
    tripItems: items,
    addToTrip,
    removeFromTrip,
    clearTrip,
    isInTrip,
  };
}

function TripBuilder() {
  const { tripItems: items, removeFromTrip } = useTripBuilder();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handlePlanTrip = () => {
    try {
      localStorage.setItem('pmh_trip_selections', JSON.stringify(items));
    } catch {
      // Ignore quota / private-mode write failures.
    }
    navigate('/plan', {
      state: { tripSelections: items, fromDirectory: true },
    });
  };

  return (
    <div className="pmh-trip-builder">
      {open && (
        <section
          id="pmh-trip-panel"
          className="pmh-trip-panel"
          aria-label="My trip"
          aria-live="polite"
        >
          <div className="pmh-trip-panel-header">
            <h2 className="pmh-trip-panel-title">🌺 My Trip</h2>
            <span className="pmh-trip-panel-count">
              {items.length} {items.length === 1 ? 'place' : 'places'}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="pmh-trip-empty">
              Your trip is empty — browse the directory to add places!
            </p>
          ) : (
            <ul className="pmh-trip-list">
              {items.map((item) => (
                <li key={item.id} className="pmh-trip-item">
                  <span className="pmh-trip-item-emoji" aria-hidden="true">
                    {CATEGORY_EMOJI[item.category] || '🌺'}
                  </span>
                  <div className="pmh-trip-item-copy">
                    <div className="pmh-trip-item-name">{item.name}</div>
                    <div className="pmh-trip-item-meta">{item.island}</div>
                  </div>
                  <button
                    type="button"
                    className="pmh-trip-remove"
                    onClick={() => removeFromTrip(item.id)}
                    aria-label={`Remove ${item.name} from trip`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="pmh-button-primary pmh-trip-plan-btn"
            onClick={handlePlanTrip}
          >
            Plan My Trip →
          </button>
        </section>
      )}

      <button
        type="button"
        className="pmh-trip-fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="pmh-trip-panel"
      >
        🌺 My Trip ({items.length})
      </button>
    </div>
  );
}

export default TripBuilder;
