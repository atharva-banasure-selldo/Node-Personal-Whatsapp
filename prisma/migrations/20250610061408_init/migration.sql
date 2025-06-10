-- CreateTable
CREATE TABLE "WhatsAppClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAuthenticated" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppClient_userId_key" ON "WhatsAppClient"("userId");
