export type BrowserStatus =
  | "browser_stopped"
  | "container_starting"
  | "browser_ready"
  | "error";

export type ControlEvent =
  | {
      type: "mouse_move";
      x: number;
      y: number;
    }
  | {
      type: "click" | "double_click";
      x: number;
      y: number;
      button?: "left" | "right" | "middle";
    }
  | {
      type: "scroll";
      deltaX: number;
      deltaY: number;
    }
  | {
      type: "type";
      text: string;
    }
  | {
      type: "key";
      key: string;
    }
  | {
      type: "navigate";
      url: string;
    }
  | {
      type: "back" | "forward" | "reload";
    };

export interface StatusPayload {
  status: BrowserStatus;
  message: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshotIntervalMs: number;
  url?: string;
}

export interface FramePayload {
  image: Buffer;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  timestamp: number;
}

