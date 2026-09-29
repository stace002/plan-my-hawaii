import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MiniDirectory from '../components/MiniDirectory.jsx';
import { useTripBuilder } from '../components/TripBuilder.jsx';
import { supabase } from '../lib/supabaseClient.js';

const ISLAND_OPTIONS = ['Oahu', 'Maui', 'Big Island', 'Kauai'];
const VIBE_OPTIONS = ['Adventure', 'Relaxation', 'Culture', 'Food', 'Nature', 'Romance'];
const BUDGET_OPTIONS = [
  'Budget Explorer',
  'Comfortable Traveler',
  'Luxury Seeker',
];
const LODGING_TYPE_OPTIONS = [
  'Resort/Hotel',
  'Airbnb/VRBO',
  'Bed & Breakfast',
  'Hostel',
  'Friend/Family',
];

function islandToKey(island) {
  const map = {
    Oahu: 'oahu',
    Maui: 'maui',
    'Big Island': 'bigIsland',
    Kauai: 'kauai',
  };
  return map[island] || island.toLowerCase().replace(/\s+/g, '');
}

function formatGroupDescription(form) {
  if (form.groupType !== 'Family') {
    return form.groupType || 'not specified';
  }

  const size = Number(form.familySize);
  if (!size) {
    return 'Family';
  }

  const ages = (form.childrenAges || '')
    .split(/[,;\s]+/)
    .map((age) => age.trim())
    .filter(Boolean);

  if (!ages.length) {
    return `Family of ${size}`;
  }

  const agesText =
    ages.length === 1
      ? ages[0]
      : ages.length === 2
        ? `${ages[0]} and ${ages[1]}`
        : `${ages.slice(0, -1).join(', ')}, and ${ages[ages.length - 1]}`;

  return `Family of ${size} with children ages ${agesText}`;
}

function formatRecommendationsSection(recommendations, selectedIslands) {
  if (!recommendations?.length) return '';

  const grouped = {};
  recommendations.forEach((rec) => {
    const island = rec.island || 'Other';
    const category = rec.category || 'Other';
    if (!grouped[island]) grouped[island] = {};
    if (!grouped[island][category]) grouped[island][category] = [];
    grouped[island][category].push(rec);
  });

  const lines = [
    "PLAN MY HAWAII'S LOCAL RECOMMENDATIONS (always prioritize these when relevant):",
  ];

  const islandsToShow = selectedIslands.length
    ? ISLAND_OPTIONS.filter((island) => selectedIslands.includes(island))
    : Object.keys(grouped);

  islandsToShow.forEach((island) => {
    const categories = grouped[island];
    if (!categories) return;

    Object.entries(categories).forEach(([category, recs]) => {
      lines.push(`${island} - ${category}:`);
      recs.forEach((rec) => {
        const details = [rec.my_note, rec.google_maps_url].filter(Boolean).join(' ');
        lines.push(`- ${rec.name}: ${details}`.trim());
      });
    });
  });

  return lines.length > 1 ? lines.join('\n') : '';
}

