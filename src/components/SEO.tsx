import { useEffect } from "react";
import catFavicon from '@/assets/Catastropic_cat_logo.png'

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

    // Favicon & app icons
    const icon = ensureTag('link[rel="icon"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'icon');
      l.setAttribute('type', 'image/png');
      return l;
    });
    icon.setAttribute('href', catFavicon);

    const appleIcon = ensureTag('link[rel="apple-touch-icon"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'apple-touch-icon');
      return l;
    });
    appleIcon.setAttribute('href', catFavicon);

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
