// Shared font constants used across the offer-generator feature.
// Both StepPriceBadge (Estilos) and OfferEditorPage (Editar Telas)
// must import from here to guarantee consistency.

export const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New',
  'Oswald', 'Barlow', 'Roboto', 'Inter', 'Montserrat', 'Poppins', 'Lato',
  'Open Sans', 'Raleway', 'Playfair Display', 'Bebas Neue', 'Anton',
  'Bangers', 'Passion One', 'Russo One', 'Teko', 'Archivo Black',
  'Permanent Marker', 'Righteous', 'Fredoka One', 'Pacifico', 'Lobster',
  'Black Ops One', 'Bungee', 'Titan One', 'Ultra'
];

export const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New'];

const loadedGFonts = new Set<string>();

/** Dynamically loads a Google Font into the browser if not already loaded */
export const loadGFont = (name: string) => {
  if (SYSTEM_FONTS.includes(name) || loadedGFonts.has(name)) return;
  loadedGFonts.add(name);
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700;800;900&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};

// Preload common ones
['Oswald', 'Barlow', 'Montserrat', 'Roboto', 'Inter', 'Bebas Neue', 'Poppins', 'Anton'].forEach(loadGFont);

/**
 * Given an SVG element, finds all Google Fonts used in text elements,
 * fetches their CSS + font files, converts to base64, and injects
 * @font-face rules into the SVG's <defs>.
 * This ensures exported SVGs keep their fonts even when opened offline.
 */
export const embedGoogleFontsInSvg = async (clone: SVGElement, customFontNames: string[] = []) => {
  // Collect all font-family values used in text/tspan elements
  const usedFonts = new Set<string>();
  clone.querySelectorAll('text, tspan').forEach(el => {
    const ff = el.getAttribute('font-family');
    if (ff) {
      // Strip quotes and fallbacks like ", sans-serif"
      const clean = ff.split(',')[0].replace(/['"]/g, '').trim();
      if (clean) usedFonts.add(clean);
    }
    // Also check inline style
    const style = el.getAttribute('style');
    if (style) {
      const match = style.match(/font-family:\s*["']?([^"';,]+)/i);
      if (match) usedFonts.add(match[1].trim());
    }
  });

  // Filter to only Google Fonts (not system fonts, not custom fonts already embedded)
  const googleFontsToEmbed = Array.from(usedFonts).filter(
    f => GOOGLE_FONTS.includes(f) && !SYSTEM_FONTS.includes(f) && !customFontNames.includes(f)
  );

  if (googleFontsToEmbed.length === 0) return;

  // Fetch CSS for all needed fonts in one request
  const families = googleFontsToEmbed.map(f => f.replace(/ /g, '+')).join('&family=');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${families}:wght@400;500;600;700;800;900&display=swap`;

  try {
    // Use a user-agent that returns woff2
    const cssResp = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    let cssText = await cssResp.text();

    // Find all url(...) references and convert font files to base64
    const urlMatches = cssText.match(/url\(([^)]+)\)/g) || [];
    for (const urlMatch of urlMatches) {
      const url = urlMatch.slice(4, -1).replace(/['"]/g, '');
      if (url.startsWith('data:')) continue;
      try {
        const fontResp = await fetch(url);
        const blob = await fontResp.blob();
        const b64: string = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        cssText = cssText.replace(url, b64);
      } catch {
        // If a single font file fails, continue with others
      }
    }

    // Inject the @font-face rules into SVG defs
    let defs = clone.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      clone.insertBefore(defs, clone.firstChild);
    }
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = cssText;
    defs.appendChild(styleEl);
  } catch (err) {
    console.warn('Failed to embed Google Fonts in SVG:', err);
  }
};
