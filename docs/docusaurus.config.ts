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
          editUrl: "https://github.com/rustydotwtf/letmecook/tree/main/docs/",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
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
      copyright: `Copyright ${new Date().getFullYear()} rustydotwtf. Built with Docusaurus.`,
      links: [
        {
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
          title: "Documentation",
        },
        {
          items: [
            {
              href: "https://github.com/rustydotwtf/letmecook",
              label: "GitHub",
            },
          ],
          title: "More",
        },
      ],
      style: "dark",
    },
    navbar: {
      items: [
        {
          label: "Docs",
          position: "left",
          sidebarId: "docsSidebar",
          type: "docSidebar",
        },
        {
          href: "https://github.com/rustydotwtf/letmecook",
          label: "GitHub",
          position: "right",
        },
      ],
      title: "letmecook",
    },
    prism: {
      additionalLanguages: ["bash", "json", "typescript"],
      darkTheme: prismThemes.dracula,
      theme: prismThemes.github,
    },
  } satisfies Preset.ThemeConfig,

  title: "letmecook",

  url: "https://letmecook.sh",
};

export default config;
