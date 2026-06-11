/**
 * Specifies title alignment.
 */
export type TitleLocation = "top" | "bottom" | "left";

/**
 * A panel-like interface.
 */
export interface IPanel {
  /**
   * The panel name.
   */
  name: string;
  /**
   * An optional description.
   */
  description?: string;
}

export function property(options?: any): any {
  return function (target: any, key: string): void {};
}

/**
 * A class demonstrating different member kinds.
 */
export class MemberKinds {
  /**
   * A read-only value.
   */
  public get readOnlyValue(): number {
    return 42;
  }
  /**
   * A read-write value.
   */
  public get value(): number {
    return 0;
  }
  public set value(val: number) {}
  /**
   * A static member.
   */
  public static instanceCounter: number = 0;
  /**
   * A protected member.
   */
  protected internalState: string = "";
  /**
   * The title location.
   */
  public titleLocation: TitleLocation = "top";
  /**
   * A localizable text property.
   */
  @property({ localizable: true }) text: string;
  /**
   * Calculates a value.
   * @param mode The calculation mode.
   * @param repeat An optional repeat count.
   * @returns The calculated value.
   */
  public calculate(mode: string, repeat?: number): number {
    return 0;
  }
}
