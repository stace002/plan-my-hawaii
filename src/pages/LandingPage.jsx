import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

function useRecentPosts(limit = 3) {
  const [state, setState] = useState({
    posts: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, slug, category, cover_image_url, excerpt, published_at')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (!isMounted) return;

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }));
      } else {
        setState({ posts: data ?? [], loading: false, error: null });
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [limit]);

  return state;
}

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Plan My Hawaii – Custom Hawaii Itineraries';
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
        return el;
      })();
    meta.content =
      'Answer a few questions and get a warm, opinionated, day-by-day Hawaii itinerary that actually fits you – written like a local friend.';
  }, []);

  const { posts, loading, error } = useRecentPosts(3);

  const hasPosts = posts && posts.length > 0;

  const heroImageUrl = useMemo(
    () =>
      posts[0]?.cover_image_url ||
      'https://images.pexels.com/photos/240526/pexels-photo-240526.jpeg?auto=compress&cs=tinysrgb&w=1200',
    [posts],
  );

  return (
    <div className="pmh-container">
      <section className="pmh-hero">
        <div>
          <div className="pmh-pill">
            <span className="pmh-pill-dot" />
            See the BEST of Hawaii
          </div>
          <h1 className="pmh-hero-title">Hawaii Done Right, Planned Just for You.</h1>
          <p className="pmh-hero-body">
            Answer a few questions and we'll put together a day-by-day Hawaii itinerary
            that actually fits you — the hidden gems, the local eats, the stuff your
            friends wish they&apos;d known.
          </p>
          <p className="pmh-hero-tagline">
            Takes about 5 minutes · Like asking a local
          </p>
          <div className="pmh-badge-row">
            <span className="pmh-badge">Oahu · Maui · Big Island · Kauai</span>
            <span className="pmh-badge">For first-timers & repeat visitors</span>
          </div>
          <div className="pmh-hero-cta-row">
            <button
              type="button"
              className="pmh-button-primary"
              onClick={() => navigate('/plan')}
            >
              Start my itinerary
            </button>
            <button
              type="button"
              className="pmh-button-outline"
              onClick={() => navigate('/blog')}
            >
              Browse local notes
            </button>
          </div>
        </div>

        <div className="pmh-hero-card">
          <div className="pmh-hero-card-tag">Preview</div>
          <h2 className="pmh-hero-card-title">What you&apos;ll get</h2>
          <div className="pmh-hero-card-row">
            <p>
              A warm, opinionated, day-by-day plan that prioritizes and highlights local businesses and attractions.
               No cookie-cutter days. Each trip is unique.
            </p>
            <div className="pmh-chip-row">
              <span className="pmh-chip">Hidden beaches & easy lookouts</span>
              <span className="pmh-chip">Local plate lunch & shave ice</span>
              <span className="pmh-chip">Honest &quot;skip it&quot; tips</span>
            </div>
          </div>
          <div className="pmh-card-image" style={{ marginTop: '1rem', borderRadius: 16 }}>
            <img src={heroImageUrl} alt="Hawaii coastline at golden hour" />
          </div>
        </div>
      </section>

      <section className="pmh-section">
        <div className="pmh-section-header">
          <div>
            <h2 className="pmh-section-title">How it works</h2>
            <p className="pmh-section-subtitle">
              Tell us who you&apos;re traveling with, what you care about, and how you
              like to spend your days. We&apos;ll do the heavy lifting.
            </p>
          </div>
        </div>
        <div className="pmh-steps">
          <div className="pmh-step-card">
            <div className="pmh-step-number">1</div>
            <div className="pmh-step-title">Share your trip basics</div>
            <p className="pmh-step-body">
              Dates, islands, who you&apos;re with, and your travel vibe. Just enough to
              understand the shape of your trip.
            </p>
          </div>
          <div className="pmh-step-card">
            <div className="pmh-step-number">2</div>
            <div className="pmh-step-title">We craft your itinerary</div>
            <p className="pmh-step-body">
              We pull from local-style knowledge: realistic driving times,
              mellow beach days, rainy-day backups, and where to actually eat.
            </p>
          </div>
          <div className="pmh-step-card">
            <div className="pmh-step-number">3</div>
            <div className="pmh-step-title">You tweak & save</div>
            <p className="pmh-step-body">
              Scan it on your phone, copy to your notes app, or share with your crew.
              Adjust anything and make it your own.
            </p>
          </div>
        </div>
      </section>

      <section className="pmh-section">
        <div className="pmh-section-header">
          <div>
            <h2 className="pmh-section-title">Recent from the local blog</h2>
            <p className="pmh-section-subtitle">
              Short, honest notes about spots we actually send friends to — and a few we
              gently tell them to skip.
            </p>
          </div>
          <Link to="/blog" className="pmh-button-outline">
            View all posts
          </Link>
        </div>

        {loading && <p className="pmh-empty-state">Loading posts…</p>}
        {error && !loading && (
          <p className="pmh-empty-state">
            Couldn&apos;t load posts just now. Try again in a bit.
          </p>
        )}
        {!loading && !error && !hasPosts && (
          <p className="pmh-empty-state">
            No posts yet — check back soon for notes from the islands.
          </p>
        )}

        {hasPosts && (
          <div className="pmh-card-grid">
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
                  <h3 className="pmh-card-title">{post.title}</h3>
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
          </div>
        )}
      </section>

      <section className="pmh-bottom-cta">
        <div>
          <h2>Ready to see your week in Hawaii?</h2>
          <p>
            In a couple minutes you&apos;ll have a clear, honest plan that will have you packing your bathing suit tonight.
          
          </p>
        </div>
        <button
          type="button"
          className="pmh-button-primary"
          onClick={() => navigate('/plan')}
        >
          Start my itinerary
        </button>
      </section>
    </div>
  );
}

export default LandingPage;

