import { defineEventHandler, getQuery, createError, sendRedirect } from "h3";
import { processDownloadSubmission } from "../../../src/lib/submission-handler.server";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const kpiId = query.kpiId ? String(query.kpiId) : undefined;
    const submissionId = query.submissionId ? String(query.submissionId) : undefined;
    const authHeader = event.headers.get("authorization") || "";

    const result = await processDownloadSubmission({
      kpiId,
      submissionId,
      authHeader,
    });

    if (query.redirect === "true" && result.url.startsWith("http")) {
      return sendRedirect(event, result.url, 302);
    }

    return result;
  } catch (err: unknown) {
    console.error("[Download Endpoint Error]", err);
    const statusCode =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof err.statusCode === "number"
        ? err.statusCode
        : 404;
    throw createError({
      statusCode,
      statusMessage:
        err instanceof Error && err.message ? err.message : "Could not generate download link.",
    });
  }
});
