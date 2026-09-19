import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

const prisma = new PrismaClient({ adapter });

async function main() {
    // ============================================================
    // 1. Seed Roles
    // ============================================================

    const roles = [
        {
            name: "ADMIN",
            description: "System administrator",
        },
        {
            name: "CLINIC_ADMIN",
            description: "Clinic administrator",
        },
        {
            name: "DOCTOR",
            description: "Healthcare doctor",
        },
        {
            name: "STAFF",
            description: "Clinic staff member",
        },
        {
            name: "PATIENT",
            description: "Healthcare patient",
        },
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: {
                name: role.name,
            },
            update: {
                description: role.description,
            },
            create: role,
        });
    }

    console.log("Roles seeded successfully.");

    // ============================================================
    // 2. Create Test Patient
    // ============================================================

    // Dev-only default password for seed data - never used in production accounts
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const patient = await prisma.user.upsert({
        where: {
            email: "john@gmail.com",
        },
        update: {
            firstName: "John",
            lastName: "Smith",
            status: "ACTIVE",
        },
        create: {
            email: "john@gmail.com",
            passwordHash,
            firstName: "John",
            lastName: "Smith",
            status: "ACTIVE",
        },
    });

    console.log("Patient seeded successfully:", patient.email);

    // ============================================================
    // 3. Assign PATIENT Role
    // ============================================================

    const patientRole = await prisma.role.findUnique({
        where: {
            name: "PATIENT",
        },
    });

    if (!patientRole) {
        throw new Error("PATIENT role not found");
    }

    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: patient.id,
                roleId: patientRole.id,
            },
        },
        update: {},
        create: {
            userId: patient.id,
            roleId: patientRole.id,
        },
    });

    console.log("PATIENT role assigned successfully.");
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });