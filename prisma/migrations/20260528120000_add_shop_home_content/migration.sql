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

CREATE UNIQUE INDEX "ShopHomeContent_shopId_key" ON "ShopHomeContent"("shopId");

ALTER TABLE "ShopHomeContent"
  ADD CONSTRAINT "ShopHomeContent_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
