import JSZip from "jszip";

export async function createProjectZip(projectTitle: string, componentCode: string): Promise<Buffer> {
  const zip = new JSZip();

  const safeTitle = projectTitle.toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40) || "cloned-site";

  // 1. package.json
  const packageJson = {
    name: safeTitle,
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev -p 3000",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "16.3.5",
      react: "19.2.4",
      "react-dom": "19.2.4",
      "lucide-react": "^1.6.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^3.5.0",
      "tw-animate-css": "^1.4.0",
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4",
      tailwindcss: "^4",
      typescript: "^5",
      "@types/node": "^24",
      "@types/react": "^19",
      "@types/react-dom": "^19",
    },
  };
  zip.file("package.json", JSON.stringify(packageJson, null, 2));

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  zip.file("tsconfig.json", JSON.stringify(tsconfig, null, 2));

  // 3. next.config.ts
  const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
`;
  zip.file("next.config.ts", nextConfig);

  // 4. postcss.config.mjs
  const postcssConfig = `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`;
  zip.file("postcss.config.mjs", postcssConfig);

  // 5. src/app/globals.css
  const globalsCss = `@import "tailwindcss";
@import "tw-animate-css";

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
  }
}
`;
  zip.file("src/app/globals.css", globalsCss);

  // 6. src/app/layout.tsx
  const layoutTsx = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectTitle.replace(/"/g, '\\"')}",
  description: "Exported standalone application from WebCraft AI Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
`;
  zip.file("src/app/layout.tsx", layoutTsx);

  // 7. src/app/page.tsx
  zip.file("src/app/page.tsx", componentCode);

  // 8. README.md
  const readmeMd = `# ${projectTitle}

This is a standalone Next.js 16 + Tailwind CSS v4 web application generated and exported from **WebCraft AI Studio**.

## Quick Start Instructions

1. **Install Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

2. **Start Development Server**:
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open Application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

4. **Production Build**:
   \`\`\`bash
   npm run build
   npm run start
   \`\`\`
`;
  zip.file("README.md", readmeMd);

  // Generate buffer
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}
