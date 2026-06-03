-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('BEVERAGE', 'SHELF', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtraCategory" AS ENUM ('BEVERAGE', 'SHELF', 'OTHER');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "planCode" TEXT,
    "barberLimit" INTEGER,
    "metadataTitle" TEXT,
    "metadataDescription" TEXT,
    "whatsappNumber" TEXT,
    "instagramUrl" TEXT,
    "addressLine" TEXT,
    "businessHours" TEXT,
    "logoPath" TEXT,
    "faviconPath" TEXT,
    "brandColor" TEXT,
    "brandColorStrong" TEXT,
    "brandColorMuted" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "fontFamily" TEXT,
    "fontStyle" TEXT,
    "designTemplate" TEXT,
    "heroImageUrl" TEXT,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "primaryCtaLabel" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "attendanceText" TEXT,
    "reviewsTitle" TEXT,
    "reviewsEmptyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopHomeContent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "primaryButtonLabel" TEXT,
    "primaryButtonHref" TEXT,
    "secondaryButtonLabel" TEXT,
    "secondaryButtonHref" TEXT,
    "infoOneLabel" TEXT,
    "infoOneValue" TEXT,
    "infoTwoLabel" TEXT,
    "infoTwoValue" TEXT,
    "infoThreeLabel" TEXT,
    "infoThreeValue" TEXT,
    "showServices" BOOLEAN NOT NULL DEFAULT true,
    "servicesEyebrow" TEXT,
    "servicesTitle" TEXT,
    "servicesDescription" TEXT,
    "showBarbers" BOOLEAN NOT NULL DEFAULT true,
    "barbersEyebrow" TEXT,
    "barbersTitle" TEXT,
    "barbersDescription" TEXT,
    "showProducts" BOOLEAN NOT NULL DEFAULT false,
    "productsEyebrow" TEXT,
    "productsTitle" TEXT,
    "productsDescription" TEXT,
    "showReviews" BOOLEAN NOT NULL DEFAULT true,
    "reviewsEyebrow" TEXT,
    "reviewsTitle" TEXT,
    "reviewsEmptyText" TEXT,
    "showAbout" BOOLEAN NOT NULL DEFAULT true,
    "aboutEyebrow" TEXT,
    "aboutTitle" TEXT,
    "aboutBody" TEXT,
    "showContact" BOOLEAN NOT NULL DEFAULT true,
    "contactEyebrow" TEXT,
    "contactTitle" TEXT,
    "contactBody" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopHomeContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEmailSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fromName" TEXT,
    "replyToEmail" TEXT,
    "notificationEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopEmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "lastError" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "recipientUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "duration" INTEGER NOT NULL,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(12,2) NOT NULL DEFAULT 40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "publicId" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "isManualFitIn" BOOLEAN NOT NULL DEFAULT false,
    "manualDurationMinutes" INTEGER,
    "isVipPlanUse" BOOLEAN NOT NULL DEFAULT false,
    "vipSubscriptionId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipPlan" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "tokensPerCycle" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipSubscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tokensRemaining" INTEGER NOT NULL DEFAULT 4,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "subscriptionId" TEXT NOT NULL,
    "cycleMonth" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipUsage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "subscriptionId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "tokenAmount" INTEGER NOT NULL DEFAULT 1,
    "serviceLabel" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "nameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "durationSnapshot" INTEGER NOT NULL,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "commissionTypeSnapshot" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValueSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 40,
    "barberPayoutSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shopRevenueSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberAvailability" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "weekDay" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberBlock" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringBarberBlock" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "weekDay" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBarberBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "customerId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "preferredBarberId" TEXT,
    "allergies" TEXT,
    "preferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL DEFAULT 'OTHER',
    "price" DECIMAL(12,2) NOT NULL,
    "imageUrl" TEXT,
    "image_path" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image_path" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberServiceCommission" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(12,2) NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberServiceCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ExtraCategory" NOT NULL DEFAULT 'OTHER',
    "price" DECIMAL(12,2) NOT NULL,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "image_path" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentItem" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "appointmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "commissionTypeSnapshot" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValueSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "barberPayoutSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shopRevenueSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraStockMovement" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "extraProductId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberPayout" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shopNetRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberTip" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "barberId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeImage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "imageUrl" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_primaryDomain_key" ON "Shop"("primaryDomain");

-- CreateIndex
CREATE INDEX "Shop_isActive_isDefault_idx" ON "Shop"("isActive", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ShopHomeContent_shopId_key" ON "ShopHomeContent"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopEmailSettings_shopId_key" ON "ShopEmailSettings"("shopId");

-- CreateIndex
CREATE INDEX "User_shopId_role_isActive_idx" ON "User"("shopId", "role", "isActive");

-- CreateIndex
CREATE INDEX "User_shopId_createdAt_idx" ON "User"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_shopId_key" ON "User"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "User_shopId_email_key" ON "User"("shopId", "email");

-- CreateIndex
CREATE INDEX "Account_shopId_userId_idx" ON "Account"("shopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_id_shopId_key" ON "Account"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_shopId_provider_providerAccountId_key" ON "Account"("shopId", "provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_shopId_recipientUserId_createdAt_idx" ON "EmailDeliveryLog"("shopId", "recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_shopId_status_createdAt_idx" ON "EmailDeliveryLog"("shopId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryLog_shopId_template_eventKey_recipientEmail_key" ON "EmailDeliveryLog"("shopId", "template", "eventKey", "recipientEmail");

-- CreateIndex
CREATE INDEX "AppNotification_shopId_recipientUserId_readAt_createdAt_idx" ON "AppNotification"("shopId", "recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_shopId_type_createdAt_idx" ON "AppNotification"("shopId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotification_shopId_recipientUserId_eventKey_key" ON "AppNotification"("shopId", "recipientUserId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_shopId_userId_isActive_idx" ON "PushSubscription"("shopId", "userId", "isActive");

-- CreateIndex
CREATE INDEX "PushSubscription_shopId_isActive_updatedAt_idx" ON "PushSubscription"("shopId", "isActive", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_id_shopId_key" ON "PushSubscription"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_keyHash_key" ON "RateLimitBucket"("keyHash");

-- CreateIndex
CREATE INDEX "RateLimitBucket_scope_resetAt_idx" ON "RateLimitBucket"("scope", "resetAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "PendingRegistration_shopId_email_expiresAt_idx" ON "PendingRegistration"("shopId", "email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_id_shopId_key" ON "PendingRegistration"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_shopId_email_key" ON "PendingRegistration"("shopId", "email");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_shopId_email_expiresAt_idx" ON "PasswordResetRequest"("shopId", "email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetRequest_id_shopId_key" ON "PasswordResetRequest"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetRequest_shopId_email_key" ON "PasswordResetRequest"("shopId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_userId_key" ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_shopId_email_expiresAt_idx" ON "EmailChangeRequest"("shopId", "email", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_shopId_userId_expiresAt_idx" ON "EmailChangeRequest"("shopId", "userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_id_shopId_key" ON "EmailChangeRequest"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_shopId_email_key" ON "EmailChangeRequest"("shopId", "email");

-- CreateIndex
CREATE INDEX "Service_shopId_isActive_name_idx" ON "Service"("shopId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Service_shopId_barberId_isActive_idx" ON "Service"("shopId", "barberId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_id_shopId_key" ON "Service"("id", "shopId");

-- CreateIndex
CREATE INDEX "Appointment_shopId_customerId_idx" ON "Appointment"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "Appointment_shopId_customerId_date_idx" ON "Appointment"("shopId", "customerId", "date");

-- CreateIndex
CREATE INDEX "Appointment_shopId_barberId_status_idx" ON "Appointment"("shopId", "barberId", "status");

-- CreateIndex
CREATE INDEX "Appointment_shopId_barberId_date_idx" ON "Appointment"("shopId", "barberId", "date");

-- CreateIndex
CREATE INDEX "Appointment_shopId_date_idx" ON "Appointment"("shopId", "date");

-- CreateIndex
CREATE INDEX "Appointment_shopId_status_reminderSentAt_date_idx" ON "Appointment"("shopId", "status", "reminderSentAt", "date");

-- CreateIndex
CREATE INDEX "Appointment_shopId_isVipPlanUse_date_idx" ON "Appointment"("shopId", "isVipPlanUse", "date");

-- CreateIndex
CREATE INDEX "Appointment_shopId_vipSubscriptionId_idx" ON "Appointment"("shopId", "vipSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_id_shopId_key" ON "Appointment"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_shopId_publicId_key" ON "Appointment"("shopId", "publicId");

-- CreateIndex
CREATE INDEX "VipPlan_shopId_isActive_idx" ON "VipPlan"("shopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VipPlan_shopId_code_key" ON "VipPlan"("shopId", "code");

-- CreateIndex
CREATE INDEX "VipSubscription_shopId_customerId_status_idx" ON "VipSubscription"("shopId", "customerId", "status");

-- CreateIndex
CREATE INDEX "VipSubscription_shopId_planId_idx" ON "VipSubscription"("shopId", "planId");

-- CreateIndex
CREATE INDEX "VipSubscription_shopId_cycleStart_cycleEnd_idx" ON "VipSubscription"("shopId", "cycleStart", "cycleEnd");

-- CreateIndex
CREATE UNIQUE INDEX "VipSubscription_id_shopId_key" ON "VipSubscription"("id", "shopId");

-- CreateIndex
CREATE INDEX "VipPayment_shopId_status_cycleMonth_idx" ON "VipPayment"("shopId", "status", "cycleMonth");

-- CreateIndex
CREATE UNIQUE INDEX "VipPayment_shopId_subscriptionId_cycleMonth_key" ON "VipPayment"("shopId", "subscriptionId", "cycleMonth");

-- CreateIndex
CREATE UNIQUE INDEX "VipUsage_appointmentId_key" ON "VipUsage"("appointmentId");

-- CreateIndex
CREATE INDEX "VipUsage_shopId_subscriptionId_usedAt_idx" ON "VipUsage"("shopId", "subscriptionId", "usedAt");

-- CreateIndex
CREATE INDEX "VipUsage_shopId_customerId_usedAt_idx" ON "VipUsage"("shopId", "customerId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VipUsage_id_shopId_key" ON "VipUsage"("id", "shopId");

-- CreateIndex
CREATE INDEX "AppointmentService_shopId_appointmentId_orderIndex_idx" ON "AppointmentService"("shopId", "appointmentId", "orderIndex");

-- CreateIndex
CREATE INDEX "AppointmentService_shopId_serviceId_idx" ON "AppointmentService"("shopId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentService_id_shopId_key" ON "AppointmentService"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE INDEX "Review_shopId_customerId_idx" ON "Review"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "Review_shopId_barberId_idx" ON "Review"("shopId", "barberId");

-- CreateIndex
CREATE INDEX "Review_shopId_isVisible_createdAt_idx" ON "Review"("shopId", "isVisible", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_id_shopId_key" ON "Review"("id", "shopId");

-- CreateIndex
CREATE INDEX "BarberAvailability_shopId_barberId_weekDay_idx" ON "BarberAvailability"("shopId", "barberId", "weekDay");

-- CreateIndex
CREATE UNIQUE INDEX "BarberAvailability_id_shopId_key" ON "BarberAvailability"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberAvailability_barberId_weekDay_key" ON "BarberAvailability"("barberId", "weekDay");

-- CreateIndex
CREATE INDEX "BarberBlock_shopId_barberId_startDateTime_idx" ON "BarberBlock"("shopId", "barberId", "startDateTime");

-- CreateIndex
CREATE INDEX "BarberBlock_shopId_barberId_endDateTime_idx" ON "BarberBlock"("shopId", "barberId", "endDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "BarberBlock_id_shopId_key" ON "BarberBlock"("id", "shopId");

-- CreateIndex
CREATE INDEX "RecurringBarberBlock_shopId_barberId_weekDay_isActive_idx" ON "RecurringBarberBlock"("shopId", "barberId", "weekDay", "isActive");

-- CreateIndex
CREATE INDEX "RecurringBarberBlock_shopId_barberId_isActive_idx" ON "RecurringBarberBlock"("shopId", "barberId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringBarberBlock_id_shopId_key" ON "RecurringBarberBlock"("id", "shopId");

-- CreateIndex
CREATE INDEX "ClientNote_shopId_barberId_idx" ON "ClientNote"("shopId", "barberId");

-- CreateIndex
CREATE INDEX "ClientNote_shopId_customerId_idx" ON "ClientNote"("shopId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientNote_id_shopId_key" ON "ClientNote"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientNote_barberId_customerId_key" ON "ClientNote"("barberId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_customerId_key" ON "CustomerProfile"("customerId");

-- CreateIndex
CREATE INDEX "CustomerProfile_shopId_preferredBarberId_idx" ON "CustomerProfile"("shopId", "preferredBarberId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_id_shopId_key" ON "CustomerProfile"("id", "shopId");

-- CreateIndex
CREATE INDEX "Product_shopId_isActive_createdAt_idx" ON "Product"("shopId", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_shopId_key" ON "Product"("id", "shopId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_shopId_idx" ON "ProductImage"("shopId");

-- CreateIndex
CREATE INDEX "ProductImage_shopId_productId_idx" ON "ProductImage"("shopId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_id_shopId_key" ON "ProductImage"("id", "shopId");

-- CreateIndex
CREATE INDEX "BarberServiceCommission_shopId_barberId_idx" ON "BarberServiceCommission"("shopId", "barberId");

-- CreateIndex
CREATE INDEX "BarberServiceCommission_shopId_serviceId_idx" ON "BarberServiceCommission"("shopId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberServiceCommission_id_shopId_key" ON "BarberServiceCommission"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberServiceCommission_barberId_serviceId_key" ON "BarberServiceCommission"("barberId", "serviceId");

-- CreateIndex
CREATE INDEX "ExtraProduct_shopId_isActive_createdAt_idx" ON "ExtraProduct"("shopId", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraProduct_id_shopId_key" ON "ExtraProduct"("id", "shopId");

-- CreateIndex
CREATE INDEX "AppointmentItem_shopId_appointmentId_idx" ON "AppointmentItem"("shopId", "appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentItem_shopId_productId_idx" ON "AppointmentItem"("shopId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentItem_id_shopId_key" ON "AppointmentItem"("id", "shopId");

-- CreateIndex
CREATE INDEX "StockMovement_shopId_productId_createdAt_idx" ON "StockMovement"("shopId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_shopId_type_idx" ON "StockMovement"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_id_shopId_key" ON "StockMovement"("id", "shopId");

-- CreateIndex
CREATE INDEX "ExtraStockMovement_shopId_extraProductId_createdAt_idx" ON "ExtraStockMovement"("shopId", "extraProductId", "createdAt");

-- CreateIndex
CREATE INDEX "ExtraStockMovement_shopId_type_idx" ON "ExtraStockMovement"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraStockMovement_id_shopId_key" ON "ExtraStockMovement"("id", "shopId");

-- CreateIndex
CREATE INDEX "BarberPayout_shopId_barberId_status_idx" ON "BarberPayout"("shopId", "barberId", "status");

-- CreateIndex
CREATE INDEX "BarberPayout_shopId_periodStart_periodEnd_idx" ON "BarberPayout"("shopId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BarberPayout_id_shopId_key" ON "BarberPayout"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberPayout_barberId_periodStart_periodEnd_key" ON "BarberPayout"("barberId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BarberTip_shopId_barberId_idx" ON "BarberTip"("shopId", "barberId");

-- CreateIndex
CREATE INDEX "BarberTip_shopId_createdAt_idx" ON "BarberTip"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "BarberTip_shopId_barberId_createdAt_idx" ON "BarberTip"("shopId", "barberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BarberTip_id_shopId_key" ON "BarberTip"("id", "shopId");

-- CreateIndex
CREATE INDEX "HomeImage_shopId_isActive_position_idx" ON "HomeImage"("shopId", "isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "HomeImage_id_shopId_key" ON "HomeImage"("id", "shopId");

-- AddForeignKey
ALTER TABLE "ShopHomeContent" ADD CONSTRAINT "ShopHomeContent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopEmailSettings" ADD CONSTRAINT "ShopEmailSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRegistration" ADD CONSTRAINT "PendingRegistration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vipSubscriptionId_fkey" FOREIGN KEY ("vipSubscriptionId") REFERENCES "VipSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipPlan" ADD CONSTRAINT "VipPlan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipPayment" ADD CONSTRAINT "VipPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipPayment" ADD CONSTRAINT "VipPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VipSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipUsage" ADD CONSTRAINT "VipUsage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipUsage" ADD CONSTRAINT "VipUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VipSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipUsage" ADD CONSTRAINT "VipUsage_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipUsage" ADD CONSTRAINT "VipUsage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberAvailability" ADD CONSTRAINT "BarberAvailability_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberAvailability" ADD CONSTRAINT "BarberAvailability_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBarberBlock" ADD CONSTRAINT "RecurringBarberBlock_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBarberBlock" ADD CONSTRAINT "RecurringBarberBlock_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_preferredBarberId_fkey" FOREIGN KEY ("preferredBarberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberServiceCommission" ADD CONSTRAINT "BarberServiceCommission_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberServiceCommission" ADD CONSTRAINT "BarberServiceCommission_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberServiceCommission" ADD CONSTRAINT "BarberServiceCommission_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraProduct" ADD CONSTRAINT "ExtraProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ExtraProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraStockMovement" ADD CONSTRAINT "ExtraStockMovement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraStockMovement" ADD CONSTRAINT "ExtraStockMovement_extraProductId_fkey" FOREIGN KEY ("extraProductId") REFERENCES "ExtraProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberPayout" ADD CONSTRAINT "BarberPayout_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberPayout" ADD CONSTRAINT "BarberPayout_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberTip" ADD CONSTRAINT "BarberTip_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberTip" ADD CONSTRAINT "BarberTip_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeImage" ADD CONSTRAINT "HomeImage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
