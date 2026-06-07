import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const CATEGORIES = [
  'All',
  'Restaurants & Food',
  'Beaches',
  'Hikes & Trails',
  'Ocean & Water',
  'Hidden Gems',
  'Where to Stay',
  'Getting Around',
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');
  const query = useQuery();

  useEffect(() => {
    document.title = 'Local Blog – Plan My Hawaii';
  }, []);

  useEffect(() => {
    const initialCat = query.get('category');
    if (initialCat && CATEGORIES.includes(initialCat)) {
      setCategory(initialCat);
    }
  }, [query]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      let request = supabase
        .from('posts')
        .select(
          'id, title, slug, category, cover_image_url, excerpt, published, published_at',
        )
        .eq('published', true)
        .order('published_at', { ascending: false });

      if (category !== 'All') {
        request = request.eq('category', category);
      }

      const { data, error: err } = await request;

      if (!isMounted) return;

      if (err) {
        setError(err.message);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [category]);

  return (
    <div className="pmh-container">
      <header className="pmh-blog-header">
        <h1 className="pmh-blog-title">Notes from the islands</h1>
        <p className="pmh-blog-subtitle">
          Short, honest pieces on where we actually send friends — what&apos;s worth the
          drive, what&apos;s better as a quick photo, and how to dodge the worst of the
          crowds.
        </p>
        <div className="pmh-filter-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pmh-filter-pill ${
                category === cat ? 'pmh-filter-pill--active' : ''
              }`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="pmh-empty-state">Loading posts…</p>}
      {error && !loading && (
        <p className="pmh-empty-state">
          Couldn&apos;t load posts just now. Try again in a bit.
        </p>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="pmh-empty-state">
          No posts in this category yet. Try switching categories or check back soon.
        </p>
      )}

      {!loading && !error && posts.length > 0 && (
        <section className="pmh-card-grid">
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="pmh-card">
              <div className="pmh-card-image">
                <img
                  src={
                    post.cover_image_url ||
                    'https://images.pexels.com/photos/240526/pexels-photo-240526.jpeg?auto=compress&cs=tinysrgb&w=1200'
                  }
                  alt={post.title}
                />
              </div>
              <div className="pmh-card-body">
                <span className="pmh-card-pill">
                  <span>●</span>
                  {post.category || 'Local notes'}
                </span>
                <h2 className="pmh-card-title">{post.title}</h2>
                <p className="pmh-card-meta">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Draft'}
                </p>
                <p className="pmh-card-excerpt">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

export default BlogPage;

