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