const TRIP_SELECTIONS_KEY = 'pmh_trip_selections';
const TRIP_ITEMS_KEY = 'pmh_trip_items';
const GENERATE_ITINERARY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-itinerary`;

function extractItineraryText(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload.trim();
  if (typeof payload !== 'object') return '';

  const candidate =
    payload.result ||
    payload.itinerary ||
    payload.text ||
    payload.content ||
    payload.message ||
    payload.output ||
    payload.delta;

  if (typeof candidate === 'string') return candidate.trim();
  if (Array.isArray(candidate)) {
    return candidate
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim();
  }
  if (candidate && typeof candidate === 'object') {
    return extractItineraryText(candidate);
  }
  if (payload.data) return extractItineraryText(payload.data);
  return '';
}

async function requestGeneratedItinerary(prompt) {
  console.log('Calling edge function...');
  const response = await fetch(GENERATE_ITINERARY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    let message = 'Could not generate itinerary. Please try again.';
    try {
      const errBody = await response.json();
      console.log('Edge function response:', errBody);
      console.log('Result field:', errBody.result);
      message = errBody.error || errBody.message || message;
    } catch {
      // Keep the default message.
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let itinerary = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      events.forEach((event) => {
        const dataLine = event
          .split('\n')
          .find((line) => line.startsWith('data:'));
        if (!dataLine) return;
        const data = dataLine.replace(/^data:\s?/, '').trim();
        if (!data || data === '[DONE]') return;
        try {
          itinerary += extractItineraryText(JSON.parse(data));
        } catch {
          itinerary += data;
        }
      });
    }

    return itinerary.trim();
  }

  const raw = await response.text();
  try {
    const data = JSON.parse(raw);
    console.log('Edge function response:', data);
    console.log('Result field:', data.result);
    const extracted = extractItineraryText(data);
    if (extracted) return extracted;
    throw new Error(
      data.error ||
        'The itinerary generator did not return any text. Please try again.',
    );
  } catch (err) {
    if (err instanceof SyntaxError) return raw.trim();
    throw err;
  }
}

function clearTripItems() {
  try {
    localStorage.removeItem(TRIP_ITEMS_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

function readTripSelections(locationState) {
  const fromState = locationState?.tripSelections;
  if (Array.isArray(fromState) && fromState.length > 0) {
    return fromState;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(TRIP_SELECTIONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatSavedPlacesSection(places) {
  if (!places?.length) return '';

  const lines = [
    "TRAVELER'S SAVED PLACES (incorporate these into the itinerary where they fit logically):",
  ];

  places.forEach((place) => {
    lines.push(
      `- ${place.name || 'Unknown place'} (${place.island || 'unknown island'}) — ${place.category || 'Uncategorized'} — ${place.my_note || ''}`,
    );
  });

  return lines.join('\n');
}

function QuizPage() {
  const location = useLocation();
  const { tripItems, clearTrip } = useTripBuilder();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [itineraryText, setItineraryText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showTweak, setShowTweak] = useState(false);
  const [tweakFeedback, setTweakFeedback] = useState('');
  const [showSend, setShowSend] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [showMiniDirectory, setShowMiniDirectory] = useState(false);
  const [miniAddedCount, setMiniAddedCount] = useState(0);

  const [form, setForm] = useState({
    arrivalDate: '',
    departureDate: '',
    groupType: '',
    familySize: '',
    childrenAges: '',
    islands: [],
    lodgingBooked: '',
    lodgingType: '',
    lodgingLocation: '',
    islandDays: {},
    vibes: [],
    budget: '',
    dietary: '',
    mobility: '',
    mustDo: '',
    notes: '',
  });

  useEffect(() => {
    document.title = 'Plan My Trip – Plan My Hawaii';
  }, []);

  useEffect(() => {
    clearTripItems();
    clearTrip();
  }, []);

  useEffect(() => {
    const selections = readTripSelections(location.state);
    setSavedPlaces(selections);
    try {
      localStorage.removeItem(TRIP_SELECTIONS_KEY);
    } catch {
      // Ignore storage access failures.
    }
  }, [location.state]);

  const visibleSteps = useMemo(() => {
    const steps = [1, 2, 3];
    if (form.islands.length > 1) steps.push(4);
    steps.push(5, 6, 7, 8);
    return steps;
  }, [form.islands.length]);

  const hasMultipleIslands = form.islands.length > 1;
  const totalSteps = visibleSteps.length;
  const currentStepIndex = visibleSteps.indexOf(step);
  const displayStep = currentStepIndex === -1 ? 1 : currentStepIndex + 1;
  const isLastStep = step === visibleSteps[visibleSteps.length - 1];

  useEffect(() => {
    if (step === 4 && !hasMultipleIslands) {
      setStep(5);
    }
  }, [step, hasMultipleIslands]);

  const tripTotalDays = useMemo(() => {
    if (!form.arrivalDate || !form.departureDate) return 7;
    return Math.round(
      (new Date(form.departureDate) - new Date(form.arrivalDate)) / 86400000,
    );
  }, [form.arrivalDate, form.departureDate]);

  const progress = useMemo(() => {
    const index = visibleSteps.indexOf(step);
    if (index === -1) return 0;

    let currentStepCredit = 1;
    if (step === 5) {
      if (form.lodgingBooked === 'still-looking') {
        currentStepCredit = 1;
      } else if (
        form.lodgingBooked === 'yes' &&
        form.lodgingType &&
        form.lodgingLocation
      ) {
        currentStepCredit = 1;
      } else if (form.lodgingBooked === 'yes') {
        currentStepCredit = 0.5;
      } else {
        currentStepCredit = 0;
      }
    }

    return Math.round(((index + currentStepCredit) / totalSteps) * 100);
  }, [
    visibleSteps,
    step,
    totalSteps,
    form.lodgingBooked,
    form.lodgingType,
    form.lodgingLocation,
  ]);

  const getNextStep = (current) => {
    const index = visibleSteps.indexOf(current);
    if (index === -1 || index >= visibleSteps.length - 1) return current;
    return visibleSteps[index + 1];
  };

  const getPrevStep = (current) => {
    const index = visibleSteps.indexOf(current);
    if (index <= 0) return visibleSteps[0];
    return visibleSteps[index - 1];
  };

  const handleToggleMulti = (key, value) => {
    setForm((prev) => {
      const values = prev[key] || [];
      let nextValues;
      let nextIslandDays = { ...prev.islandDays };

      if (values.includes(value)) {
        nextValues = values.filter((v) => v !== value);
        if (key === 'islands') {
          delete nextIslandDays[islandToKey(value)];
        }
      } else {
        nextValues = [...values, value];
        if (key === 'islands') {
          const islandKey = islandToKey(value);
          nextIslandDays[islandKey] = nextIslandDays[islandKey] || 1;
        }
      }

      return { ...prev, [key]: nextValues, islandDays: nextIslandDays };
    });
  };

  const handleIslandDaysChange = (islandKey, rawValue) => {
    if (rawValue === '') {
      setForm((prev) => ({
        ...prev,
        islandDays: { ...prev.islandDays, [islandKey]: '' },
      }));
      return;
    }

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;

    setForm((prev) => ({
      ...prev,
      islandDays: {
        ...prev.islandDays,
        [islandKey]: Math.min(7, Math.max(1, parsed)),
      },
    }));
  };

  const handleIslandDaysBlur = (islandKey) => {
    setForm((prev) => {
      const current = prev.islandDays[islandKey];
      if (current === '' || current === undefined || current === null) {
        return {
          ...prev,
          islandDays: { ...prev.islandDays, [islandKey]: 1 },
        };
      }

      const parsed = parseInt(String(current), 10);
      const days = Number.isNaN(parsed) ? 1 : Math.min(7, Math.max(1, parsed));
      return {
        ...prev,
        islandDays: { ...prev.islandDays, [islandKey]: days },
      };
    });
  };

  const nextStep = () => {
    if (step === 1 && form.arrivalDate && form.departureDate) {
      const diff = Math.round(
        (new Date(form.departureDate) - new Date(form.arrivalDate)) / 86400000
      );
      if (diff > 7) {
        alert("We plan up to 7 days at a time! Please adjust your dates or come back for the next leg of your trip. 🌺");
        return;
      }
      if (diff <= 0) {
        alert("Your departure date needs to be after your arrival date!");
        return;
      }
    }
    if (currentStepIndex < visibleSteps.length - 1) setStep((s) => getNextStep(s));
  };

  const prevStep = () => {
    if (step > 1) setStep((s) => getPrevStep(s));
  };

  const parseItinerary = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const days = [];
    let current = null;

    lines.forEach((line) => {
      const dayMatch = line.match(/^(?:#{1,3}\s*|\*\*)?(day\s*\d+)\b(.*)$/i);
      if (dayMatch) {
        if (current) days.push(current);
        current = {
          title: dayMatch[0].replace(/[:\-]\s*$/i, ''),
          items: [],
        };
      } else if (current) {
        current.items.push(line.replace(/^[\-\u2022]\s*/, ''));
      }
    });
    if (current) days.push(current);
    if (!days.length) {
      return [
        {
          title: 'Your itinerary',
          items: lines,
        },
      ];
    }
    return days;
  };

  const itineraryDays = useMemo(
    () => (itineraryText ? parseItinerary(itineraryText) : []),
    [itineraryText],
  );

  const buildPrompt = async (feedback) => {
    let recommendationsSection = '';
    if (form.islands.length > 0) {
      const { data, error: recError } = await supabase
        .from('recommendations')
        .select('name, island, category, my_note, google_maps_url')
        .eq('active', true)
        .in('island', form.islands)
        .order('island', { ascending: true })
        .order('category', { ascending: true });

      if (recError) {
        console.log('Recommendations fetch error:', recError);
      } else {
        recommendationsSection = formatRecommendationsSection(data ?? [], form.islands);
      }
    }

    const placesById = new Map();
    savedPlaces.forEach((place) => {
      if (place?.id != null) placesById.set(place.id, place);
    });
    tripItems.forEach((place) => {
      if (place?.id != null) placesById.set(place.id, place);
    });
    const savedPlacesSection = formatSavedPlacesSection(
      Array.from(placesById.values()),
    );

    return `
