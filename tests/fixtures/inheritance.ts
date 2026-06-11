/**
 * The base class for all objects.
 */
export class Base {
  public getType(): string {
    return "base";
  }
}
/**
 * A base question class.
 */
export class Question extends Base {
  public getType(): string {
    return "question";
  }
  /**
   * The question name.
   */
  public name: string = "";
}
/**
 * A text question.
 */
export class QuestionText extends Question {
  public getType(): string {
    return "text";
  }
}
