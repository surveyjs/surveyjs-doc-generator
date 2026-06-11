/**
 * The base element.
 * @title Base Element
 * @description The base element meta description.
 */
export class ElementBase {
  /**
   * An internal identifier.
   * @hidden
   */
  public internalId: string = "";
  /**
   * Specifies the width.
   * @hidefor TextElement
   */
  public width: string = "";
  /**
   * An old way to set the width.
   * @deprecated Use the width property instead.
   */
  public widthValue: number = 0;
  /**
   * The element name.
   * @see width
   * @see widthValue
   */
  public name: string = "";
}
/**
 * A text element.
 */
export class TextElement extends ElementBase {
  /**
   * The element text.
   */
  public text: string = "";
}
