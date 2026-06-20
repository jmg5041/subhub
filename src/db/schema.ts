import { pgTable, uuid, text, timestamp, boolean, integer, numeric, jsonb, date, time, pgEnum, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'principal', 'staff', 'teacher', 'substitute']);
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
  autoNotifySubs: boolean('auto_notify_subs').default(true),
  notifyBySms: boolean('notify_by_sms').default(true),
  notifyByEmail: boolean('notify_by_email').default(true),
  notifyByPhone: boolean('notify_by_phone').default(false),
  subPayModel: text('sub_pay_model').default('block'), // 'block' | 'hourly'
  halfDayHours: numeric('half_day_hours', { precision: 3, scale: 1 }).default('4.0'),
  fullDayHours: numeric('full_day_hours', { precision: 3, scale: 1 }).default('8.0'),
  timezone: text('timezone').default('America/Los_Angeles'), // IANA timezone name
  subscriptionStatus: text('subscription_status').default('trial'), // 'trial' | 'active' | 'past_due' | 'expired'
  paidThrough: date('paid_through'), // date the trial/subscription expires
  paymentMethod: text('payment_method').default('stripe'), // 'stripe' | 'check' | 'comp'
  planNotes: text('plan_notes'), // platform staff notes
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'), // null = wizard not finished
  cronEnabled: boolean('cron_enabled').default(true).notNull(), // kill switch: false = no blasts, no notifications
  seatCount: integer('seat_count'), // purchased seats; null until set during onboarding
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Platform-wide settings (single row, id always = 1)
export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey().default(1),
  staffAlertEmail: text('staff_alert_email'), // receives billing expiry alerts
  appName: text('app_name').default('SubHub'),
  logoUrl: text('logo_url'), // URL to logo image; if null, app name text is shown
  pricePerSeatCents: integer('price_per_seat_cents').default(800), // e.g. 800 = $8.00/seat/month
  stripePriceId: text('stripe_price_id'), // Stripe price object ID for seat-based billing
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Schools (campuses within a district)
export const schools = pgTable('schools', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state').default('CA'),
  zip: text('zip'),
  county: text('county'),
  phone: text('phone'),
  fax: text('fax'),
  website: text('website'),
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
  isPlatformAdmin: boolean('is_platform_admin').default(false),
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
  notificationPreference: text('notification_preference').default('all'),
  // 'sms' | 'email' | 'phone' | 'all'
  county: text('county'),
  resumeUrl: text('resume_url'),
  visibleInDirectory: boolean('visible_in_directory').default(true).notNull(),
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
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),               // null = single day (same as startDate)
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
  staffCoverageNotes: text('staff_coverage_notes'),  // who covered when substituteRequired = false
  holdUntil: text('hold_until').default('no_hold'),
  accountingCode: text('accounting_code'),
  payCode: text('pay_code'),
  subOutreachStatus: text('sub_outreach_status').default('not_started'),
  // 'not_started' | 'not_needed' | 'sent' | 'filled'
  requestedSubId: uuid('requested_sub_id').references(() => substitutes.id),
  completedAt: timestamp('completed_at'),
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
  assignedByAdmin: boolean('assigned_by_admin').default(false),
  payBasis: text('pay_basis').default('exact'), // 'exact' | 'half_day' | 'full_day'
  generalDutiesHours: numeric('general_duties_hours', { precision: 4, scale: 2 }),
  generalDutiesNotes: text('general_duties_notes'),
  payRate: numeric('pay_rate', { precision: 6, scale: 2 }),
  totalPay: numeric('total_pay', { precision: 8, scale: 2 }),
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

// Sub ↔ School assignments — which schools a sub is approved to work at
export const subSchoolAssignments = pgTable('sub_school_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  substituteId: uuid('substitute_id').references(() => substitutes.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'active' | 'rejected'
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
});

// Per-user, per-school notification preferences (opt-out model: no row = receive alerts)
export const userSchoolNotificationPrefs = pgTable('user_school_notification_prefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  alertOnTeacherSubmit: boolean('alert_on_teacher_submit').notNull().default(true),
  alertOnUnfilled: boolean('alert_on_unfilled').notNull().default(true),
}, (t) => [
  unique().on(t.userId, t.schoolId),
]);

// Sub priority order — admin ranks which subs to contact first
export const subPriorityOrders = pgTable('sub_priority_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id),
  substituteId: uuid('substitute_id').references(() => substitutes.id).notNull(),
  priorityRank: integer('priority_rank').default(999),
});

// Tokens for sub accept/decline deep links (no login required)
export const subNotificationTokens = pgTable('sub_notification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').unique().notNull(),
  teacherTimeOffId: uuid('teacher_time_off_id').references(() => teacherTimeOff.id).notNull(),
  substituteId: uuid('substitute_id').references(() => substitutes.id).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  action: text('action'),
  // 'accepted' | 'declined' | null
  createdAt: timestamp('created_at').defaultNow(),
});

