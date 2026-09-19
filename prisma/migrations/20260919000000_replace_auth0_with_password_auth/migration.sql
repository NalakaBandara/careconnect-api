-- DropIndex
DROP INDEX "User_auth0UserId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "auth0UserId",
ADD COLUMN     "passwordHash" VARCHAR(255);
