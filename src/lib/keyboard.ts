import { typedToEntries } from "niall-utils";

type KeyModifiers = Record<"alt" | "ctrl" | "meta" | "shift", boolean>;

export class Keyboard {
  private readonly state: Record<string, KeyModifiers | null>;
  private readonly lowercaseState: Record<string, KeyModifiers | null>;

  constructor(element: HTMLElement) {
    this.state = {};
    this.lowercaseState = {};

    element.onkeydown = evt => {
      this.state[evt.key] = this.lowercaseState[evt.key.toLowerCase()] = {
        alt: evt.altKey,
        ctrl: evt.ctrlKey,
        meta: evt.metaKey,
        shift: evt.shiftKey,
      };
    };

    element.onkeyup = evt => {
      this.state[evt.key] = this.lowercaseState[evt.key.toLowerCase()] = null;
    };
  }

  modifiers(key: string, caseSensitive: boolean = false): KeyModifiers | null {
    return (
      (caseSensitive
        ? this.state[key]
        : this.lowercaseState[key.toLowerCase()]) ?? null
    );
  }

  isDown(
    key: string,
    caseSensitive: boolean = false,
    modifiers?: Partial<KeyModifiers>
  ): boolean {
    const keyState = caseSensitive
      ? this.state[key]
      : this.lowercaseState[key.toLowerCase()];

    return (
      keyState != null &&
      (modifiers == null ||
        typedToEntries(modifiers).every(
          ([modifier, down]) => keyState[modifier] === down
        ))
    );
  }
}
