import type { ChatConfig } from "./flows/chat-to-config";

export interface PartialConfig {
  repos: string[];
  skills: string[];
  goal: string | null;
}

export interface ConfigBuilderEvents {
  "config-changed": (config: PartialConfig) => void;
  "repo-added": (repo: string) => void;
  "repo-removed": (repo: string) => void;
  "skill-added": (skill: string) => void;
  "goal-set": (goal: string) => void;
}

export class ConfigBuilder extends EventTarget {
  private _config: PartialConfig;

  constructor() {
    super();
    this._config = {
      goal: null,
      repos: [],
      skills: [],
    };
  }

  get config(): PartialConfig {
    return { ...this._config };
  }

  /**
   * Add a repository to the config
   * @returns {boolean} true if added, false if already exists
   */
  addRepo(repo: string): boolean {
    const normalized = repo.trim();
    if (!normalized) {
      return false;
    }

    // Check if already exists
    if (this._config.repos.includes(normalized)) {
      return false;
    }

    this._config.repos.push(normalized);
    this.dispatchEvent(new CustomEvent("repo-added", { detail: normalized }));
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
    return true;
  }

  /**
   * Remove a repository from the config
   * @returns {boolean} true if removed, false if not found
   */
  removeRepo(repo: string): boolean {
    const normalized = repo.trim();
    const index = this._config.repos.indexOf(normalized);

    if (index === -1) {
      return false;
    }

    this._config.repos.splice(index, 1);
    this.dispatchEvent(new CustomEvent("repo-removed", { detail: normalized }));
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
    return true;
  }

  /**
   * Add a skill to the config
   * @returns {boolean} true if added, false if already exists
   */
  addSkill(skill: string): boolean {
    const normalized = skill.trim();
    if (!normalized) {
      return false;
    }

    // Check if already exists
    if (this._config.skills.includes(normalized)) {
      return false;
    }

    this._config.skills.push(normalized);
    this.dispatchEvent(new CustomEvent("skill-added", { detail: normalized }));
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
    return true;
  }

  /**
   * Remove a skill from the config
   * @returns {boolean} true if removed, false if not found
   */
  removeSkill(skill: string): boolean {
    const normalized = skill.trim();
    const index = this._config.skills.indexOf(normalized);

    if (index === -1) {
      return false;
    }

    this._config.skills.splice(index, 1);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
    return true;
  }

  /**
   * Set the goal for the config
   */
  setGoal(goal: string): void {
    const normalized = goal.trim();
    this._config.goal = normalized || null;
    this.dispatchEvent(new CustomEvent("goal-set", { detail: normalized }));
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
  }

  /**
   * Check if the config has minimum requirements to proceed
   * Currently requires at least one repo
   */
  isReady(): boolean {
    return this._config.repos.length > 0;
  }

  /**
   * Convert to final ChatConfig format
   */
  toFinalConfig(): ChatConfig {
    return {
      goal: this._config.goal || "",
      repos: [...this._config.repos],
      skills: [...this._config.skills],
    };
  }

  /**
   * Reset the config to initial state
   */
  reset(): void {
    this._config = {
      goal: null,
      repos: [],
      skills: [],
    };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: this.config }));
  }
}