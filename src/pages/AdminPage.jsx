import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const CATEGORIES = [
  'Restaurants & Food',
  'Beaches',
  'Hikes & Trails',
  'Ocean & Water',
  'Hidden Gems',
  'Where to Stay',
  'Getting Around',
];

const RECOMMENDATION_CATEGORIES = [
  'Restaurants & Food',
  'Beaches',
  'Hikes & Trails',
  'Ocean & Water',
  'Experiences',
  'Hidden Gems',
  'Where to Stay',
  'Getting Around',
];

const ISLANDS = ['Oahu', 'Maui', 'Big Island', 'Kauai'];

const AFFILIATE_NETWORKS = [
  'Viator',
  'Booking.com',
  'GetYourGuide',
  'Direct Partnership',
  'Other',
];

const BUDGET_LEVELS = ['Budget', 'Mid-Range', 'Luxury'];

const VIBE_OPTIONS = [
  'Adventure',
  'Relaxation',
  'Culture',
  'Food',
  'Nature',
  'Romance',
];

const RECOMMENDATION_SELECT =
  'id, name, island, category, my_note, google_maps_url, priority, active, description, website_url, affiliate_url, affiliate_network, commission_rate, phone, neighborhood, kid_friendly, budget_level, vibes, photos, featured, pmh_approved';

const EMPTY_RECOMMENDATION_FORM = {
  name: '',
  island: '',
  category: '',
  my_note: '',
  google_maps_url: '',
  priority: 1,
  active: true,
  description: '',
  website_url: '',
  affiliate_url: '',
  affiliate_network: '',
  commission_rate: '',
  phone: '',
  neighborhood: '',
  kid_friendly: false,
  budget_level: '',
  vibes: [],
  photos: '',
  featured: false,
  pmh_approved: false,
};

function trimToNull(value) {
  const trimmed = (value ?? '').toString().trim();
  return trimmed || null;
}

function formatPhotosInput(photos) {
  if (!photos) return '';
  if (Array.isArray(photos)) return photos.filter(Boolean).join(', ');
  return String(photos);
}

function parsePhotosInput(value) {
  if (!value || !String(value).trim()) return [];
  return String(value)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function normalizeVibes(vibes) {
  if (!Array.isArray(vibes)) return [];
  return vibes.filter((vibe) => VIBE_OPTIONS.includes(vibe));
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', 'yes', '1'].includes(value.toLowerCase().trim());
  }
  return Boolean(value);
}

