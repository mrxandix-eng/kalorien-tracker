// Falls "model not found" kommt, hier den Namen tauschen, z. B. gemini-3.6-flash
const MODEL = "gemini-3.1-flash-lite";

const PROMPT = `Du bist ein Ernährungsassistent.
Der Nutzer beschreibt, was er gegessen hat. Schätze Kalorien und Makros.
Fehlen Mengen, nimm übliche Portionen an und nenne die Annahme im Feld "menge".
Gib NUR gültiges JSON in genau diesem Format zurück:
{
  "items": [
    { "name": "Rührei", "menge": "2 Eier (ca. 120 g)", "kcal": 180, "protein": 12, "kohlenhydrate": 1, "fett": 14 }
  ],
  "tipps": ["Tipp 1", "Tipp 2"]
}
Protein, Kohlenhydrate und Fett in Gramm. Genau zwei kurze, konkrete Tipps auf Deutsch, wie die Mahlzeit besser werden könnte.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY fehlt in Vercel" });
  }

  const text = String((req.body && req.body.text) || "").trim();
  if (!text || text.length > 500) {
    return res.status(400).json({ error: "Bitte 1 bis 500 Zeichen eingeben" });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${PROMPT}\n\nGegessen: ${text}` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!r.ok) {
      const msg =
        r.status === 429
          ? "Gratis-Limit erreicht. Bitte kurz warten."
          : `KI-Fehler (${r.status})`;
      return res.status(502).json({ error: msg });
    }

    const data = await r.json();
    const raw = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) throw new Error("bad format");
    return res.status(200).json({ items: parsed.items, tipps: parsed.tipps || [] });
  } catch (e) {
    return res.status(502).json({ error: "Antwort der KI nicht lesbar. Bitte nochmal versuchen." });
  }
};
