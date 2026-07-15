// Run with: npm run seed
// Creates a demo employee so you can log in and see a populated dashboard
// immediately, instead of an empty screen.

import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.model.js";
import Task from "../models/Task.model.js";
import Meeting from "../models/Meeting.model.js";
import WellnessCheck from "../models/WellnessCheck.model.js";

dotenv.config();

const DEMO_EMAIL = "anjali.secretary@lsgd.kerala.gov.in";
const DEMO_PASSWORD = "Demo@1234";
const ADMIN_EMAIL = "admin.officer@lsgd.kerala.gov.in";
const ADMIN_PASSWORD = "Admin@1234";

async function seed() {
  await connectDB();

  // Clear existing users to prevent validation and index conflicts with the new schema fields
  await User.deleteMany({});
  console.log("Cleared existing users from database.");

  // Create demo employee using the updated Phase 1 schema structure
  const user = await User.create({
    employeeId: "EMP1001",
    name: "Anjali Nair",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD, // Automatic pre-save hashing
    phone: "+91 9876543210",
    role: "Employee",
    designation: "Panchayat Secretary",
    district: "Thiruvananthapuram",
    department: "Local Self Government",
    isActive: true,
  });
  console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (ID: EMP1001)`);

  // Create demo admin user
  const admin = await User.create({
    employeeId: "EMP1002",
    name: "Harish Kumar",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    phone: "+91 9876543222",
    role: "Admin",
    designation: "State IT Administrator",
    district: "Thiruvananthapuram",
    department: "General Administration",
    isActive: true,
  });
  console.log(`Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (ID: EMP1002)`);

  // Clear and seed other dashboard tables to align with the new user's ID
  await Task.deleteMany({ assignedTo: user._id });
  await Meeting.deleteMany({ participant: user._id });
  await WellnessCheck.deleteMany({ user: user._id });

  const today = new Date();
  const inDays = (n) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  await Task.insertMany([
    { employee: user._id, assignedTo: user._id, title: "Review flood relief fund disbursement file", type: "file", priority: "high", dueDate: inDays(0) },
    { employee: user._id, assignedTo: user._id, title: "Approve casual leave request - S. Kumar", type: "task", priority: "medium", dueDate: inDays(0) },
    { employee: user._id, assignedTo: user._id, title: "Submit monthly sanitation report", type: "file", priority: "high", dueDate: inDays(1) },
    { employee: user._id, assignedTo: user._id, title: "Read new circular on disaster duty leave", type: "circular_review", priority: "low", dueDate: inDays(3) },
  ]);

  await Meeting.insertMany([
    {
      participant: user._id,
      title: "Ward development committee review",
      startTime: new Date(today.setHours(11, 0, 0, 0)),
      endTime: new Date(today.setHours(12, 0, 0, 0)),
      location: "Panchayat Office, Hall 2",
    },
  ]);

  await WellnessCheck.insertMany([
    { user: user._id, date: inDays(-1), mood: "good", sleepHours: "6-7", energy: "High", stress: "Low", workload: "Normal", wellnessScore: 82, focusScore: 78, status: "completed", dateString: "2026-07-10" },
    { user: user._id, date: inDays(-2), mood: "okay", sleepHours: "6-7", energy: "Moderate", stress: "Moderate", workload: "Normal", wellnessScore: 70, focusScore: 68, status: "completed", dateString: "2026-07-09" },
    { user: user._id, date: inDays(-3), mood: "tired", sleepHours: "4-5", energy: "Low", stress: "High", workload: "Heavy", wellnessScore: 48, focusScore: 45, status: "completed", dateString: "2026-07-08" },
  ]);

  console.log("Seeded sample tasks, meetings, and wellness history.");

  console.log("\nLogin with Employee:");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log("\nLogin with Admin:");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
