// Use URL-based asset references so Node/tsx doesn't try to import .jpg files.
// Vite will transform these to the correct served URLs in the browser.
const img1 = new URL("../assets/mcp-1.jpg", import.meta.url).href;
const img2 = new URL("../assets/mcp-2.jpg", import.meta.url).href;
const img3 = new URL("../assets/mcp-3.jpg", import.meta.url).href;
const img4 = new URL("../assets/mcp-4.jpg", import.meta.url).href;
const img5 = new URL("../assets/mcp-5.jpg", import.meta.url).href;
const img6 = new URL("../assets/mcp-6.jpg", import.meta.url).href;
import { Server } from "@/components/ServerCard";

export const MOCK_SERVERS: Server[] = [
  {
    id: "anthropic-search",
    name: "Anthropic Knowledge Search MCP",
    author: "Anthropic",
    official: true,
    trending: true,
    votes: 1243,
    tags: ["search", "knowledge", "enterprise"],
    description: "Enterprise-ready knowledge search MCP server with secure connectors and relevance tuning.",
    media: [
      { type: 'image', src: img1, alt: 'Anthropic search MCP preview' },
    ],
  },
  {
    id: "openai-code",
    name: "OpenAI Code Runner MCP",
    author: "OpenAI",
    official: true,
    trending: false,
    votes: 986,
    tags: ["code", "sandbox"],
    description: "Run sand-boxed code snippets safely from within your agent workflows.",
    media: [
      { type: 'image', src: img2, alt: 'Code runner MCP' },
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive Connector MCP",
    author: "Google",
    official: true,
    trending: true,
    votes: 1534,
    tags: ["storage", "productivity"],
    description: "Access and manage Drive files with granular permissions and link sharing.",
    media: [
      { type: 'image', src: img3, alt: 'Drive connector MCP' },
    ],
  },
  {
    id: "community-vision",
    name: "Vision OCR & Caption MCP",
    author: "Ava Systems",
    votes: 412,
    trending: true,
    description: "OCR, object detection, and alt-text generation for accessible content pipelines.",
    tags: ["vision", "accessibility"],
    media: [
      { type: 'image', src: img4, alt: 'Vision OCR MCP' },
    ],
  },
  {
    id: "community-scraper",
    name: "Smart Web Scraper MCP",
    author: "DataCraft",
    votes: 297,
    description: "Headless web scraping with anti-bot strategies, sitemap crawl, and export.",
    tags: ["web", "crawler"],
    media: [
      { type: 'image', src: img5, alt: 'Web scraper MCP' },
    ],
  },
  {
    id: "community-automation",
    name: "Automation Orchestrator MCP",
    author: "FlowKit",
    votes: 621,
    trending: false,
    description: "Event-driven workflows with human-in-the-loop approvals and retries.",
    tags: ["automation", "workflows"],
    media: [
      { type: 'image', src: img6, alt: 'Automation orchestrator MCP' },
    ],
  },
];

export function generateFeed(size = 40): Server[] {
  // Expand the mock list to simulate a long feed
  const base = [...MOCK_SERVERS];
  const out: Server[] = [];
  let i = 0;
  while (out.length < size) {
    const item = base[i % base.length];
    out.push({ ...item, id: `${item.id}-${out.length}` });
    i++;
  }
  return out;
}