You are a knowledgeable local friend helping plan a Hawaii trip.

Please create a warm, specific, opinionated, day-by-day itinerary that feels like it was written by someone who actually lives on the islands. Write in a warm, friendly tone — like a well-traveled friend who knows the islands really well. Casual but not overly local slang. Helpful and specific without being a tour brochure. Include hidden gems, honest takes on what to skip, realistic driving times, and a good balance of activity and rest. 
Always prioritize locally owned businesses, restaurants, and tours over chains and corporate operators. Never recommend Applebee's, Outback, or any mainland chain that happens to be in Hawaii. If a local option exists, that's the only option worth mentioning. When recommending tours, always choose small local operators over large bus tour companies.
${recommendationsSection ? `\n${recommendationsSection}\n` : ''}
${savedPlacesSection ? `\n${savedPlacesSection}\n` : ''}
Plan a maximum of 7 days. If the trip is longer than 7 days, plan the first 7 days only and end with a friendly note that says "For the rest of your trip, come back to Plan My Hawaii and we'll plan the next leg for you! 🌺"

Trip details:
- Arrival date: ${form.arrivalDate || 'not specified'}
- Departure date: ${form.departureDate || 'not specified'}
- Group: ${formatGroupDescription(form)}
- Islands: ${(form.islands || []).join(', ') || 'not specified'}
- Accommodation booked: ${form.lodgingBooked === 'yes' ? 'Yes' : form.lodgingBooked === 'still-looking' ? 'Still looking' : 'not specified'}
- Lodging type: ${form.lodgingType || 'not specified'}
- Lodging location: ${form.lodgingLocation || 'not specified'}
${form.islands.length > 1 ? `- Island day split: ${form.islands.map((island) => `${island}: ${form.islandDays[islandToKey(island)] || 1} days`).join(', ')} (total trip: ${tripTotalDays} days)` : ''}
- Travel vibe: ${(form.vibes || []).join(', ') || 'not specified'}
- Budget level: ${form.budget || 'not specified'}
- Dietary notes: ${form.dietary || 'none'}
- Mobility / pacing notes: ${form.mobility || 'none'}
- Must-do items: ${form.mustDo || 'none'}
- Extra notes: ${form.notes || 'none'}
${feedback ? `\nTRAVELER FEEDBACK ON THE CURRENT ITINERARY:\n${feedback}\n\nCURRENT ITINERARY:\n${itineraryText}\n\nRewrite the full itinerary incorporating that feedback. Keep the same warm, day-by-day structure.\n` : ''}

