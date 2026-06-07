import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('posts')
        .select(
          'id, title, slug, category, cover_image_url, excerpt, body, published, published_at',
        )
        .eq('slug', slug)
        .maybeSingle();

      if (!isMounted) return;

      if (err) {
        setError(err.message);
      } else if (!data || !data.published) {
        setError('Post not found.');
      } else {
        setPost(data);
      }
      setLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    const title = `${post.title} – Plan My Hawaii`;
    document.title = title;

    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
        return el;
      })();
    meta.content = post.excerpt || 'Local notes from Plan My Hawaii.';
  }, [post]);

  if (loading) {
    return (
      <div className="pmh-post-layout">
        <p className="pmh-empty-state">Loading post…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="pmh-post-layout">
        <p className="pmh-empty-state">{error || 'Post not found.'}</p>
        <button
          type="button"
          className="pmh-button-outline"
          onClick={() => navigate('/blog')}
        >
          Back to blog
        </button>
      </div>
    );
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const bodyParagraphs = (post.body || '').split('\n').filter((p) => p.trim().length);

  return (
    <article className="pmh-post-layout">
      <nav className="pmh-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link> · <Link to="/blog">Local blog</Link> ·{' '}
        <span>{post.title}</span>
      </nav>

      <div className="pmh-post-hero">
        <img
          src={
            post.cover_image_url ||
            'https://images.pexels.com/photos/240526/pexels-photo-240526.jpeg?auto=compress&cs=tinysrgb&w=1200'
          }
          alt={post.title}
        />
      </div>

      <span className="pmh-card-pill">
        <span>●</span>
        {post.category || 'Local notes'}
      </span>
      <h1 className="pmh-blog-title" style={{ marginTop: '0.6rem' }}>
        {post.title}
      </h1>
      {formattedDate && (
        <p className="pmh-post-meta">
          Published {formattedDate} · Plan My Hawaii local blog
        </p>
      )}
      {post.excerpt && <p className="pmh-post-excerpt">{post.excerpt}</p>}

      <div className="pmh-post-body">
        {bodyParagraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>

      <div className="pmh-post-cta">
        <div>
          <strong>Ready to turn this into a real trip?</strong>
          <p style={{ marginTop: '0.3rem', fontSize: '0.9rem' }}>
            Answer a few questions and we&apos;ll build a day-by-day plan that matches
            how you actually travel.
          </p>
        </div>
        <Link to="/plan" className="pmh-button-primary">
          Plan my Hawaii trip
        </Link>
      </div>
    </article>
  );
}

export default BlogPostPage;

