/**
 * A simple model class.
 */
export class SimpleModel {
  /**
   * The model title.
   */
  public title: string = "";
  /**
   * Returns a greeting for the specified name.
   * @param name A person name.
   * @returns The greeting text.
   */
  public greet(name: string): string {
    return "Hello, " + name;
  }
}

export class NotDocumented {
  public foo: string = "";
}
