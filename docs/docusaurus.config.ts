import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";

import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  baseUrl: "/",
  favicon: "img/favicon.ico",
  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  onBrokenLinks: "throw",
  organizationName: "rustydotwtf",

  presets: [
    [
      "classic",
      {
        blog: false,
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: "https://github.com/rustydotwtf/letmecook/tree/main/docs/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  projectName: "letmecook",

  tagline: "Multi-repo workspace manager for AI coding sessions",

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Getting Started",
              to: "/",
            },
            {
              label: "CLI Reference",
              to: "/reference/cli-commands",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/rustydotwtf/letmecook",
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} rustydotwtf. Built with Docusaurus.`,
    },
    navbar: {
      title: "letmecook",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/rustydotwtf/letmecook",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "typescript"],
    },
  } satisfies Preset.ThemeConfig,

  title: "letmecook",

  url: "https://letmecook.sh",
};

export default config;
