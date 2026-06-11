/**
 * A base question class.
 */
export class Question {
  public getType(): string {
    return "question";
  }
  /**
   * Specifies the title location.
   */
  public titleLocation: string = "top";
  /**
   * The question name.
   */
  public name: string = "";
  /**
   * The question choices.
   */
  public choices: Array<any> = [];
}
/**
 * An html question.
 */
export class QuestionHtml extends Question {
  public getType(): string {
    return "html";
  }
  /**
   * The html markup.
   */
  public html: string = "";
}