Write this like a friendly local texting a friend. Organize the response clearly by day (e.g. "Day 1 – Settle in + golden hour on the beach") with short bullet points for morning / afternoon / evening. Keep each day realistic, not overstuffed.
`;
  };

  const generateItinerary = async (feedback) => {
    setError(null);
    setSubmitting(true);
    setIsEditing(false);
    setShowTweak(false);
    setShowSend(false);

    try {
      const prompt = await buildPrompt(feedback);
      const text = await requestGeneratedItinerary(prompt);
      if (!text) {
        throw new Error('The itinerary came back empty. Please try again.');
      }
      setItineraryText(text);
      setSent(false);
    } catch (err) {
      setError(err.message || 'Could not generate itinerary. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    await generateItinerary('');
  };

  const handleTweak = async (event) => {
    event.preventDefault();
    const feedback = tweakFeedback.trim();
    if (!feedback) return;
    setTweakFeedback('');
    await generateItinerary(feedback);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const email = sendEmail.trim();
    if (!email) {
      setError('Please enter an email address.');
      return;
    }

    setSending(true);
    setError(null);

    const { error: insertError } = await supabase.from('itineraries').insert({
      email,
      status: 'pending',
      itinerary: itineraryText,
      trip_details: form,
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSent(true);
    setShowSend(false);
  };

  const showQuiz = !submitting && !itineraryText;
  const showPreview = !submitting && Boolean(itineraryText);

  return (
    <div className="pmh-quiz-layout">
      {(showQuiz || submitting) && (
      <div className="pmh-quiz-header">
        <h1 className="pmh-quiz-title">Let&apos;s plan your Hawaii trip</h1>
        <p className="pmh-quiz-subtitle">
          Seven quick questions. We&apos;ll turn your answers into a realistic, local-feel
          itinerary.
        </p>
        {showQuiz && savedPlaces.length > 0 && (
          <div className="pmh-quiz-saved-banner" role="status">
            🌺 We found {savedPlaces.length}{' '}
            {savedPlaces.length === 1 ? 'place' : 'places'} you saved! Complete the
            quiz and we&apos;ll build your itinerary around them.
          </div>
        )}
      </div>
      )}

      {showQuiz && (
        <>
      <div className="pmh-progress-track">
        <div
          className="pmh-progress-fill"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="pmh-step-label" aria-hidden="true">
        <span>
          Step {displayStep} of {totalSteps}
        </span>
        <span>{progress}%</span>
      </div>

        <section className="pmh-quiz-card" aria-live="polite">
          {step === 1 && (
            <>
              <div className="pmh-quiz-question">When are you traveling?</div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="arrival">Arrival date</label>
                  <input
                    id="arrival"
                    type="date"
                    className="pmh-input"
                    value={form.arrivalDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, arrivalDate: e.target.value }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="departure">Departure date</label>
                  <input
                    id="departure"
                    type="date"
                    className="pmh-input"
                    value={form.departureDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, departureDate: e.target.value }))
                    }
                    />
                    </div>
                    <p style={{
                      fontFamily: 'sans-serif',
                      fontSize: 13,
                      color: '#4a7a65',
                      marginTop: '0.75rem',
                      fontStyle: 'italic',
                    }}>
                      We plan up to 7 days at a time — for longer trips just come back for the next leg! 🌺
                    </p>
                  </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="pmh-quiz-question">Who&apos;s this trip for?</div>
              <div className="pmh-radio-row">
                {['Solo', 'Couple', 'Family', 'Friends'].map((option) => (
                  <label key={option} className="pmh-radio-pill">
                    <input
                      type="radio"
                      name="groupType"
                      value={option}
                      checked={form.groupType === option}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          groupType: e.target.value,
                          familySize: e.target.value === 'Family' ? prev.familySize : '',
                          childrenAges:
                            e.target.value === 'Family' ? prev.childrenAges : '',
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>

              {form.groupType === 'Family' && (
                <div className="pmh-field-grid" style={{ marginTop: '1.25rem' }}>
                  <div className="pmh-field">
                    <label htmlFor="family-size">How many people total?</label>
                    <input
                      id="family-size"
                      type="number"
                      className="pmh-input"
                      value={form.familySize}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, familySize: e.target.value }))
                      }
                    />
                  </div>
                  <div className="pmh-field">
                    <label htmlFor="children-ages">Ages of children?</label>
                    <input
                      id="children-ages"
                      type="text"
                      className="pmh-input"
                      placeholder="e.g. 4, 7, 12 — helps us suggest kid-friendly activities"
                      value={form.childrenAges}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, childrenAges: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="pmh-quiz-question">Which island(s) are you visiting?</div>
              <div className="pmh-multi-toggle">
                {ISLAND_OPTIONS.map((island) => (
                  <button
                    key={island}
                    type="button"
                    className={`pmh-toggle-pill ${
                      form.islands.includes(island) ? 'pmh-toggle-pill--active' : ''
                    }`}
                    onClick={() => handleToggleMulti('islands', island)}
                  >
                    {island}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && hasMultipleIslands && (
            <>
              <div className="pmh-quiz-question">How do you want to split your time?</div>
              <p
                className="pmh-quiz-subtitle"
                style={{ marginTop: '-0.25rem', marginBottom: '1.25rem' }}
              >
                We&apos;ll plan each island separately so nothing feels rushed
              </p>
              <p
                style={{
                  fontSize: '0.88rem',
                  color: '#4a7a65',
                  marginBottom: '1rem',
                  fontStyle: 'italic',
                }}
              >
                Your trip is {tripTotalDays} days total
              </p>
              <div className="pmh-field-grid">
                {form.islands.map((island) => {
                  const islandKey = islandToKey(island);
                  const daysValue = form.islandDays[islandKey];
                  return (
                    <div className="pmh-field" key={island}>
                      <label htmlFor={`island-days-${islandKey}`}>{island}</label>
                      <input
                        id={`island-days-${islandKey}`}
                        type="number"
                        min={1}
                        max={7}
                        className="pmh-input"
                        value={daysValue === '' ? '' : (daysValue ?? 1)}
                        onChange={(e) =>
                          handleIslandDaysChange(islandKey, e.target.value)
                        }
                        onBlur={() => handleIslandDaysBlur(islandKey)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="pmh-quiz-question">Where are you staying?</div>
              <p
                className="pmh-quiz-subtitle"
                style={{ marginTop: '-0.25rem', marginBottom: '1.25rem' }}
              >
                This helps us plan around your home base
              </p>

              <div
                className="pmh-quiz-question"
                style={{ fontSize: '0.98rem', marginBottom: '0.85rem' }}
              >
                Have you booked accommodation yet?
              </div>
              <div className="pmh-multi-toggle">
                <button
                  type="button"
                  className={`pmh-toggle-pill ${
                    form.lodgingBooked === 'yes' ? 'pmh-toggle-pill--active' : ''
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      lodgingBooked: 'yes',
                    }))
                  }
                >
                  Yes, I&apos;m all set
                </button>
                <button
                  type="button"
                  className={`pmh-toggle-pill ${
                    form.lodgingBooked === 'still-looking'
                      ? 'pmh-toggle-pill--active'
                      : ''
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      lodgingBooked: 'still-looking',
                      lodgingType: '',
                      lodgingLocation: '',
                    }))
                  }
                >
                  Still looking
                </button>
              </div>

              {form.lodgingBooked === 'yes' && (
                <div className="pmh-field-grid" style={{ marginTop: '1.25rem' }}>
                  <div className="pmh-field">
                    <label htmlFor="lodging-type">Accommodation type</label>
                    <select
                      id="lodging-type"
                      className="pmh-input"
                      value={form.lodgingType}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, lodgingType: e.target.value }))
                      }
                    >
                      <option value="">Select a type</option>
                      {LODGING_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pmh-field">
                    <label htmlFor="lodging-location">
                      Where are you staying? (city, neighborhood, or property name)
                    </label>
                    <input
                      id="lodging-location"
                      type="text"
                      className="pmh-input"
                      placeholder="e.g. Waikiki, North Shore, Andaz Maui"
                      value={form.lodgingLocation}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          lodgingLocation: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {form.lodgingBooked === 'still-looking' && (
                <p
                  style={{
                    marginTop: '1.25rem',
                    fontSize: '0.95rem',
                    color: '#4a7a65',
                    lineHeight: 1.65,
                  }}
                >
                  No worries! We&apos;ll plan a balanced itinerary and you can always come
                  back once you&apos;ve booked. 🌺
                </p>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <div className="pmh-quiz-question">What&apos;s the vibe of this trip?</div>
              <div className="pmh-multi-toggle">
                {VIBE_OPTIONS.map((vibe) => (
                  <button
                    key={vibe}
                    type="button"
                    className={`pmh-toggle-pill ${
                      form.vibes.includes(vibe) ? 'pmh-toggle-pill--active' : ''
                    }`}
                    onClick={() => handleToggleMulti('vibes', vibe)}
                  >
                    {vibe}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <div className="pmh-quiz-question">How do you like to spend?</div>
              <div className="pmh-radio-row">
                {BUDGET_OPTIONS.map((option) => (
                  <label key={option} className="pmh-radio-pill">
                    <input
                      type="radio"
                      name="budget"
                      value={option}
                      checked={form.budget === option}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, budget: e.target.value }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 8 && (
            <>
              <div className="pmh-quiz-question">Anything we should keep in mind?</div>
              <div className="pmh-field-grid">
                <div className="pmh-field">
                  <label htmlFor="dietary">Dietary notes (optional)</label>
                  <textarea
                    id="dietary"
                    className="pmh-textarea"
                    value={form.dietary}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dietary: e.target.value }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="mobility">
                    Mobility / pace (stairs, long walks, kids naps, etc) – optional
                  </label>
                  <textarea
                    id="mobility"
                    className="pmh-textarea"
                    value={form.mobility}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, mobility: e.target.value }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="mustdo">Must-do items (optional)</label>
                  <textarea
                    id="mustdo"
                    className="pmh-textarea"
                    value={form.mustDo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, mustDo: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="pmh-button-outline pmh-quiz-browse-btn"
                    onClick={() => setShowMiniDirectory(true)}
                  >
                    🌺 Browse local businesses for inspiration
                  </button>
                  {miniAddedCount > 0 && (
                    <p className="pmh-quiz-mini-confirm" role="status">
                      ✓ {miniAddedCount}{' '}
                      {miniAddedCount === 1 ? 'place' : 'places'} added to your trip
                    </p>
                  )}
                </div>
                <div className="pmh-field">
                  <label htmlFor="notes">Anything else we should know? (optional)</label>
                  <textarea
                    id="notes"
                    className="pmh-textarea"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="pmh-auth-error" role="alert">
              {error}
            </div>
          )}

          <div className="pmh-quiz-footer">
            <div className="pmh-quiz-footer-left">
              We&apos;ll never store your personal details — just the preferences for this
              itinerary.
            </div>
            <div className="pmh-quiz-footer-buttons">
              {currentStepIndex > 0 && (
                <button type="button" className="pmh-button-ghost" onClick={prevStep}>
                  Back
                </button>
              )}
              {!isLastStep && (
                <button type="button" className="pmh-button-primary" onClick={nextStep}>
                  Next
                </button>
              )}
              {isLastStep && (
                <button
                  type="button"
                  className="pmh-button-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Generating…' : 'Generate my itinerary'}
                </button>
              )}
            </div>
          </div>
        </section>
        </>
      )}

      {submitting && (
        <div className="pmh-loading-screen" role="status">
          <div className="pmh-loading-hibiscus" aria-hidden="true">
            🌺
          </div>
          <h2>Building your Hawaii itinerary...</h2>
          <p>We&apos;re writing this like a local friend would. Hang tight.</p>
        </div>
      )}

      {showPreview && (
        <section className="pmh-itinerary-preview" aria-live="polite">
          <header className="pmh-itinerary-preview-header">
            <h2>🌺 Your Hawaii Itinerary</h2>
          </header>

          {isEditing ? (
            <textarea
              className="pmh-textarea pmh-itinerary-edit"
              value={itineraryText}
              onChange={(e) => setItineraryText(e.target.value)}
              aria-label="Edit itinerary"
            />
          ) : (
            <div className="pmh-itinerary-days">
              {itineraryDays.map((day) => (
                <article key={day.title} className="pmh-day-card">
                  <h3>{day.title}</h3>
                  {day.items.length > 0 && (
                    <ul>
                      {day.items.map((item, index) => (
                        <li key={`${day.title}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="pmh-itinerary-actions">
            <button
              type="button"
              className="pmh-button-outline"
              onClick={() => {
                setIsEditing((prev) => !prev);
                setShowTweak(false);
                setShowSend(false);
              }}
            >
              {isEditing ? 'Done editing' : '✏️ Edit This'}
            </button>
            <button
              type="button"
              className="pmh-button-outline"
              onClick={() => {
                setShowTweak((prev) => !prev);
                setIsEditing(false);
                setShowSend(false);
              }}
            >
              🔄 Tweak This
            </button>
            <button
              type="button"
              className="pmh-button-primary"
              onClick={() => {
                setShowSend((prev) => !prev);
                setIsEditing(false);
                setShowTweak(false);
              }}
            >
              📧 Send to My Inbox
            </button>
          </div>

          {showTweak && (
            <form className="pmh-itinerary-panel" onSubmit={handleTweak}>
              <label htmlFor="tweak-feedback">What should we change?</label>
              <input
                id="tweak-feedback"
                className="pmh-input"
                value={tweakFeedback}
                onChange={(e) => setTweakFeedback(e.target.value)}
                placeholder="add more beach time"
              />
              <button type="submit" className="pmh-button-primary" disabled={!tweakFeedback.trim()}>
                Regenerate
              </button>
            </form>
          )}

          {showSend && !sent && (
            <form className="pmh-itinerary-panel" onSubmit={handleSend}>
              <label htmlFor="send-email">Where should we send this?</label>
              <div className="pmh-itinerary-send-row">
                <input
                  id="send-email"
                  type="email"
                  className="pmh-input"
                  placeholder="your@email.com"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  required
                />
                <button type="submit" className="pmh-button-primary" disabled={sending}>
                  {sending ? 'Sending…' : 'Send 🌺'}
                </button>
              </div>
            </form>
          )}

          {sent && (
            <p className="pmh-itinerary-sent" role="status">
              Check your inbox! Your itinerary is on its way 🌺
            </p>
          )}

          {error && (
            <div className="pmh-auth-error" role="alert">
              {error}
            </div>
          )}
        </section>
      )}

      <MiniDirectory
        isOpen={showMiniDirectory}
        onClose={() => {
          setShowMiniDirectory(false);
          setSavedPlaces(tripItems);
          setMiniAddedCount(tripItems.length);
        }}
        selectedIslands={form.islands}
      />
    </div>
  );
}

export default QuizPage;

