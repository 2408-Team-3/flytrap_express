import axios from "axios";
import { FlytrapError } from "./utils/FlytrapError";
import { LogData, RejectionValue } from "./types/types";
import { responseSchema } from "./types/schemas";
import { ZodError } from "zod";

export default class Flytrap {
  private projectId: string;
  private apiEndpoint: string;
  private apiKey: string;

  constructor(config: {
    projectId: string;
    apiEndpoint: string;
    apiKey: string;
  }) {
    this.projectId = config.projectId;
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;
  }

  // * --- Private Methods --- * //
  private setUpGlobalErrorHandlers(): void {
    process.on("uncaughtException", (e: Error) =>
      this.handleUncaughtException(e),
    );
    process.on("unhandledRejection", (reason: Error | RejectionValue, promise: Promise<any>) =>
      this.handleUnhandledRejection(reason, promise),
    );
  }

  private handleUncaughtException(e: Error): void {
    if (e instanceof FlytrapError) return;
    this.logError(e, false);
    // process.exit(1); // Uncomment if needed
  }

  private handleUnhandledRejection(reason: Error | RejectionValue, promise: Promise<any>): void {
    if (reason instanceof Error) {
      if (reason instanceof FlytrapError) return;
      this.logError(reason, false);
    } else {
      this.logRejection(reason, false);
    }
    // process.exit(1); // Uncomment if needed
  }

  private async logError(error: Error, handled: boolean): Promise<void> {
    if (!error) return;

    const data: LogData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      handled,
      timestamp: new Date().toISOString(),
      project_id: this.projectId,
    };

    try {
      console.log("[flytrap] Sending error to backend...");
      const response = await axios.post(
        `${this.apiEndpoint}/api/errors`,
        { data },
        { headers: { "x-api-key": this.apiKey } },
      );

      responseSchema.parse(response);
      console.log("[flytrap]", response.status, response.data);
    } catch (e) {
      if (e instanceof ZodError) {
        console.error("[flytrap] Response validation error:", e.errors);
      } else {
        console.error("[flytrap] An error occured sending error data.", e);
        throw new FlytrapError(
          "An error occurred logging error data.",
          e instanceof Error ? e : new Error(String(e)),
        );
      }
    }
  }

  private async logRejection(
    value: RejectionValue,
    handled: boolean,
  ): Promise<void> {
    const data: LogData = {
      value,
      handled,
      timestamp: new Date().toISOString(),
      project_id: this.projectId,
    };

    try {
      console.log("[flytrap] Sending rejection to backend...");
      const response = await axios.post(
        `${this.apiEndpoint}/api/errors`,
        { data },
        { headers: { "x-api-key": this.apiKey } },
      );

      responseSchema.parse(response);
      console.log("[flytrap]", response.status, response.data);
    } catch (e) {
      if (e instanceof ZodError) {
        console.error("[flytrap] Response validation error:", e.errors);
      } else {
        console.error(
          "[error sdk] An error occurred sending rejection data.",
          e,
        );
        throw new FlytrapError(
          "An error occurred logging rejection data.",
          e instanceof Error ? e : new Error(String(e)),
        );
      }
    }
  }
}
