import { describe, it, expect } from "vitest";
import { canEditKpi, canGradeKpi, isBoard, type Actor, type KpiContext } from "@/lib/permissions";

const actor = (role: Actor["role"], userId = "user-1"): Actor => ({ userId, role });
const kpi = (over: Partial<KpiContext> = {}): KpiContext => ({
  ventureUserId: null,
  ventureMentorId: null,
  isLocked: false,
  ...over,
});

describe("canEditKpi", () => {
  it("lets an admin edit a KPI", () => {
    expect(canEditKpi(actor("admin"), kpi())).toBe(true);
  });

  it("lets the academic board edit a KPI", () => {
    expect(canEditKpi(actor("academic_board"), kpi())).toBe(true);
  });

  it("lets a mentor edit a KPI on their own venture", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canEditKpi(mentor, kpi({ ventureMentorId: "mentor-7" }))).toBe(true);
  });

  it("blocks a mentor from editing a KPI on someone else's venture", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canEditKpi(mentor, kpi({ ventureMentorId: "mentor-99" }))).toBe(false);
  });

  it("blocks a mentor when the venture has no mentor assigned", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canEditKpi(mentor, kpi({ ventureMentorId: null }))).toBe(false);
  });

  it("lets a student edit a KPI on their own venture", () => {
    const student = actor("student", "student-3");
    expect(canEditKpi(student, kpi({ ventureUserId: "student-3" }))).toBe(true);
  });

  it("blocks a student from editing a KPI on someone else's venture", () => {
    const student = actor("student", "student-3");
    expect(canEditKpi(student, kpi({ ventureUserId: "student-88" }))).toBe(false);
  });

  it("blocks a student once their own KPI is locked", () => {
    const student = actor("student", "student-3");
    expect(canEditKpi(student, kpi({ ventureUserId: "student-3", isLocked: true }))).toBe(false);
  });

  it("blocks a mentor once the KPI is locked", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canEditKpi(mentor, kpi({ ventureMentorId: "mentor-7", isLocked: true }))).toBe(false);
  });

  it("still lets the board edit a locked KPI", () => {
    expect(canEditKpi(actor("admin"), kpi({ isLocked: true }))).toBe(true);
  });
});

describe("canGradeKpi", () => {
  it("lets an admin grade a KPI", () => {
    expect(canGradeKpi(actor("admin"), kpi())).toBe(true);
  });

  it("lets a mentor grade a KPI on their own venture", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canGradeKpi(mentor, kpi({ ventureMentorId: "mentor-7" }))).toBe(true);
  });

  it("blocks a mentor from grading a KPI on someone else's venture", () => {
    const mentor = actor("mentor", "mentor-7");
    expect(canGradeKpi(mentor, kpi({ ventureMentorId: "mentor-99" }))).toBe(false);
  });

  it("blocks a student from grading their own KPI", () => {
    const student = actor("student", "student-3");
    expect(canGradeKpi(student, kpi({ ventureUserId: "student-3" }))).toBe(false);
  });

  it("blocks students entirely", () => {
    expect(canGradeKpi(actor("student"), kpi())).toBe(false);
  });
});

describe("isBoard", () => {
  it("should validate if board", () => {});
});
