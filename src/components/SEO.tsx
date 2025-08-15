import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const ensureTag = (selector: string, create: () => HTMLElement) => {
  let el = document.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
};

export const SEO = ({ title, description, jsonLd }: SEOProps) => {
  useEffect(() => {
    document.title = title;

    const descMeta = ensureTag('meta[name="description"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      return m;
    });
    if (description) descMeta.setAttribute('content', description);

    const ogTitle = ensureTag('meta[property="og:title"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:title');
      return m;
    });
    ogTitle.setAttribute('content', title);

    const ogDesc = ensureTag('meta[property="og:description"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:description');
      return m;
    });
    if (description) ogDesc.setAttribute('content', description);

    const canonical = ensureTag('link[rel="canonical"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'canonical');
      return l;
    });
    canonical.setAttribute('href', window.location.href);

    // Structured data
    const jsonId = 'page-jsonld';
    const existing = document.getElementById(jsonId);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = jsonId;
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, jsonLd]);

  return null;
};

export default SEO;
