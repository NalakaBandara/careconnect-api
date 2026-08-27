import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
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
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });