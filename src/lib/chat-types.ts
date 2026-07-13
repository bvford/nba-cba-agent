export type FeedbackValue = "up" | "down";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  feedback?: FeedbackValue;
  isError?: boolean;
}
