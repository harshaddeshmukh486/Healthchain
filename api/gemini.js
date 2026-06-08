export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Read the secret key from the secure server environment
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: Gemini API key missing' });
    }

    // Call Google's API internally from the backend
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API processing error');
    }

    // Return the generated response securely to the frontend
    res.status(200).json(data);
  } catch (error) {
    console.error('Gemini API Backend Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze records' });
  }
}
