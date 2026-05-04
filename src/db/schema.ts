import { pgTable, uuid, text, timestamp, boolean, integer, numeric, jsonb, date, time, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'principal', 'teacher', 'substitute']);
export const statusEnum = pgEnum('status', ['active', 'inactive']);
export const approvalStatusEnum = pgEnum('approval_status', ['unapproved', 'approved', 'denied', 'partially_approved']);
export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['unreconciled', 'reconciled']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['assigned', 'confirmed', 'completed', 'cancelled']);
export const employeeTypeEnum = pgEnum('employee_type', ['Teacher', 'Staff', 'Admin']);

// Organizations (school districts)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schools (campuses within a district)
export const schools = pgTable('schools', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state').default('CA'),
  zip: text('zip'),
  phone: text('phone'),
  fax: text('fax'),
  timezone: text('timezone').default('America/Los_Angeles'),
  dayStartTime: time('day_start_time').default('07:30'),
  dayEndTime: time('day_end_time').default('15:30'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Users (all people in the system)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  role: roleEnum('role').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id),
  status: statusEnum('status').default('active'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Employees (teachers and staff who can be absent)
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id).notNull(),
  employeeType: employeeTypeEnum('employee_type').default('Teacher'),
  status: statusEnum('status').default('active'),
});

// Substitutes
export const substitutes = pgTable('substitutes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: statusEnum('status').default('active'),
  skills: jsonb('skills').default([]),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0'),
  ratingCount: integer('rating_count').default(0),
  preferredAtSchools: jsonb('preferred_at_schools').default([]),
  excludedFromSchools: jsonb('excluded_from_schools').default([]),
});

// Absence Reasons (per organization)
export const absenceReasons = pgTable('absence_reasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false),
  sortOrder: integer('sort_order').default(0),
});

// Teacher Time-Off Records (when a teacher is absent)
// KEY FEATURE: Decoupled from sub assignments
export const teacherTimeOff = pgTable('teacher_time_off', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  reasonId: uuid('reason_id').references(() => absenceReasons.id),
  notesToAdmin: text('notes_to_admin'),
  notesToSub: text('notes_to_sub'),
  adminOnlyNotes: text('admin_only_notes'),
  approvalStatus: approvalStatusEnum('approval_status').default('unapproved'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  reconciliationStatus: reconciliationStatusEnum('reconciliation_status').default('unreconciled'),
  substituteRequired: boolean('substitute_required').default(true),
  holdUntil: text('hold_until').default('no_hold'),
  accountingCode: text('accounting_code'),
  payCode: text('pay_code'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sub Assignments (who covers what — separate from teacher time-off)
// KEY FEATURE: One sub can cover MULTIPLE teacher gaps
export const subAssignments = pgTable('sub_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id).notNull(),
  substituteId: uuid('substitute_id').references(() => substitutes.id).notNull(),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  totalHours: numeric('total_hours', { precision: 4, scale: 2 }),
  status: assignmentStatusEnum('status').default('assigned'),
  subFeedbackRating: integer('sub_feedback_rating'),
  subFeedbackNotes: text('sub_feedback_notes'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Junction table: sub_assignments <-> teacher_time_off (many-to-many)
export const assignmentTimeOff = pgTable('assignment_time_off', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => subAssignments.id).notNull(),
  timeOffId: uuid('time_off_id').references(() => teacherTimeOff.id).notNull(),
});

// File Attachments (for sub plans, notes, etc.)
export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  teacherTimeOffId: uuid('teacher_time_off_id').references(() => teacherTimeOff.id),
  subAssignmentId: uuid('sub_assignment_id').references(() => subAssignments.id),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'), // 'pdf' | 'image' | 'audio' | 'doc' | 'other'
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').defaultNow(),
});
// ─── Relations ──────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  schools: many(schools),
  users: many(users),
  absenceReasons: many(absenceReasons),
  teacherTimeOff: many(teacherTimeOff),
  subAssignments: many(subAssignments),
}));

export const schoolsRelations = relations(schools, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [schools.organizationId],
    references: [organizations.id],
  }),
  users: many(users),
  employees: many(employees),
  teacherTimeOff: many(teacherTimeOff),
  subAssignments: many(subAssignments),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  school: one(schools, {
    fields: [employees.schoolId],
    references: [schools.id],
  }),
  timeOff: many(teacherTimeOff),
}));

export const substitutesRelations = relations(substitutes, ({ one, many }) => ({
  user: one(users, {
    fields: [substitutes.userId],
    references: [users.id],
  }),
  assignments: many(subAssignments),
}));

export const teacherTimeOffRelations = relations(teacherTimeOff, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teacherTimeOff.organizationId],
    references: [organizations.id],
  }),
  school: one(schools, {
    fields: [teacherTimeOff.schoolId],
    references: [schools.id],
  }),
  employee: one(employees, {
    fields: [teacherTimeOff.employeeId],
    references: [employees.id],
  }),
  reason: one(absenceReasons, {
    fields: [teacherTimeOff.reasonId],
    references: [absenceReasons.id],
  }),
  approver: one(users, {
    fields: [teacherTimeOff.approvedBy],
    references: [users.id],
  }),
  assignmentLinks: many(assignmentTimeOff),
  attachments: many(attachments),
}));

export const subAssignmentsRelations = relations(subAssignments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subAssignments.organizationId],
    references: [organizations.id],
  }),
  school: one(schools, {
    fields: [subAssignments.schoolId],
    references: [schools.id],
  }),
  substitute: one(substitutes, {
    fields: [subAssignments.substituteId],
    references: [substitutes.id],
  }),
  timeOffLinks: many(assignmentTimeOff),
  attachments: many(attachments),
}));

export const assignmentTimeOffRelations = relations(assignmentTimeOff, ({ one }) => ({
  assignment: one(subAssignments, {
    fields: [assignmentTimeOff.assignmentId],
    references: [subAssignments.id],
  }),
  timeOff: one(teacherTimeOff, {
    fields: [assignmentTimeOff.timeOffId],
    references: [teacherTimeOff.id],
  }),
}));
