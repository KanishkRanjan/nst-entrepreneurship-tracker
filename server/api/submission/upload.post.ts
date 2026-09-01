import { defineEventHandler, readMultipartFormData, createError } from "h3";
import { processUploadSubmission } from "../../../src/lib/submission-handler.server";

// Each part's `data` is a Uint8Array. Decoding must not go through .toString("utf-8"):
// Uint8Array.toString() ignores an encoding argument and returns comma-separated byte
// values, so a field would silently read as "107,112,105..." instead of its text.
const partText = (data: Uint8Array): string => new TextDecoder("utf-8").decode(data);

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event);
    if (!parts || parts.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "No form data provided." });
    }

    let kpiId = "";
    let ventureId = "";
    let studentId = "";
    let note = "";
    let fileBuffer: Uint8Array | null = null;
    let fileName = "";
    let mimeType = "application/octet-stream";

    for (const part of parts) {
      if (part.name === "kpiId") kpiId = partText(part.data).trim();
      else if (part.name === "ventureId") ventureId = partText(part.data).trim();
      else if (part.name === "studentId") studentId = partText(part.data).trim();
      else if (part.name === "note") note = partText(part.data);
      else if (part.name === "file" && part.filename) {
        fileBuffer = part.data;
        fileName = part.filename;
        mimeType = part.type || "application/octet-stream";
      }
    }

    const authHeader = event.headers.get("authorization") || "";

    return await processUploadSubmission({
      kpiId,
      ventureId,
      studentId,
      note,
      fileBuffer,
      fileName,
      mimeType,
      authHeader,
    });
  } catch (err: unknown) {
    console.error("[Upload Endpoint Error]", err);
    const statusCode =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    throw createError({
      statusCode,
      statusMessage:
        err instanceof Error && err.message ? err.message : "Failed to process upload.",
    });
  }
});
