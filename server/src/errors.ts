export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, details);
export const forbidden = () => new HttpError(403, "forbidden");
export const unauthorized = (msg = "authentication required") => new HttpError(401, msg);
