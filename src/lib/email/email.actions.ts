import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { EmailNotificationType } from "./email.types";

export const sendLockedKpiEmailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      kpiId: z.string(),
      ventureId: z.string(),
      mentorUserId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { kpiId, ventureId, mentorUserId = "" } = data;

    try {
      const { EmailService } = await import("./email.service");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Fetch KPI details
      const { data: kpi, error: kpiErr } = await supabaseAdmin
        .from("venture_kpis")
        .select("*")
        .eq("id", kpiId)
        .single();

      if (kpiErr || !kpi) {
        throw new Error(`KPI not found: ${kpiErr?.message || "No record"}`);
      }

      // 2. Fetch Venture details
      const { data: venture, error: vErr } = await supabaseAdmin
        .from("ventures")
        .select("*")
        .eq("id", ventureId)
        .single();

      if (vErr || !venture) {
        throw new Error(`Venture not found: ${vErr?.message || "No record"}`);
      }

      // 3. Fetch Student email
      let studentEmail: string | null = null;

      // Smart Fallback: If the roll number is typed as an email address, use it directly
      if (venture.roll_no && venture.roll_no.includes("@")) {
        studentEmail = venture.roll_no.trim();
      }

      if (!studentEmail && venture.user_id) {
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("email")
          .eq("user_id", venture.user_id)
          .maybeSingle();
        studentEmail = roleData?.email || null;
      }
      if (!studentEmail && venture.roll_no) {
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("email")
          .eq("roll_no", venture.roll_no)
          .maybeSingle();
        studentEmail = roleData?.email || null;
      }

      // Secondary fallback to Auth table query
      if (!studentEmail && venture.user_id) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(venture.user_id);
          studentEmail = authUser?.user?.email || null;
        } catch (authErr) {
          console.warn("[EmailActions] Failed to query auth.users:", authErr);
        }
      }

      if (!studentEmail) {
        console.warn(`[EmailActions] Student email not found for venture ${ventureId}`);
      }

      // Helper: Check for valid UUID format
      function isValidUuid(id?: string | null): boolean {
        if (!id || typeof id !== "string") return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
      }

      // 4. Fetch Academic Board emails dynamically
      const { data: boardRoles } = await supabaseAdmin
        .from("user_roles")
        .select("email")
        .eq("role", "academic_board");

      const boardEmails = (boardRoles || []).map((r) => r.email).filter(Boolean) as string[];

      // 5. Fetch Mentor details (with UUID safety & fallbacks)
      let assignedMentorEmail: string | null = null;
      // Stays "Unassigned" unless a mentor is actually resolved for this venture -- the
      // board alert renders this as mentorName, so it must never name someone who is not
      // the student's mentor.
      let assignedMentorName: string = "Unassigned";

      const targetMentorId = isValidUuid(venture.mentor_id)
        ? venture.mentor_id
        : isValidUuid(mentorUserId)
          ? mentorUserId
          : null;

      if (targetMentorId) {
        const { data: vMentorRole } = await supabaseAdmin
          .from("user_roles")
          .select("email")
          .eq("user_id", targetMentorId)
          .maybeSingle();

        if (vMentorRole?.email) {
          assignedMentorEmail = vMentorRole.email;
          assignedMentorName = vMentorRole.email;
        }

        try {
          const { data: authAssigned } = await supabaseAdmin.auth.admin.getUserById(targetMentorId);
          if (authAssigned?.user?.email) {
            if (!assignedMentorEmail) assignedMentorEmail = authAssigned.user.email;
            assignedMentorName =
              authAssigned.user.user_metadata?.full_name ||
              authAssigned.user.email ||
              assignedMentorName;
          }
        } catch (authErr) {
          console.warn("[EmailActions] Failed to query mentor auth details:", authErr);
        }
      }

      // No fallback mentor is chosen here on purpose. Picking an arbitrary user with the
      // mentor role would mail a named student's failing score to someone unconnected to
      // the venture, and would name that person as the mentor in the board alert below.
      // When there is no mentor, the escalation goes to the academic board instead --
      // see step 11.

      const emailService = new EmailService();
      const dashboardBaseUrl = process.env.APP_URL || "http://localhost:3000";

      // 6. Calculate target KPI score percentage
      const currentScoreVal = kpi.score !== null ? kpi.score : 0;
      const currentPct = (currentScoreVal / (kpi.total_grade || 100)) * 100;
      const roundedPct = Math.round(currentPct);

      const kpiTag = `[KPI:${kpiId}]`;

      // Helper function: Check if an email of a specific type has already been sent for this KPI
      async function isAlreadySent(
        recipientEmail: string,
        type: EmailNotificationType,
      ): Promise<boolean> {
        try {
          const { data: existing, error } = await supabaseAdmin
            .from("email_notifications")
            .select("id")
            .eq("recipient_email", recipientEmail)
            .eq("type", type)
            .eq("status", "SENT")
            .like("subject", `%${kpiTag}%`)
            .limit(1);

          if (error) return false;
          return (existing?.length ?? 0) > 0;
        } catch {
          return false;
        }
      }

      // 7. Student Email — ALWAYS sent on every locked evaluation
      if (studentEmail) {
        const studentAlreadySent = await isAlreadySent(studentEmail, "KPI_SCORED_STUDENT");
        if (!studentAlreadySent) {
          try {
            await emailService.sendKpiScoredStudentEmail(
              studentEmail,
              {
                studentName: venture.student_name,
                score: currentScoreVal,
                totalMarks: kpi.total_grade,
                percentage: roundedPct,
                evaluationName: kpi.name,
                dashboardUrl: `${dashboardBaseUrl}/result`,
              },
              venture.user_id || undefined,
              kpiTag,
            );
          } catch (studErr: unknown) {
            const msg = studErr instanceof Error ? studErr.message : String(studErr);
            console.error(`[EmailActions] Error sending student email: ${msg}`);
          }
        } else {
          console.log(
            `[EmailActions] Student result email already sent for KPI ${kpiId}. Skipping.`,
          );
        }
      }

      // 9. Fetch ALL locked KPIs for this venture to compute consecutive strikes
      const { data: allLockedKpis, error: fetchLockedErr } = await supabaseAdmin
        .from("venture_kpis")
        .select(
          "id, name, score, total_grade, is_locked, locked_at, scored_at, created_at, due_date",
        )
        .eq("venture_id", ventureId)
        .eq("is_locked", true)
        .not("score", "is", null);

      if (fetchLockedErr) {
        console.error(`[EmailActions] Error fetching locked KPIs: ${fetchLockedErr.message}`);
      }

      // Sort chronologically: due_date > locked_at > scored_at > created_at > id
      const sortedKpis = (allLockedKpis || []).sort((a, b) => {
        const tA = new Date(
          a.due_date || a.locked_at || a.scored_at || a.created_at || 0,
        ).getTime();
        const tB = new Date(
          b.due_date || b.locked_at || b.scored_at || b.created_at || 0,
        ).getTime();
        if (tA !== tB) return tA - tB;
        return a.id.localeCompare(b.id);
      });

      let mentorStrikeCount = 0;
      let boardStrikeCount = 0;
      let triggerMentorEscalation = false;
      let triggerBoardEscalation = false;

      for (const item of sortedKpis) {
        const itemScore = item.score !== null ? item.score : 0;
        const itemTotal = item.total_grade || 100;
        const itemPct = (itemScore / itemTotal) * 100;

        if (itemPct <= 40) {
          mentorStrikeCount += 1;
          boardStrikeCount += 1;
        } else if (itemPct > 40 && itemPct < 70) {
          mentorStrikeCount += 1;
          boardStrikeCount = 0;
        } else {
          mentorStrikeCount = 0;
          boardStrikeCount = 0;
        }

        if (mentorStrikeCount >= 2) {
          if (item.id === kpiId) {
            triggerMentorEscalation = true;
          }
          mentorStrikeCount = 0;
        }

        if (boardStrikeCount >= 2) {
          if (item.id === kpiId) {
            triggerBoardEscalation = true;
          }
          boardStrikeCount = 0;
        }
      }

      // 10. Send Academic Board Alert on 2 Consecutive Board Strikes (<= 40%)
      if (triggerBoardEscalation && boardEmails.length > 0) {
        for (const boardEmail of boardEmails) {
          const boardAlreadySent = await isAlreadySent(boardEmail, "CONSECUTIVE_LOW_SCORE_BOARD");
          if (!boardAlreadySent) {
            try {
              await emailService.sendAcademicBoardLowScoreEmail(
                boardEmail,
                {
                  studentName: venture.student_name,
                  studentEmail: studentEmail || "N/A",
                  batch: venture.roll_no || "2024-2028",
                  score: currentScoreVal,
                  totalMarks: kpi.total_grade,
                  percentage: roundedPct,
                  mentorName: assignedMentorName,
                  evaluationName: kpi.name,
                  dashboardUrl: `${dashboardBaseUrl}/result`,
                },
                kpiTag,
              );
            } catch (alertErr: unknown) {
              const msg = alertErr instanceof Error ? alertErr.message : String(alertErr);
              console.error(`[EmailActions] Error sending board alert to ${boardEmail}: ${msg}`);
            }
          }
        }
      }

      // 11. Send Mentor Alert on 2 Consecutive Mentor Strikes (<= 40% or 40%-70%).
      // With no mentor on the venture there is nobody to chase the student, so the
      // escalation is redirected to the academic board -- who already receive this
      // student's name and score in step 10, so this discloses nothing new to them.
      if (triggerMentorEscalation) {
        const mentorType =
          currentPct <= 40 ? "CONSECUTIVE_LOW_SCORE_BOARD" : "CONSECUTIVE_MID_SCORE_MENTOR";
        const escalationRecipients = assignedMentorEmail ? [assignedMentorEmail] : boardEmails;

        if (escalationRecipients.length === 0) {
          console.warn(
            `[EmailActions] KPI ${kpiId} hit mentor escalation but the venture has no mentor and no academic board address is on file. No alert sent.`,
          );
        }

        for (const recipient of escalationRecipients) {
          // For a <= 40% redirect this shares the type and tag of the step 10 board
          // alert, so a board member who was already told about this KPI is not mailed
          // about it twice.
          if (await isAlreadySent(recipient, mentorType)) continue;

          try {
            if (currentPct <= 40) {
              await emailService.sendMentorLowScoreEmail(
                recipient,
                {
                  studentName: venture.student_name,
                  score: currentScoreVal,
                  totalMarks: kpi.total_grade,
                  percentage: roundedPct,
                  evaluationName: kpi.name,
                  dashboardUrl: `${dashboardBaseUrl}/result`,
                },
                kpiTag,
              );
            } else {
              await emailService.sendMentorFollowUpEmail(
                recipient,
                {
                  studentName: venture.student_name,
                  score: currentScoreVal,
                  totalMarks: kpi.total_grade,
                  percentage: roundedPct,
                  evaluationName: kpi.name,
                  dashboardUrl: `${dashboardBaseUrl}/result`,
                },
                kpiTag,
              );
            }
          } catch (alertErr: unknown) {
            const msg = alertErr instanceof Error ? alertErr.message : String(alertErr);
            console.error(`[EmailActions] Error sending mentor alert to ${recipient}: ${msg}`);
          }
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EmailActions] Critical error in sendLockedKpiEmailsFn:", msg);
      return { success: false, error: msg };
    }
  });
