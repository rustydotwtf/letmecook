import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "getting-started",
    {
      type: "category",
      label: "Concepts",
      items: [
        "concepts/sessions",
        "concepts/agents-md",
        "concepts/multi-repo-workspaces",
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/tui-guide",
        "guides/cli-guide",
        "guides/managing-sessions",
        "guides/adding-skills",
      ],
    },
    {
      type: "category",
      label: "Reference",
      items: [
        "reference/cli-commands",
        "reference/configuration",
        "reference/session-manifest",
      ],
    },
    {
      type: "category",
      label: "Contributing",
      items: ["contributing/development-setup", "contributing/architecture"],
    },
  ],
};

export default sidebars;
