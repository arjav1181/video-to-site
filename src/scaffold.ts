import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderPage } from "./template/page.js";

export interface ScaffoldOptions {
  outDir: string;
  projectName: string;
  frameCount: number;
}

const LAYOUT = `import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Video Portfolio",
  description: "Scroll-driven video frame animation portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable + " " + jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
`;

const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html {
  scroll-behavior: auto;
  scrollbar-width: thin;
  scrollbar-color: #222 #000;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #000; }
::-webkit-scrollbar-thumb { background: #222; border-radius: 999px; }

body {
  background: #000;
  color: #fff;
  overflow-x: hidden;
  font-family: var(--font-display), sans-serif;
}

canvas {
  display: block;
}

/* Scroll-triggered reveal */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger children */
.stagger > .reveal:nth-child(1) { transition-delay: 0ms; }
.stagger > .reveal:nth-child(2) { transition-delay: 80ms; }
.stagger > .reveal:nth-child(3) { transition-delay: 160ms; }
.stagger > .reveal:nth-child(4) { transition-delay: 240ms; }
.stagger > .reveal:nth-child(5) { transition-delay: 320ms; }
.stagger > .reveal:nth-child(6) { transition-delay: 400ms; }
.stagger > .reveal:nth-child(7) { transition-delay: 480ms; }
.stagger > .reveal:nth-child(8) { transition-delay: 560ms; }

/* Magnetic button */
.magnetic-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fff;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.magnetic-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.magnetic-btn:hover::before {
  transform: translateY(0);
}
.magnetic-btn:hover {
  color: #000;
  border-color: #fff;
}
.magnetic-btn span {
  position: relative;
  z-index: 1;
}
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
`;

const POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

function packageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "14.2.35", react: "^18", "react-dom": "^18" },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        autoprefixer: "^10",
        postcss: "^8",
        tailwindcss: "^3.4.1",
        typescript: "^5",
      },
    },
    null,
    2,
  );
}

/** Write the full Next.js project into outDir (frames dir excluded — created by extraction). */
export async function scaffoldProject(opts: ScaffoldOptions): Promise<void> {
  const { outDir, projectName, frameCount } = opts;
  const files: Record<string, string> = {
    "package.json": packageJson(projectName),
    "tsconfig.json": TSCONFIG,
    "next.config.js": NEXT_CONFIG,
    "tailwind.config.js": TAILWIND_CONFIG,
    "postcss.config.js": POSTCSS_CONFIG,
    "src/app/layout.tsx": LAYOUT,
    "src/app/globals.css": GLOBALS_CSS,
    "src/app/page.tsx": renderPage(frameCount),
  };
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(outDir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
}
