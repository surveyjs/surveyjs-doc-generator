/**
 * A callback-based event.
 */
export class EventBase<SenderType, OptionsType> {
  /**
   * Adds an event handler.
   */
  public add(handler: (sender: SenderType, options: OptionsType) => void): void {}
}
/**
 * Base options for all events.
 */
export interface BaseEventOptions {
  /**
   * Allows you to cancel the action.
   */
  allowCancel: boolean;
  /**
   * Obsolete. Use allowCancel instead.
   */
  cancel: boolean;
}
/**
 * Options for the complete event.
 */
export interface CompleteEventOptions extends BaseEventOptions {
  /**
   * The survey results.
   */
  data: any;
  /**
   * An internal flag.
   * @hidden
   */
  internalFlag: boolean;
}
/**
 * A survey model.
 */
export class SurveyModel {
  /**
   * An event raised when the survey is completed.
   */
  public onComplete: EventBase<SurveyModel, CompleteEventOptions> = new EventBase();
  public onUndocumented: EventBase<SurveyModel, CompleteEventOptions> = new EventBase();
  /**
   * An event raised on a value change.
   *
   * For information on event handler parameters, refer to descriptions within the interface.
   */
  public onValueChanged: EventBase<SurveyModel, BaseEventOptions> = new EventBase();
}
