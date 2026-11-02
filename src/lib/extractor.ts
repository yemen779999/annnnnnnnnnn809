import * as cheerio from "cheerio";

export interface ExtractedSiteData {
  url: string;
  title: string;
  description: string;
  favicon?: string;
  canonicalUrl?: string;
  designTokens: {
    primaryColors: string[];
    backgroundColors: string[];
    textColors: string[];
    fonts: string[];
    hasDarkMode: boolean;
  };
  assets: {
    images: { src: string; alt: string; width?: string; height?: string }[];
    svgs: string[];
  };
  sections: {
    name: string;
    tag: string;
    heading?: string;
    textSnippet?: string;
  }[];
}

/**
 * Extracts design tokens, fonts, images, and layout sections from HTML
 */
export function extractSiteData(html: string, baseUrl: string): ExtractedSiteData {
  const $ = cheerio.load(html);

  // 1. Metadata
  const title = $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    baseUrl;

  const description = $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  let favicon = $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href");

  if (favicon && !favicon.startsWith("http") && !favicon.startsWith("data:")) {
    try {
      favicon = new URL(favicon, baseUrl).toString();
    } catch {
      favicon = undefined;
    }
  }

  // 2. Color Extraction (Regex on styles + inline styles)
  const hexColors = new Set<string>();
  const allStyles: string[] = [];

  $("style").each((_, el) => {
    allStyles.push($(el).text());
  });

  $("[style]").each((_, el) => {
    const styleAttr = $(el).attr("style");
    if (styleAttr) allStyles.push(styleAttr);
  });

  const fullStyleText = allStyles.join(" ");

  // Match #RGB, #RRGGBB
  const hexMatches = fullStyleText.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
  hexMatches.forEach((c) => {
    const norm = c.toLowerCase();
    if (norm !== "#fff" && norm !== "#ffffff" && norm !== "#000" && norm !== "#000000") {
      hexColors.add(norm);
    }
  });

  // Extract CSS variables like --primary, --background, etc.
  const _cssVarMatches = fullStyleText.match(/--[a-zA-Z0-9_-]+:\s*([^;]+);/g) || [];
  const primaryColors = Array.from(hexColors).slice(0, 6);
  if (primaryColors.length === 0) {
    primaryColors.push("#3b82f6", "#10b981", "#6366f1");
  }

  // 3. Fonts
  const fonts = new Set<string>();
  // Google font links
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/family=([^&:]+)/);
    if (match && match[1]) {
      fonts.add(decodeURIComponent(match[1]).replace(/\+/g, " "));
    }
  });

  // Font-family css declarations
  const fontMatches = fullStyleText.match(/font-family:\s*([^;}]+)/gi) || [];
  fontMatches.forEach((f) => {
    const clean = f.replace(/font-family:\s*/i, "").split(",")[0].replace(/['"]/g, "").trim();
    if (clean && !["inherit", "sans-serif", "serif", "monospace"].includes(clean.toLowerCase())) {
      fonts.add(clean);
    }
  });

  if (fonts.size === 0) {
    fonts.add("Inter");
    fonts.add("Geist");
  }

  // 4. Assets: Images
  const images: { src: string; alt: string; width?: string; height?: string }[] = [];
  const seenSrc = new Set<string>();

  $("img").each((_, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;

    if (!src.startsWith("http") && !src.startsWith("data:")) {
      try {
        src = new URL(src, baseUrl).toString();
      } catch {
        return;
      }
    }

    if (!seenSrc.has(src) && !src.endsWith(".ico") && images.length < 12) {
      seenSrc.add(src);
      images.push({
        src,
        alt: $(el).attr("alt") || "Site Image Asset",
        width: $(el).attr("width"),
        height: $(el).attr("height"),
      });
    }
  });

  // 5. Assets: SVGs
  const svgs: string[] = [];
  $("svg").each((_, el) => {
    if (svgs.length < 8) {
      const svgHtml = $.html(el);
      // Only keep reasonably sized SVGs (icons, logos)
      if (svgHtml.length < 4000) {
        svgs.push(svgHtml);
      }
    }
  });

  // 6. Section hierarchy
  const sections: { name: string; tag: string; heading?: string; textSnippet?: string }[] = [];

  $("header, nav, section, main, footer, article, [id*='hero'], [id*='feature'], [id*='pricing']").each((_, el) => {
    const tag = el.name;
    const heading = $(el).find("h1, h2, h3").first().text().trim();
    const textSnippet = $(el).text().replace(/\s+/g, " ").trim().slice(0, 100);

    let name = tag.toUpperCase();
    const id = $(el).attr("id") || "";
    const className = $(el).attr("class") || "";

    if (id.includes("hero") || className.includes("hero") || $(el).find("h1").length > 0) {
      name = "Hero Section";
    } else if (id.includes("feature") || className.includes("feature")) {
      name = "Features Section";
    } else if (id.includes("pricing") || className.includes("pricing")) {
      name = "Pricing Section";
    } else if (tag === "nav" || tag === "header") {
      name = "Navigation Header";
    } else if (tag === "footer") {
      name = "Footer";
    }

    if (heading || textSnippet) {
      sections.push({
        name,
        tag,
        heading: heading || undefined,
        textSnippet: textSnippet || undefined,
      });
    }
  });

  return {
    url: baseUrl,
    title,
    description,
    favicon,
    designTokens: {
      primaryColors,
      backgroundColors: fullStyleText.includes("#000") || fullStyleText.includes("oklch(0.1") ? ["#09090b", "#18181b"] : ["#ffffff", "#f4f4f5"],
      textColors: ["#09090b", "#71717a"],
      fonts: Array.from(fonts).slice(0, 4),
      hasDarkMode: fullStyleText.includes("dark") || fullStyleText.includes("prefers-color-scheme"),
    },
    assets: {
      images,
      svgs: svgs.slice(0, 5),
    },
    sections: sections.slice(0, 8),
  };
}

/**
 * Built-in reference presets for high-fidelity offline verification
 */
export const REFERENCE_PRESETS: Record<string, ExtractedSiteData> = {
  stripe: {
    url: "https://stripe.com",
    title: "Stripe | Financial Infrastructure for the Internet",
    description: "Millions of companies of all sizes—from startups to Fortune 500s—use Stripe’s software and APIs to accept payments, send payouts, and manage their businesses online.",
    designTokens: {
      primaryColors: ["#635bff", "#0a2540", "#00d4aa", "#ff8000"],
      backgroundColors: ["#f6f9fc", "#ffffff", "#0a2540"],
      textColors: ["#0a2540", "#425466"],
      fonts: ["Plus Jakarta Sans", "Inter", "Geist"],
      hasDarkMode: false,
    },
    assets: {
      images: [
        { src: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80", alt: "Global Payments Overview" },
        { src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80", alt: "Billing Dashboard" },
      ],
      svgs: [],
    },
    sections: [
      { name: "Navigation Header", tag: "header", heading: "Stripe", textSnippet: "Products Solutions Developers Resources Pricing" },
      { name: "Hero Section", tag: "section", heading: "Financial infrastructure to grow your revenue", textSnippet: "Join the millions of businesses using Stripe to handle payments, prevent fraud, and scale globally." },
      { name: "Features Section", tag: "section", heading: "A fully integrated suite of financial products", textSnippet: "Modular components engineered to work seamlessly together." },
      { name: "Footer", tag: "footer", heading: "Stripe Global", textSnippet: "Copyright 2026 Stripe, Inc. All rights reserved." },
    ],
  },
  linear: {
    url: "https://linear.app",
    title: "Linear | The issue tracking tool you'll enjoy using",
    description: "Linear is a purpose-built tool for modern software teams to manage projects, issues, and product roadmaps with unprecedented speed.",
    designTokens: {
      primaryColors: ["#5e6ad2", "#0f1015", "#8a99ad", "#d0d6e0"],
      backgroundColors: ["#08090c", "#12141a"],
      textColors: ["#f7f8f8", "#8a8f98"],
      fonts: ["Geist", "Inter", "Plus Jakarta Sans"],
      hasDarkMode: true,
    },
    assets: {
      images: [
        { src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80", alt: "Issue Tracking View" },
      ],
      svgs: [],
    },
    sections: [
      { name: "Navigation Header", tag: "header", heading: "Linear", textSnippet: "Features Method Customers Changelog Pricing" },
      { name: "Hero Section", tag: "section", heading: "Linear is a better way to build software", textSnippet: "Meet the new standard for modern software development. Streamline issues, sprints, and product roadmaps." },
      { name: "Features Section", tag: "section", heading: "Crafted for speed and focus", textSnippet: "Keyboard-first navigation, blazing fast synchronization, and bespoke aesthetic details." },
      { name: "Footer", tag: "footer", heading: "Linear Orbit", textSnippet: "Linear Inc. Designed in San Francisco." },
    ],
  },
  vercel: {
    url: "https://vercel.com",
    title: "Vercel: Build and deploy the best web experiences",
    description: "Vercel's Frontend Cloud gives developers frameworks, workflows, and infrastructure to build a faster, more personalized Web.",
    designTokens: {
      primaryColors: ["#000000", "#0070f3", "#50e3c2", "#7928ca"],
      backgroundColors: ["#000000", "#111111"],
      textColors: ["#ededed", "#888888"],
      fonts: ["Geist", "Geist Mono"],
      hasDarkMode: true,
    },
    assets: {
      images: [
        { src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80", alt: "Global Edge Network" },
      ],
      svgs: [],
    },
    sections: [
      { name: "Navigation Header", tag: "header", heading: "Vercel", textSnippet: "Products Solutions Resources Enterprise Pricing" },
      { name: "Hero Section", tag: "section", heading: "Your complete platform for the Web", textSnippet: "Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster web." },
      { name: "Features Section", tag: "section", heading: "Deploy from your Git repository in seconds", textSnippet: "Automatic CI/CD with instant preview deployments for every pull request." },
      { name: "Footer", tag: "footer", heading: "Vercel Inc.", textSnippet: "Copyright 2026 Vercel, Inc." },
    ],
  },
};
