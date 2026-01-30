import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "getting-started",
    {
      items: [
        "concepts/sessions",
        "concepts/agents-md",
        "concepts/multi-repo-workspaces",
      ],
      label: "Concepts",
      type: "category",
    },
    {
      items: [
        "guides/tui-guide",
        "guides/cli-guide",
        "guides/managing-sessions",
        "guides/adding-skills",
      ],
      label: "Guides",
      type: "category",
    },
    {
      items: [
        "reference/cli-commands",
        "reference/configuration",
        "reference/session-manifest",
      ],
      label: "Reference",
      type: "category",
    },
    {
      items: ["contributing/development-setup", "contributing/architecture"],
      label: "Contributing",
      type: "category",
    },
  ],
};

export default sidebars;
