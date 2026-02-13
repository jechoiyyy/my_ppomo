import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "Resource not found"
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      type: "about:blank",
      title: "Validation Error",
      status: 422,
      detail: "Request validation failed",
      errors: err.flatten()
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "Unexpected error"
  });
}
