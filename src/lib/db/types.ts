import type {
  apiKeys,
  appointments,
  appointmentChangeRequests,
  appointmentServices,
  auditLogs,
  blockedTimes,
  businessHours,
  calendarEventLinks,
  calendarIntegrations,
  customers,
  memberships,
  notifications,
  salons,
  services,
  settings,
  staff,
  staffWorkingHours,
  users,
} from "./schema";

// Row types
export type User = typeof users.$inferSelect;
export type Salon = typeof salons.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type StaffMember = typeof staff.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type AppointmentService = typeof appointmentServices.$inferSelect;
export type AppointmentChangeRequest = typeof appointmentChangeRequests.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type StaffWorkingHour = typeof staffWorkingHours.$inferSelect;
export type BlockedTime = typeof blockedTimes.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type CalendarEventLink = typeof calendarEventLinks.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Insert types
export type NewUser = typeof users.$inferInsert;
export type NewSalon = typeof salons.$inferInsert;
export type NewMembership = typeof memberships.$inferInsert;
export type NewStaffMember = typeof staff.$inferInsert;
export type NewService = typeof services.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewAppointment = typeof appointments.$inferInsert;
export type NewAppointmentService = typeof appointmentServices.$inferInsert;
export type NewBlockedTime = typeof blockedTimes.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;

export type MembershipRole = Membership["role"];
export type AppointmentStatus = Appointment["status"];
export type AppointmentSource = Appointment["source"];
export type ChangeRequestType = AppointmentChangeRequest["type"];
export type ChangeRequestStatus = AppointmentChangeRequest["status"];

/** Appointment with its line items + customer/staff, the common read shape. */
export interface AppointmentDetail extends Appointment {
  services: AppointmentService[];
  customer: Customer;
  staff: StaffMember | null;
}
