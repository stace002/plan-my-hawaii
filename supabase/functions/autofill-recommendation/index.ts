const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function extractJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // fall through
      }
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('AI did not return valid JSON');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, island, category } = await req.json();
    if (!name || !island || !category) {
      return new Response(
        JSON.stringify({ error: 'name, island, and category are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const prompt = `You are helping fill a Hawaii recommendation record for Plan My Hawaii, a local itinerary site.

Place: ${name}
Island: ${island}
Category: ${category}

Return ONLY valid JSON (no markdown, no extra commentary) with exactly these keys:
{
  "description": "2-4 sentence factual description of this place",
  "neighborhood": "specific neighborhood or area on the island",
  "kid_friendly": true,
  "budget_level": "Budget" | "Mid-Range" | "Luxury",
  "vibes": ["Adventure", "Relaxation", "Culture", "Food", "Nature", "Romance"],
  "website_url": "official website URL if known, otherwise empty string",
  "my_note": "a warm, personal 1-3 sentence recommendation, like a local friend telling you why they send people here"
}

Rules:
- kid_friendly must be a boolean
- budget_level must be one of: Budget, Mid-Range, Luxury
- vibes must be an array containing only applicable values from: Adventure, Relaxation, Culture, Food, Nature, Romance
- If you are unsure of the official website, use an empty string`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    if (!anthropicRes.ok) {
      const message =
        anthropicData?.error?.message || 'Anthropic request failed';
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = anthropicData?.content?.[0]?.text || '';
    const parsed = extractJson(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Auto-fill failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