// Invitations — admin/staff invites teachers, subs, and staff to the platform
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  schoolId: uuid('school_id').references(() => schools.id),
  email: text('email').notNull(),
  role: roleEnum('role').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sub unavailability — subs mark dates they cannot work; blast skips them
export const subUnavailability = pgTable('sub_unavailability', {
  id: uuid('id').primaryKey().defaultRandom(),
  substituteId: uuid('substitute_id').references(() => substitutes.id).notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique().on(t.substituteId, t.date),
]);

// Public school directory — California (and eventually other states)
// This is a seed-and-refine table separate from the live schools table.
// Subs browse this to discover schools. Orgs "claim" their entry to link it.
export const schoolDirectory = pgTable('school_directory', {
  id: uuid('id').primaryKey().defaultRandom(),
  cdCode: text('cd_code'),           // CA district + school code
  districtName: text('district_name'),
  schoolName: text('school_name').notNull(),
  county: text('county').notNull(),
  city: text('city'),
  address: text('address'),
  state: text('state').default('CA'),
  zip: text('zip'),
  phone: text('phone'),
  schoolType: text('school_type'),   // "Public", "Private", etc.
  gradeRange: text('grade_range'),   // "K-8", "9-12", etc.
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  // If an org has claimed this entry, claimedByOrgId links to their organizations row
  claimedByOrgId: uuid('claimed_by_org_id').references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow(),
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
// Billing event log — written by both the manual check-payment form and Stripe webhooks
export const billingEvents = pgTable('billing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  type: text('type').notNull(), // 'check_payment' | 'stripe_payment' | 'status_change' | 'note'
  amountCents: integer('amount_cents'),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id), // null = Stripe webhook
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  organization: one(organizations, {
    fields: [attachments.organizationId],
    references: [organizations.id],
  }),
  teacherTimeOff: one(teacherTimeOff, {
    fields: [attachments.teacherTimeOffId],
    references: [teacherTimeOff.id],
  }),
  subAssignment: one(subAssignments, {
    fields: [attachments.subAssignmentId],
    references: [subAssignments.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  schools: many(schools),
  users: many(users),
  absenceReasons: many(absenceReasons),
  teacherTimeOff: many(teacherTimeOff),
  subAssignments: many(subAssignments),
  subPriorityOrders: many(subPriorityOrders),
  billingEvents: many(billingEvents),
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
  priorityOrders: many(subPriorityOrders),
  notificationTokens: many(subNotificationTokens),
  unavailability: many(subUnavailability),
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
  requestedSub: one(substitutes, {
    fields: [teacherTimeOff.requestedSubId],
    references: [substitutes.id],
  }),
  assignmentLinks: many(assignmentTimeOff),
  notificationTokens: many(subNotificationTokens),
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

export const subSchoolAssignmentsRelations = relations(subSchoolAssignments, ({ one }) => ({
  substitute: one(substitutes, { fields: [subSchoolAssignments.substituteId], references: [substitutes.id] }),
  school: one(schools, { fields: [subSchoolAssignments.schoolId], references: [schools.id] }),
  organization: one(organizations, { fields: [subSchoolAssignments.organizationId], references: [organizations.id] }),
  reviewer: one(users, { fields: [subSchoolAssignments.reviewedBy], references: [users.id] }),
}));

export const subPriorityOrdersRelations = relations(subPriorityOrders, ({ one }) => ({
  organization: one(organizations, {
    fields: [subPriorityOrders.organizationId],
    references: [organizations.id],
  }),
  school: one(schools, {
    fields: [subPriorityOrders.schoolId],
    references: [schools.id],
  }),
  substitute: one(substitutes, {
    fields: [subPriorityOrders.substituteId],
    references: [substitutes.id],
  }),
}));

export const subNotificationTokensRelations = relations(subNotificationTokens, ({ one }) => ({
  teacherTimeOff: one(teacherTimeOff, {
    fields: [subNotificationTokens.teacherTimeOffId],
    references: [teacherTimeOff.id],
  }),
  substitute: one(substitutes, {
    fields: [subNotificationTokens.substituteId],
    references: [substitutes.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  school: one(schools, {
    fields: [invitations.schoolId],
    references: [schools.id],
  }),
  invitedByUser: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const subUnavailabilityRelations = relations(subUnavailability, ({ one }) => ({
  substitute: one(substitutes, {
    fields: [subUnavailability.substituteId],
    references: [substitutes.id],
  }),
}));

export const schoolDirectoryRelations = relations(schoolDirectory, ({ one }) => ({
  claimedByOrg: one(organizations, {
    fields: [schoolDirectory.claimedByOrgId],
    references: [organizations.id],
  }),
}));

export const userSchoolNotificationPrefsRelations = relations(userSchoolNotificationPrefs, ({ one }) => ({
  user: one(users, { fields: [userSchoolNotificationPrefs.userId], references: [users.id] }),
  school: one(schools, { fields: [userSchoolNotificationPrefs.schoolId], references: [schools.id] }),
}));

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
  organization: one(organizations, { fields: [billingEvents.organizationId], references: [organizations.id] }),
  creator: one(users, { fields: [billingEvents.createdBy], references: [users.id] }),
}));