function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return null;
      }
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function AdminPage() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const [pendingItineraries, setPendingItineraries] = useState([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(false);
  const [itinerariesError, setItinerariesError] = useState(null);
  const [editedTexts, setEditedTexts] = useState({});
  const [approvingId, setApprovingId] = useState(null);
  const [deletingItineraryId, setDeletingItineraryId] = useState(null);

  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(null);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [editingRecommendationId, setEditingRecommendationId] = useState(null);
  const [recommendationForm, setRecommendationForm] = useState(EMPTY_RECOMMENDATION_FORM);
  const [savingRecommendation, setSavingRecommendation] = useState(false);
  const [deletingRecommendationId, setDeletingRecommendationId] = useState(null);
  const [autofillLoading, setAutofillLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    category: '',
    cover_image_url: '',
    excerpt: '',
    body: '',
    published: false,
  });

  useEffect(() => {
    document.title = 'Admin – Plan My Hawaii';
  }, []);

  useEffect(() => {
    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setSessionChecked(true);
    }

    getSession();
  }, []);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadPosts() {
      setPostsLoading(true);
      setPostsError(null);
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id, title, slug, category, cover_image_url, excerpt, body, published, published_at',
        )
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setPostsError(error.message);
      } else {
        setPosts(data ?? []);
      }
      setPostsLoading(false);
    }

    loadPosts();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadPendingItineraries() {
      setItinerariesLoading(true);
      setItinerariesError(null);

      const { data, error } = await supabase
        .from('itineraries')
        .select('id, email, created_at, itinerary, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setItinerariesError(error.message);
        setPendingItineraries([]);
        setEditedTexts({});
      } else {
        const rows = data ?? [];
        setPendingItineraries(rows);
        setEditedTexts(
          Object.fromEntries(
            rows.map((row) => [row.id, row.itinerary || '']),
          ),
        );
      }
      setItinerariesLoading(false);
    }

    loadPendingItineraries();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadRecommendations() {
      setRecommendationsLoading(true);
      setRecommendationsError(null);

      const { data, error } = await supabase
        .from('recommendations')
        .select(RECOMMENDATION_SELECT)
        .order('island', { ascending: true })
        .order('category', { ascending: true });

      if (!isMounted) return;

      if (error) {
        setRecommendationsError(error.message);
        setRecommendations([]);
      } else {
        setRecommendations(data ?? []);
      }
      setRecommendationsLoading(false);
    }

    loadRecommendations();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const recommendationsByIsland = useMemo(() => {
    const grouped = Object.fromEntries(ISLANDS.map((island) => [island, []]));
    recommendations.forEach((rec) => {
      if (grouped[rec.island]) {
        grouped[rec.island].push(rec);
      } else if (rec.island) {
        grouped[rec.island] = [rec];
      }
    });
    return grouped;
  }, [recommendations]);

  const isEditingRecommendation = useMemo(
    () => Boolean(editingRecommendationId),
    [editingRecommendationId],
  );

  const isEditingExisting = useMemo(() => Boolean(editingId), [editingId]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      slug: '',
      category: '',
      cover_image_url: '',
      excerpt: '',
      body: '',
      published: false,
    });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setUser(data.user ?? null);
    }

    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    resetForm();
    setPosts([]);
    setPendingItineraries([]);
    setEditedTexts({});
    setRecommendations([]);
    resetRecommendationForm();
  };

  const resetRecommendationForm = () => {
    setEditingRecommendationId(null);
    setRecommendationForm(EMPTY_RECOMMENDATION_FORM);
    setShowRecommendationForm(false);
    setAutofillLoading(false);
  };

  const reloadRecommendations = async () => {
    const { data, error } = await supabase
      .from('recommendations')
      .select(RECOMMENDATION_SELECT)
      .order('island', { ascending: true })
      .order('category', { ascending: true });

    if (error) {
      setRecommendationsError(error.message);
    } else {
      setRecommendations(data ?? []);
    }
  };

  const handleAddRecommendation = () => {
    setEditingRecommendationId(null);
    setRecommendationForm(EMPTY_RECOMMENDATION_FORM);
    setShowRecommendationForm(true);
  };

  const handleEditRecommendation = (rec) => {
    setEditingRecommendationId(rec.id);
    setRecommendationForm({
      name: rec.name || '',
      island: rec.island || '',
      category: rec.category || '',
      my_note: rec.my_note || '',
      google_maps_url: rec.google_maps_url || '',
      priority: rec.priority ?? 1,
      active: !!rec.active,
      description: rec.description || '',
      website_url: rec.website_url || '',
      affiliate_url: rec.affiliate_url || '',
      affiliate_network: rec.affiliate_network || '',
      commission_rate:
        rec.commission_rate === null || rec.commission_rate === undefined
          ? ''
          : rec.commission_rate,
      phone: rec.phone || '',
      neighborhood: rec.neighborhood || '',
      kid_friendly: !!rec.kid_friendly,
      budget_level: rec.budget_level || '',
      vibes: normalizeVibes(rec.vibes),
      photos: formatPhotosInput(rec.photos),
      featured: !!rec.featured,
      pmh_approved: !!rec.pmh_approved,
    });
    setShowRecommendationForm(true);
  };

  const handleSaveRecommendation = async (e) => {
    e.preventDefault();
    setSavingRecommendation(true);

    const payload = {
      name: recommendationForm.name.trim(),
      island: recommendationForm.island || null,
      category: recommendationForm.category || null,
      my_note: trimToNull(recommendationForm.my_note),
      google_maps_url: trimToNull(recommendationForm.google_maps_url),
      priority: Number(recommendationForm.priority) || 1,
      active: recommendationForm.active,
      description: trimToNull(recommendationForm.description),
      website_url: trimToNull(recommendationForm.website_url),
      affiliate_url: trimToNull(recommendationForm.affiliate_url),
      affiliate_network: recommendationForm.affiliate_network || null,
      commission_rate:
        recommendationForm.commission_rate === '' ||
        recommendationForm.commission_rate === null
          ? null
          : Number(recommendationForm.commission_rate),
      phone: trimToNull(recommendationForm.phone),
      neighborhood: trimToNull(recommendationForm.neighborhood),
      kid_friendly: recommendationForm.kid_friendly,
      budget_level: recommendationForm.budget_level || null,
      vibes: normalizeVibes(recommendationForm.vibes),
      photos: parsePhotosInput(recommendationForm.photos),
      featured: recommendationForm.featured,
      pmh_approved: recommendationForm.pmh_approved,
    };

    const { error } = editingRecommendationId
      ? await supabase
          .from('recommendations')
          .update(payload)
          .eq('id', editingRecommendationId)
      : await supabase.from('recommendations').insert(payload);

    if (error) {
      // eslint-disable-next-line no-alert
      alert(`Error saving recommendation: ${error.message}`);
    } else {
      resetRecommendationForm();
      await reloadRecommendations();
    }

    setSavingRecommendation(false);
  };

  const handleToggleVibe = (vibe) => {
    setRecommendationForm((prev) => {
      const selected = prev.vibes.includes(vibe)
        ? prev.vibes.filter((item) => item !== vibe)
        : [...prev.vibes, vibe];
      return { ...prev, vibes: selected };
    });
  };

  const handleAutofillRecommendation = async () => {
    const name = recommendationForm.name.trim();
    const { island, category } = recommendationForm;

    if (!name || !island || !category) {
      // eslint-disable-next-line no-alert
      alert('Enter a name, island, and category before auto-filling.');
      return;
    }

    setAutofillLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token =
        session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/autofill-recommendation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, island, category }),
        },
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Auto-fill failed. Please try again.');
      }

      let parsed = payload;
      if (payload.data) parsed = payload.data;
      if (typeof parsed === 'string') parsed = extractJson(parsed);
      if (parsed?.content?.[0]?.text) parsed = extractJson(parsed.content[0].text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Could not read AI response. Please try again.');
      }

      const budgetLevel = BUDGET_LEVELS.includes(parsed.budget_level)
        ? parsed.budget_level
        : '';

      setRecommendationForm((prev) => ({
        ...prev,
        description:
          parsed.description != null ? String(parsed.description) : prev.description,
        neighborhood:
          parsed.neighborhood != null
            ? String(parsed.neighborhood)
            : prev.neighborhood,
        kid_friendly: toBool(parsed.kid_friendly),
        budget_level: budgetLevel || prev.budget_level,
        vibes: normalizeVibes(parsed.vibes),
        website_url:
          parsed.website_url != null ? String(parsed.website_url) : prev.website_url,
        my_note:
          parsed.my_note ||
          parsed.personal_note ||
          parsed.recommendation_note ||
          prev.my_note,
      }));
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Auto-fill failed: ${err.message}`);
    } finally {
      setAutofillLoading(false);
    }
  };

  const handleDeleteRecommendation = async (id) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      'Delete this recommendation? This cannot be undone.',
    );
    if (!confirmed) return;

    setDeletingRecommendationId(id);
    const { error } = await supabase.from('recommendations').delete().eq('id', id);
    if (error) {
      // eslint-disable-next-line no-alert
      alert(`Error deleting recommendation: ${error.message}`);
    } else {
      setRecommendations((prev) => prev.filter((rec) => rec.id !== id));
      if (editingRecommendationId === id) {
        resetRecommendationForm();
      }
    }
    setDeletingRecommendationId(null);
  };

  const handleSelectPost = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      category: post.category || '',
      cover_image_url: post.cover_image_url || '',
      excerpt: post.excerpt || '',
      body: post.body || '',
      published: !!post.published,
    });
  };

  const handleTitleChange = (value) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: editingId ? prev.slug : slugify(value),
    }));
  };

  const handleSlugBlur = () => {
    setForm((prev) => ({ ...prev, slug: slugify(prev.slug || prev.title) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      slug: slugify(form.slug || form.title),
      category: form.category || null,
      cover_image_url: form.cover_image_url || null,
      excerpt: form.excerpt || null,
      body: form.body || null,
      published: form.published,
    };

    let error = null;

    if (editingId) {
      const { error: err } = await supabase
        .from('posts')
        .update(payload)
        .eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('posts').insert(payload);
      error = err;
    }

    if (error) {
      // eslint-disable-next-line no-alert
      alert(`Error saving post: ${error.message}`);
    } else {
      resetForm();
      setEditingId(null);
      const { data, error: reloadError } = await supabase
        .from('posts')
        .select(
          'id, title, slug, category, cover_image_url, excerpt, body, published, published_at',
        )
        .order('published_at', { ascending: false })
        .order('inserted_at', { ascending: false });
      if (reloadError) {
        setPostsError(reloadError.message);
      } else {
        setPosts(data ?? []);
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
    if (!confirmed) return;

    setDeleteLoadingId(id);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) {
      // eslint-disable-next-line no-alert
      alert(`Error deleting post: ${error.message}`);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) {
        resetForm();
      }
    }
    setDeleteLoadingId(null);
  };

  const handleItineraryTextChange = (id, value) => {
    setEditedTexts((prev) => ({ ...prev, [id]: value }));
  };

  const handleApproveItinerary = async (itinerary) => {
    const itineraryText = editedTexts[itinerary.id] ?? itinerary.itinerary ?? '';

    setApprovingId(itinerary.id);
    try {
      const { error: updateError } = await supabase
        .from('itineraries')
        .update({ status: 'approved', itinerary: itineraryText })
        .eq('id', itinerary.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const sendRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send_itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: itinerary.email, itinerary: itinerary.itinerary }),
      });

      if (!sendRes.ok) {
        throw new Error('Failed to send itinerary email.');
      }

      setPendingItineraries((prev) => prev.filter((row) => row.id !== itinerary.id));
      setEditedTexts((prev) => {
        const next = { ...prev };
        delete next[itinerary.id];
        return next;
      });
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Error approving itinerary: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteItinerary = async (id) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      'Delete this pending itinerary? This cannot be undone.',
    );
    if (!confirmed) return;

    setDeletingItineraryId(id);
    const { error } = await supabase.from('itineraries').delete().eq('id', id);
    if (error) {
      // eslint-disable-next-line no-alert
      alert(`Error deleting itinerary: ${error.message}`);
    } else {
      setPendingItineraries((prev) => prev.filter((row) => row.id !== id));
      setEditedTexts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setDeletingItineraryId(null);
  };

  if (!sessionChecked) {
    return (
      <div className="pmh-container">
        <p className="pmh-empty-state">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pmh-container">
        <section className="pmh-auth-card">
          <h1 className="pmh-auth-title">Admin sign in</h1>
          <p className="pmh-auth-subtitle">
            Use your Supabase email and password to manage Plan My Hawaii blog posts.
          </p>
          <form onSubmit={handleAuthSubmit}>
            <div className="pmh-field">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                type="email"
                className="pmh-input"
                autoComplete="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="pmh-field" style={{ marginTop: '0.9rem' }}>
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                className="pmh-input"
                autoComplete="current-password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
            {authError && (
              <div className="pmh-auth-error" role="alert">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="pmh-button-primary"
              style={{ marginTop: '1.1rem', width: '100%' }}
              disabled={authLoading}
            >
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="pmh-container">
      <header className="pmh-blog-header">
        <h1 className="pmh-blog-title">Admin – Posts</h1>
        <p className="pmh-blog-subtitle">
          Create and edit blog posts that power the local notes throughout Plan My
          Hawaii.
        </p>
        <button
          type="button"
          className="pmh-button-outline"
          onClick={handleLogout}
          style={{ marginTop: '0.8rem' }}
        >
          Sign out
        </button>
      </header>

      <div className="pmh-admin-layout">
        <section className="pmh-post-list" aria-label="Posts list">
          {postsLoading && <p className="pmh-empty-state">Loading posts…</p>}
          {postsError && !postsLoading && (
            <p className="pmh-empty-state">
              Couldn&apos;t load posts: {postsError}. Try refreshing.
            </p>
          )}
          {!postsLoading && !postsError && posts.length === 0 && (
            <p className="pmh-empty-state" style={{ padding: '0.75rem 0.9rem' }}>
              No posts yet. Create your first post using the editor.
            </p>
          )}
          {!postsLoading &&
            !postsError &&
            posts.map((post) => (
              <div key={post.id} className="pmh-post-list-item">
                <div className="pmh-post-list-title">{post.title}</div>
                <div className="pmh-post-list-meta">
                  <span>{post.slug}</span>
                  <span>{post.category || 'Uncategorized'}</span>
                  <span>
                    {post.published ? (
                      <span className="pmh-badge-green">
                        <span>●</span>Published
                      </span>
                    ) : (
                      'Draft'
                    )}
                  </span>
                </div>
                <div className="pmh-post-list-actions">
                  <button
                    type="button"
                    className="pmh-button-ghost"
                    onClick={() => handleSelectPost(post)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pmh-button-ghost"
                    onClick={() => handleDelete(post.id)}
                    disabled={deleteLoadingId === post.id}
                  >
                    {deleteLoadingId === post.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
        </section>

        <section className="pmh-form-card" aria-label="Post editor">
          <h2 style={{ marginTop: 0, marginBottom: '0.4rem' }}>
            {isEditingExisting ? 'Edit post' : 'New post'}
          </h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: '1rem',
              fontSize: '0.85rem',
              color: '#64748b',
            }}
          >
            Title, slug, category, and excerpt are used throughout the site — including
            the landing page and category filters.
          </p>
          <form className="pmh-form-grid" onSubmit={handleSave}>
            <div className="pmh-field">
              <label htmlFor="post-title">Title</label>
              <input
                id="post-title"
                className="pmh-input"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </div>
            <div className="pmh-field">
              <label htmlFor="post-slug">Slug</label>
              <input
                id="post-slug"
                className="pmh-input"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                onBlur={handleSlugBlur}
              />
            </div>
            <div className="pmh-field">
              <label htmlFor="post-category">Category</label>
              <select
                id="post-category"
                className="pmh-input"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="pmh-field">
              <label htmlFor="post-cover">Cover image URL</label>
              <input
                id="post-cover"
                className="pmh-input"
                value={form.cover_image_url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cover_image_url: e.target.value }))
                }
              />
            </div>
            <div className="pmh-field">
              <label htmlFor="post-excerpt">Excerpt</label>
              <textarea
                id="post-excerpt"
                className="pmh-textarea"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, excerpt: e.target.value }))
                }
              />
            </div>
            <div className="pmh-field">
              <label htmlFor="post-body">Body</label>
              <textarea
                id="post-body"
                className="pmh-textarea"
                style={{ minHeight: 200 }}
                value={form.body}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, body: e.target.value }))
                }
              />
            </div>
            <div className="pmh-switch-row">
              <label htmlFor="post-published">Published</label>
              <input
                id="post-published"
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, published: e.target.checked }))
                }
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.6rem',
              }}
            >
              <button
                type="button"
                className="pmh-button-ghost"
                onClick={resetForm}
                disabled={saving}
              >
                Clear
              </button>
              <button
                type="submit"
                className="pmh-button-primary"
                disabled={saving}
              >
                {saving
                  ? 'Saving…'
                  : isEditingExisting
                  ? 'Save changes'
                  : 'Create post'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="pmh-recommendations-section" aria-label="My recommendations">
        <div className="pmh-recommendations-header">
          <div>
            <h2 className="pmh-section-title">My Recommendations</h2>
            <p className="pmh-section-subtitle">
              Your personal picks power the AI itinerary — the spots you actually send
              friends to.
            </p>
          </div>
          <button
            type="button"
            className="pmh-button-primary"
            onClick={handleAddRecommendation}
          >
            Add New Recommendation
          </button>
        </div>

        {showRecommendationForm && (
          <section className="pmh-form-card pmh-recommendation-form" aria-label="Recommendation editor">
            <h3 style={{ marginTop: 0, marginBottom: '0.4rem' }}>
              {isEditingRecommendation ? 'Edit recommendation' : 'New recommendation'}
            </h3>
            <form className="pmh-form-grid" onSubmit={handleSaveRecommendation}>
              <div className="pmh-field">
                <label htmlFor="rec-name">Name</label>
                <div className="pmh-field-with-action">
                  <input
                    id="rec-name"
                    className="pmh-input"
                    value={recommendationForm.name}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="pmh-button-outline pmh-button-autofill"
                    onClick={handleAutofillRecommendation}
                    disabled={autofillLoading || savingRecommendation}
                  >
                    {autofillLoading ? (
                      <>
                        <span className="pmh-spinner" aria-hidden="true" />
                        Generating…
                      </>
                    ) : (
                      'Auto-fill with AI'
                    )}
                  </button>
                </div>
                <p className="pmh-field-hint">
                  Enter name, island, and category first, then auto-fill the rest.
                </p>
              </div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="rec-island">Island</label>
                  <select
                    id="rec-island"
                    className="pmh-input"
                    value={recommendationForm.island}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({ ...prev, island: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select an island</option>
                    {ISLANDS.map((island) => (
                      <option key={island} value={island}>
                        {island}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pmh-field">
                  <label htmlFor="rec-category">Category</label>
                  <select
                    id="rec-category"
                    className="pmh-input"
                    value={recommendationForm.category}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select a category</option>
                    {RECOMMENDATION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pmh-field">
                <label htmlFor="rec-description">Description</label>
                <textarea
                  id="rec-description"
                  className="pmh-textarea"
                  placeholder="A short description of this spot"
                  value={recommendationForm.description}
                  onChange={(e) =>
                    setRecommendationForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="pmh-field">
                <label htmlFor="rec-note">My Note</label>
                <textarea
                  id="rec-note"
                  className="pmh-textarea"
                  placeholder="Your personal take on this spot"
                  value={recommendationForm.my_note}
                  onChange={(e) =>
                    setRecommendationForm((prev) => ({ ...prev, my_note: e.target.value }))
                  }
                />
              </div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="rec-website">Website URL</label>
                  <input
                    id="rec-website"
                    type="text"
                    className="pmh-input"
                    value={recommendationForm.website_url}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        website_url: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="rec-maps">Google Maps URL</label>
                  <input
                    id="rec-maps"
                    type="url"
                    className="pmh-input"
                    value={recommendationForm.google_maps_url}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        google_maps_url: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="rec-affiliate-url">Affiliate URL</label>
                  <input
                    id="rec-affiliate-url"
                    type="text"
                    className="pmh-input"
                    value={recommendationForm.affiliate_url}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        affiliate_url: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="rec-affiliate-network">Affiliate network</label>
                  <select
                    id="rec-affiliate-network"
                    className="pmh-input"
                    value={recommendationForm.affiliate_network}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        affiliate_network: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select a network</option>
                    {AFFILIATE_NETWORKS.map((network) => (
                      <option key={network} value={network}>
                        {network}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="rec-commission">Commission rate</label>
                  <input
                    id="rec-commission"
                    type="number"
                    min={0}
                    step="0.01"
                    className="pmh-input"
                    value={recommendationForm.commission_rate}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        commission_rate:
                          e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="rec-phone">Phone</label>
                  <input
                    id="rec-phone"
                    type="tel"
                    className="pmh-input"
                    value={recommendationForm.phone}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="pmh-field-grid pmh-field-grid--two">
                <div className="pmh-field">
                  <label htmlFor="rec-neighborhood">Neighborhood</label>
                  <input
                    id="rec-neighborhood"
                    className="pmh-input"
                    value={recommendationForm.neighborhood}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        neighborhood: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="pmh-field">
                  <label htmlFor="rec-budget">Budget level</label>
                  <select
                    id="rec-budget"
                    className="pmh-input"
                    value={recommendationForm.budget_level}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        budget_level: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select a budget level</option>
                    {BUDGET_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <fieldset className="pmh-field pmh-checkbox-fieldset">
                <legend>Vibes</legend>
                <div className="pmh-checkbox-group">
                  {VIBE_OPTIONS.map((vibe) => (
                    <label key={vibe} className="pmh-checkbox-item">
                      <input
                        type="checkbox"
                        checked={recommendationForm.vibes.includes(vibe)}
                        onChange={() => handleToggleVibe(vibe)}
                      />
                      <span>{vibe}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="pmh-field">
                <label htmlFor="rec-photos">Photos</label>
                <input
                  id="rec-photos"
                  className="pmh-input"
                  placeholder="https://..., https://..."
                  value={recommendationForm.photos}
                  onChange={(e) =>
                    setRecommendationForm((prev) => ({
                      ...prev,
                      photos: e.target.value,
                    }))
                  }
                />
                <p className="pmh-field-hint">Comma-separated image URLs</p>
              </div>
              <div className="pmh-field">
                <label htmlFor="rec-priority">Priority</label>
                <input
                  id="rec-priority"
                  type="number"
                  min={1}
                  className="pmh-input"
                  value={recommendationForm.priority}
                  onChange={(e) =>
                    setRecommendationForm((prev) => ({
                      ...prev,
                      priority: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                />
                <p className="pmh-field-hint">Higher number = mentioned more often</p>
              </div>
              <div className="pmh-switch-stack">
                <div className="pmh-switch-row">
                  <label htmlFor="rec-kid-friendly">Kid friendly</label>
                  <input
                    id="rec-kid-friendly"
                    type="checkbox"
                    checked={recommendationForm.kid_friendly}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        kid_friendly: e.target.checked,
                      }))
                    }
                  />
                </div>
                <div className="pmh-switch-row">
                  <label htmlFor="rec-featured">Featured</label>
                  <input
                    id="rec-featured"
                    type="checkbox"
                    checked={recommendationForm.featured}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        featured: e.target.checked,
                      }))
                    }
                  />
                </div>
                <div className="pmh-switch-row">
                  <label htmlFor="rec-pmh-approved">PMH approved</label>
                  <input
                    id="rec-pmh-approved"
                    type="checkbox"
                    checked={recommendationForm.pmh_approved}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        pmh_approved: e.target.checked,
                      }))
                    }
                  />
                </div>
                <div className="pmh-switch-row">
                  <label htmlFor="rec-active">Active</label>
                  <input
                    id="rec-active"
                    type="checkbox"
                    checked={recommendationForm.active}
                    onChange={(e) =>
                      setRecommendationForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="pmh-recommendation-form-actions">
                <button
                  type="button"
                  className="pmh-button-ghost"
                  onClick={resetRecommendationForm}
                  disabled={savingRecommendation || autofillLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pmh-button-primary"
                  disabled={savingRecommendation || autofillLoading}
                >
                  {savingRecommendation
                    ? 'Saving…'
                    : isEditingRecommendation
                      ? 'Save changes'
                      : 'Add recommendation'}
                </button>
              </div>
            </form>
          </section>
        )}

        {recommendationsLoading && (
          <p className="pmh-empty-state">Loading recommendations…</p>
        )}
        {recommendationsError && !recommendationsLoading && (
          <p className="pmh-empty-state">
            Couldn&apos;t load recommendations: {recommendationsError}. Try refreshing.
          </p>
        )}
        {!recommendationsLoading &&
          !recommendationsError &&
          recommendations.length === 0 && (
            <p className="pmh-empty-state">No recommendations yet. Add your first pick above.</p>
          )}

        {!recommendationsLoading &&
          !recommendationsError &&
          ISLANDS.map((island) => {
            const islandRecs = recommendationsByIsland[island] || [];
            if (islandRecs.length === 0) return null;

            return (
              <div key={island} className="pmh-recommendations-island-group">
                <h3 className="pmh-recommendations-island-title">{island}</h3>
                <div className="pmh-recommendations-grid">
                  {islandRecs.map((rec) => (
                    <article key={rec.id} className="pmh-recommendation-card">
                      <div className="pmh-recommendation-card-header">
                        <h4 className="pmh-recommendation-name">{rec.name}</h4>
                        <div className="pmh-recommendation-meta">
                          <span className="pmh-card-pill">
                            <span>●</span>
                            {rec.category || 'Uncategorized'}
                          </span>
                          {rec.active ? (
                            <span className="pmh-badge-green">
                              <span>●</span>Active
                            </span>
                          ) : (
                            <span className="pmh-badge-inactive">Inactive</span>
                          )}
                        </div>
                      </div>
                      {rec.my_note && (
                        <p className="pmh-recommendation-note">{rec.my_note}</p>
                      )}
                      {rec.google_maps_url && (
                        <a
                          className="pmh-recommendation-link"
                          href={rec.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Google Maps
                        </a>
                      )}
                      <p className="pmh-recommendation-priority">
                        Priority: {rec.priority ?? 1}
                      </p>
                      <div className="pmh-recommendation-actions">
                        <button
                          type="button"
                          className="pmh-button-ghost"
                          onClick={() => handleEditRecommendation(rec)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="pmh-button-ghost"
                          onClick={() => handleDeleteRecommendation(rec.id)}
                          disabled={deletingRecommendationId === rec.id}
                        >
                          {deletingRecommendationId === rec.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
      </section>

      <section className="pmh-pending-section" aria-label="Pending itineraries">
        <h2 className="pmh-section-title">Pending Itineraries</h2>
        <p className="pmh-section-subtitle" style={{ marginBottom: '1.25rem' }}>
          Review, edit, and approve traveler itineraries before they&apos;re emailed out.
        </p>

        {itinerariesLoading && (
          <p className="pmh-empty-state">Loading pending itineraries…</p>
        )}
        {itinerariesError && !itinerariesLoading && (
          <p className="pmh-empty-state">
            Couldn&apos;t load itineraries: {itinerariesError}. Try refreshing.
          </p>
        )}
        {!itinerariesLoading && !itinerariesError && pendingItineraries.length === 0 && (
          <p className="pmh-empty-state">No pending itineraries</p>
        )}

        {!itinerariesLoading && !itinerariesError && pendingItineraries.length > 0 && (
          <div className="pmh-pending-grid">
            {pendingItineraries.map((itinerary) => {
              const submittedAt = itinerary.created_at
                ? new Date(itinerary.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Unknown date';

              return (
                <article key={itinerary.id} className="pmh-itinerary-card">
                  <div className="pmh-itinerary-card-header">
                    <div>
                      <strong>{itinerary.email || 'No email provided'}</strong>
                      <p className="pmh-itinerary-card-meta">Submitted {submittedAt}</p>
                    </div>
                  </div>
                  <div className="pmh-field">
                    <label htmlFor={`itinerary-text-${itinerary.id}`}>Itinerary</label>
                    <textarea
                      id={`itinerary-text-${itinerary.id}`}
                      className="pmh-textarea pmh-itinerary-textarea"
                      value={editedTexts[itinerary.id] ?? ''}
                      onChange={(e) =>
                        handleItineraryTextChange(itinerary.id, e.target.value)
                      }
                    />
                  </div>
                  <div className="pmh-itinerary-card-actions">
                    <button
                      type="button"
                      className="pmh-button-primary"
                      onClick={() => handleApproveItinerary(itinerary)}
                      disabled={
                        approvingId === itinerary.id ||
                        deletingItineraryId === itinerary.id
                      }
                    >
                      {approvingId === itinerary.id ? 'Sending…' : 'Approve & Send'}
                    </button>
                    <button
                      type="button"
                      className="pmh-button-ghost"
                      onClick={() => handleDeleteItinerary(itinerary.id)}
                      disabled={
                        approvingId === itinerary.id ||
                        deletingItineraryId === itinerary.id
                      }
                    >
                      {deletingItineraryId === itinerary.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminPage;

